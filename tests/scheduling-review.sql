-- Run with foundation fixture prefix. Synthetic records, rollback after all assertions.
insert into public.entitlements values('20000000-0000-4000-8000-000000000001','scheduling',true);
insert into private.schedule_state values('20000000-0000-4000-8000-000000000001',1);
insert into public.configuration_versions(organization_id,version,settings) values('20000000-0000-4000-8000-000000000001',2,
 '{"timezone":"America/Chicago","notificationRecipient":"owner@example.invalid","scheduling":{"weekdays":[1,2,3,4,5],"earliestStart":480,"latestStart":900,"endOfDay":1020,"bufferMinutes":15,"leadMinutes":0,"horizonDays":90,"selectionMinutes":10,"proposalMinutes":120,"pendingLimit":2}}');
insert into public.resources(organization_id,id,name,kind) values
 ('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Synthetic operator','operator'),
 ('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','Synthetic second operator','operator');
insert into public.service_requests(organization_id,id,service_id,original_submission,privacy_version) select
 '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',id,'{}','test-only' from public.catalog_services;
-- Dynamic next Monday uses business timezone; calendar arithmetic is independent of current weekday.
create function pg_temp.future_start() returns timestamptz language sql as $$ select ((date_trunc('week',now() at time zone 'America/Chicago')+interval '14 days 8 hours') at time zone 'America/Chicago') $$;

update public.catalog_services set compliance='approved';
update public.service_requests set status='reviewing';
insert into private.google_accounts(organization_id,revision,encrypted_tokens,calendar_id,health) values('20000000-0000-4000-8000-000000000001',1,'synthetic-ciphertext-never-used','synthetic-calendar','connected');
create function pg_temp.review_input(appointment uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.appointments;raw jsonb;start_time timestamptz;
begin
 if appointment is not null then select * into a from public.appointments where id=appointment;end if;
 start_time:=coalesce(a.start_at,pg_temp.future_start());
 raw:=jsonb_build_object('organizationId','20000000-0000-4000-8000-000000000001','requestId','50000000-0000-4000-8000-000000000001','requestRevision',1,'configurationVersion',2,'scheduleRevision',(select revision from private.schedule_state where organization_id='20000000-0000-4000-8000-000000000001'),
 'appointmentId',a.id,'appointmentRevision',a.revision,'resources',jsonb_build_array('40000000-0000-4000-8000-000000000001'),'travelBeforeMinutes',0,'travelAfterMinutes',0,'scopeReviewed',true,'equipmentReviewed',true,'pickupReviewed',true,'reviewNote','Synthetic verified owner route review');
 return raw||jsonb_build_object('startAt',start_time,'endAt',start_time+interval '2 hours','arrivalAt',start_time,'commandInput',raw);
end$$;
create function pg_temp.appointment_id() returns uuid language sql security definer set search_path='' as $$select id from public.appointments where organization_id='20000000-0000-4000-8000-000000000001' and request_id='50000000-0000-4000-8000-000000000001'$$;
create function pg_temp.provider_input() returns jsonb language sql as $$select jsonb_build_object('connectionRevision',1,'calendarId','synthetic-calendar','checkedAt',clock_timestamp(),'windowStart',pg_temp.future_start()-interval '1 hour','windowEnd',pg_temp.future_start()+interval '3 hours','busy','[]'::jsonb)$$;
create table pg_temp.review_results(value jsonb,input jsonb);
grant all on pg_temp.review_results to authenticated,service_role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select pg_temp.assert_true(public.scheduling_review_context('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',null)->>'requestRevision'='1','owner receives current request context');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.record_scheduling_review(uuid,uuid,uuid,text,jsonb,jsonb)','EXECUTE'),'browser cannot mint trusted provider facts');
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$begin begin
 perform public.record_scheduling_review('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','review-invalid-owner',pg_temp.review_input(),pg_temp.provider_input());raise exception 'TEST FAILED customer owner review';exception when insufficient_privilege then null;end;end$$;
do $$begin begin
 perform public.record_scheduling_review('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','review-missing-clock',pg_temp.review_input(),pg_temp.provider_input()-'checkedAt');raise exception 'TEST FAILED missing Google timestamp';exception when raise_exception then if sqlerrm<>'PROVIDER_FACTS_REQUIRED' then raise;end if;end;end$$;
insert into pg_temp.review_results select public.record_scheduling_review('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','review-create-proposal',pg_temp.review_input(),pg_temp.provider_input()),pg_temp.review_input()->'commandInput';
select public.record_scheduling_review('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','review-create-proposal',pg_temp.review_input(),pg_temp.provider_input());
reset role;
select pg_temp.assert_true((select count(*)=1 from private.scheduling_reviews),'one trusted review on retry');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select public.commit_reviewed_schedule('20000000-0000-4000-8000-000000000001',(select input from pg_temp.review_results),'review-complete-proposal',(select (value->>'evidenceId')::uuid from pg_temp.review_results));
select public.commit_reviewed_schedule('20000000-0000-4000-8000-000000000001',(select input from pg_temp.review_results),'review-complete-proposal',null);
select pg_temp.assert_true((select count(*)=1 from public.appointments where status='proposal' and revision=2),'one submitted proposal, no abandoned intermediate hold');
select pg_temp.assert_true((select count(*)=1 from public.resource_reservations where active),'one operator reservation');
reset role;
truncate pg_temp.review_results;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into pg_temp.review_results select public.record_scheduling_review('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','review-approve-proposal',pg_temp.review_input(pg_temp.appointment_id()),pg_temp.provider_input()),pg_temp.review_input(pg_temp.appointment_id())->'commandInput';
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select public.commit_reviewed_schedule('20000000-0000-4000-8000-000000000001',(select input from pg_temp.review_results),'review-complete-approval',(select (value->>'evidenceId')::uuid from pg_temp.review_results));
select pg_temp.assert_true((select count(*)=1 from public.appointments where status='reserved' and revision=3),'owner confirmation converts same reservation');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='appointment.confirmation'),'one confirmation intent');
select public.commit_reviewed_schedule('20000000-0000-4000-8000-000000000001',(select input from pg_temp.review_results),'review-complete-approval',null);
do $$begin begin
 perform public.commit_reviewed_schedule('20000000-0000-4000-8000-000000000001',(select input||'{"travelBeforeMinutes":1}'::jsonb from pg_temp.review_results),'review-complete-approval',null);raise exception 'TEST FAILED altered retry';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;end$$;
reset role;
rollback;
