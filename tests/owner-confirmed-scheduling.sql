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


-- Deliberately retain catalog compliance=review, exactly like the production failure.
update public.service_requests set status='reviewing';
insert into private.google_accounts(organization_id,revision,encrypted_tokens,calendar_id,health) values('20000000-0000-4000-8000-000000000001',1,'synthetic-ciphertext-never-used','synthetic-calendar','connected');
create function pg_temp.owner_input() returns jsonb language plpgsql security definer set search_path='' as $$
declare raw jsonb;start_time timestamptz:=pg_temp.future_start();
begin
 raw:=jsonb_build_object('confirmImmediately',true,'organizationId','20000000-0000-4000-8000-000000000001','requestId','50000000-0000-4000-8000-000000000001','requestRevision',1,'configurationVersion',2,'scheduleRevision',(select revision from private.schedule_state where organization_id='20000000-0000-4000-8000-000000000001'),'appointmentId',null,'appointmentRevision',null,'resources',jsonb_build_array('40000000-0000-4000-8000-000000000001'),'travelBeforeMinutes',0,'travelAfterMinutes',0,'scopeReviewed',true,'equipmentReviewed',true,'pickupReviewed',true,'reviewNote','Owner reviewed this requested work and exclusions');
 return raw||jsonb_build_object('startAt',start_time,'endAt',start_time+interval '2 hours','arrivalAt',start_time,'commandInput',raw);
end$$;
create function pg_temp.owner_provider() returns jsonb language sql as $$select jsonb_build_object('connectionRevision',1,'calendarId','synthetic-calendar','checkedAt',clock_timestamp(),'windowStart',pg_temp.future_start()-interval '1 hour','windowEnd',pg_temp.future_start()+interval '3 hours','busy','[]'::jsonb)$$;
create table pg_temp.owner_results(evidence jsonb,input jsonb,result jsonb);
grant all on pg_temp.owner_results to authenticated,service_role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into pg_temp.owner_results(evidence,input) select public.record_scheduling_review('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner-evidence-key-01',pg_temp.owner_input(),pg_temp.owner_provider()),pg_temp.owner_input()->'commandInput';
reset role;
select pg_temp.assert_true(private.request_scope_reviewed('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'),'request-specific review recorded');
select pg_temp.assert_true((select compliance='review' from public.catalog_services limit 1),'category not globally approved');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
update pg_temp.owner_results set result=public.commit_confirmed_schedule('20000000-0000-4000-8000-000000000001',input,'owner-confirm-key-001',(evidence->>'evidenceId')::uuid);
select public.commit_confirmed_schedule('20000000-0000-4000-8000-000000000001',(select input from pg_temp.owner_results),'owner-confirm-key-001',null);
select pg_temp.assert_true((select count(*)=1 from public.appointments where status='reserved'),'one click creates reserved appointment');
select pg_temp.assert_true((select count(*)=0 from public.appointments where status in('proposal','held')),'no incomplete owner proposal');
select pg_temp.assert_true((select count(*)=1 from public.resource_reservations where active),'one resource reservation');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='appointment.confirmation' and status='pending'),'one customer confirmation');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='appointment.owner_confirmation' and status='pending'),'one owner confirmation');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='calendar.upsert' and status='pending'),'one current calendar intent');
select pg_temp.assert_true((select count(*)=0 from public.outbox where kind='appointment.owner_approval' and status='pending'),'no redundant approval notice');
select pg_temp.assert_true(public.appointment_delivery_status('20000000-0000-4000-8000-000000000001',(select (result->>'id')::uuid from pg_temp.owner_results))->>'customerEmail'='pending','delivery status is honest');
do $$begin begin
 perform public.commit_confirmed_schedule('20000000-0000-4000-8000-000000000001',(select input||'{"travelBeforeMinutes":1}'::jsonb from pg_temp.owner_results),'owner-confirm-key-001',null);raise exception 'TEST FAILED changed retry';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;end$$;
reset role;
-- A later held-service change invalidates the saved review and stops minting new facts.
update public.catalog_services set compliance='held';
select pg_temp.assert_true(not private.request_scope_reviewed('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'),'changed/held scope invalidates review');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$begin begin
 perform public.record_scheduling_review('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner-held-evidence-key',pg_temp.owner_input(),pg_temp.owner_provider());raise exception 'TEST FAILED held scheduled';exception when raise_exception then if sqlerrm<>'SERVICE_REVIEW_REQUIRED' then raise;end if;end;end$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
do $$begin begin
 perform public.commit_confirmed_schedule('20000000-0000-4000-8000-000000000001',(select input from pg_temp.owner_results),'owner-cross-tenant-key',null);raise exception 'TEST FAILED tenant access';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
