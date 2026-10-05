-- Synthetic, transaction-scoped fixtures. No hosted owner identity is impersonated.
insert into public.entitlements values('20000000-0000-4000-8000-000000000001','scheduling',true);
insert into public.configuration_versions(organization_id,version,settings)
select organization_id,2,settings||'{"timezone":"America/Chicago","scheduling":{"weekdays":[1,2,3,4,5],"earliestStart":480,"latestStart":900,"endOfDay":1020,"bufferMinutes":15,"leadMinutes":0,"horizonDays":90,"selectionMinutes":10,"proposalMinutes":120,"pendingLimit":2}}'::jsonb from public.configuration_versions;
insert into public.resources(organization_id,id,name,kind) values
 ('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Synthetic operator','operator'),
 ('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','Synthetic mower','equipment');
update public.catalog_services set compliance='approved';
insert into private.google_accounts(organization_id,revision,encrypted_tokens,calendar_id,health) values('20000000-0000-4000-8000-000000000001',1,'synthetic-ciphertext-never-used','synthetic-calendar','connected');
create function pg_temp.future_start() returns timestamptz language sql as $$select ((date_trunc('week',now() at time zone 'America/Chicago')+interval '14 days 8 hours') at time zone 'America/Chicago')$$;
create function pg_temp.provider_input(start_time timestamptz) returns jsonb language sql as $$select jsonb_build_object('connectionRevision',1,'calendarId','synthetic-calendar','checkedAt',clock_timestamp(),'windowStart',start_time-interval '1 hour','windowEnd',start_time+interval '3 hours','busy','[]'::jsonb)$$;
create function pg_temp.selection_input() returns jsonb language sql as $$select jsonb_build_object('mode','once','start',pg_temp.future_start()+interval '5 hours','tokenHash',repeat('e',64),'browserHash',repeat('f',64))$$;
create function pg_temp.request_input() returns jsonb language sql as $$select jsonb_build_object('services',jsonb_build_array(jsonb_build_object('service','Lawn care','task','Leaf management')),'name','Synthetic Neighbor','phone','5550000000','email','test@example.invalid','street','100 Test Street','city','DeKalb','description','Synthetic fixture only','communityRate','No','preferredTime','Synthetic preferred time')$$;
create table pg_temp.website_results(value jsonb,input jsonb,review jsonb);
grant all on pg_temp.website_results to authenticated,service_role;
select pg_temp.assert_true(not has_function_privilege('anon','public.website_slot_hold(uuid,text,uuid,text,text,text,timestamptz,jsonb)','EXECUTE'),'anonymous browser cannot invoke hold RPC');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.submit_website_request(uuid,text,text,jsonb,jsonb,jsonb)','EXECUTE'),'signed-in customer cannot invoke service bridge');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','70000000-0000-4000-8000-000000000001',repeat('1',64),repeat('b',64),repeat('a',64),pg_temp.future_start(),pg_temp.provider_input(pg_temp.future_start()));
select public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','70000000-0000-4000-8000-000000000001',repeat('1',64),repeat('b',64),repeat('a',64),pg_temp.future_start(),pg_temp.provider_input(pg_temp.future_start()));
reset role;
select pg_temp.assert_true((select count(*)=1 from public.appointments),'retry creates one canonical held appointment');
select pg_temp.assert_true((select count(*)=1 from public.resource_reservations where active),'retry creates one resource reservation');
select pg_temp.assert_true((select count(*)=0 from public.outbox),'unsubmitted selection sends no message or Google event');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$begin begin
 perform public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','70000000-0000-4000-8000-000000000002',repeat('2',64),repeat('d',64),repeat('c',64),pg_temp.future_start()+interval '2 hours',pg_temp.provider_input(pg_temp.future_start()+interval '2 hours'));
 raise exception 'TEST FAILED overlapping travel buffer';exception when raise_exception then if sqlerrm<>'CAPACITY_CONFLICT' then raise;end if;end;end$$;
do $$begin begin
 perform public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','70000000-0000-4000-8000-000000000001',repeat('1',64),repeat('b',64),repeat('a',64),pg_temp.future_start()+interval '30 minutes',pg_temp.provider_input(pg_temp.future_start()+interval '30 minutes'));
 raise exception 'TEST FAILED changed retry';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;end$$;
select public.website_slot_hold('20000000-0000-4000-8000-000000000001','release','70000000-0000-4000-8000-000000000099',repeat('1',64),repeat('d',64),repeat('a',64),null,null);
reset role;
select pg_temp.assert_true((select count(*)=1 from public.resource_reservations where active),'wrong browser cannot release another selection');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.website_slot_hold('20000000-0000-4000-8000-000000000001','release','70000000-0000-4000-8000-000000000003',repeat('1',64),repeat('b',64),repeat('c',64),null,null);
do $$begin begin
 perform public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','70000000-0000-4000-8000-000000000003',repeat('1',64),repeat('b',64),repeat('c',64),pg_temp.future_start(),pg_temp.provider_input(pg_temp.future_start()));
 raise exception 'TEST FAILED late selection after cancellation';exception when raise_exception then if sqlerrm<>'HOLD_EXPIRED' then raise;end if;end;end$$;
select public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','70000000-0000-4000-8000-000000000004',repeat('1',64),repeat('b',64),repeat('d',64),pg_temp.future_start()+interval '5 hours',pg_temp.provider_input(pg_temp.future_start()+interval '5 hours'));
reset role;
select pg_temp.assert_true((select count(*)=1 from public.appointments where status='canceled'),'switch cancels previous selection atomically');
select pg_temp.assert_true((select count(*)=1 from public.resource_reservations where active),'switch retains one active reservation');
update public.appointments set expires_at=clock_timestamp()-interval '1 second' where status='held';
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.assert_true((select count(*)=0 from public.website_reserved_times('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',pg_temp.future_start(),pg_temp.future_start()+interval '1 day')),'expired selection immediately stops hiding available times');
select public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','70000000-0000-4000-8000-000000000005',repeat('2',64),repeat('f',64),repeat('e',64),pg_temp.future_start()+interval '5 hours',pg_temp.provider_input(pg_temp.future_start()+interval '5 hours'));
select pg_temp.assert_true(public.submit_website_request('20000000-0000-4000-8000-000000000001','website-submit-key-01',repeat('2',64),pg_temp.request_input(),pg_temp.selection_input(),null) is null,'first submission requires fresh Google facts');
do $$begin begin
 perform public.submit_website_request('20000000-0000-4000-8000-000000000001','website-wrong-token-01',repeat('2',64),pg_temp.request_input(),pg_temp.selection_input()||jsonb_build_object('tokenHash',repeat('a',64)),pg_temp.provider_input(pg_temp.future_start()+interval '5 hours'));
 raise exception 'TEST FAILED wrong hold token';exception when raise_exception then if sqlerrm<>'HOLD_EXPIRED' then raise;end if;end;end$$;
do $$begin begin
 perform public.submit_website_request('20000000-0000-4000-8000-000000000001','website-busy-provider',repeat('2',64),pg_temp.request_input(),pg_temp.selection_input(),pg_temp.provider_input(pg_temp.future_start()+interval '5 hours')||jsonb_build_object('busy',jsonb_build_array(jsonb_build_object('start',pg_temp.future_start()+interval '5 hours','end',pg_temp.future_start()+interval '6 hours'))));
 raise exception 'TEST FAILED new Google conflict';exception when raise_exception then if sqlerrm<>'GOOGLE_BUSY_CONFLICT' then raise;end if;end;end$$;
reset role;
select pg_temp.assert_true((select count(*)=0 from public.service_requests),'failed submissions create no request');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into pg_temp.website_results(value) select public.submit_website_request('20000000-0000-4000-8000-000000000001','website-submit-key-01',repeat('2',64),pg_temp.request_input(),pg_temp.selection_input(),pg_temp.provider_input(pg_temp.future_start()+interval '5 hours'));
reset role;
select pg_temp.assert_true((select count(*)=1 from public.service_requests),'one durable request');
select pg_temp.assert_true((select count(*)=1 from public.appointments where status='proposal' and request_id=(select (value->>'id')::uuid from pg_temp.website_results)),'same held appointment attached as proposal');
select pg_temp.assert_true((select count(*)=1 from public.resource_reservations where active),'attachment retains canonical reservation');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='request.owner_notification'),'one owner email intent');
select pg_temp.assert_true((select count(*)=0 from public.outbox where kind='calendar.upsert'),'no Google event before owner approval');
select pg_temp.assert_true((select count(*)=1 from public.appointment_tasks where state='pending' and kind='owner_approval'),'owner approval task exists');
update private.google_accounts set encrypted_tokens=null;
update public.appointments set expires_at=clock_timestamp()-interval '1 second' where status='proposal';
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.assert_true(public.submit_website_request('20000000-0000-4000-8000-000000000001','website-submit-key-01',repeat('2',64),pg_temp.request_input(),pg_temp.selection_input(),null)=(select value from pg_temp.website_results),'receipt replay succeeds after expiry and provider outage');
do $$begin begin
 perform public.submit_website_request('20000000-0000-4000-8000-000000000001','website-submit-key-01',repeat('2',64),pg_temp.request_input()||'{"name":"Changed Neighbor"}',pg_temp.selection_input(),null);
 raise exception 'TEST FAILED changed submission retry';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;end$$;
select public.website_slot_hold('20000000-0000-4000-8000-000000000001','release','70000000-0000-4000-8000-000000000005',repeat('2',64),repeat('f',64),repeat('e',64),null,null);
reset role;
select pg_temp.assert_true((select count(*)=1 from public.appointments where status='proposal'),'browser release cannot cancel submitted request');
update private.google_accounts set encrypted_tokens='synthetic-ciphertext-never-used';
update public.appointments set expires_at=clock_timestamp()+interval '2 hours' where status='proposal';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.review_service_request('20000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from pg_temp.website_results),1,'reviewing','website-owner-review-01');
select pg_temp.assert_true(public.scheduling_review_context('20000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from pg_temp.website_results),(select id from public.appointments where status='proposal'))->>'allowAdditionalResources'='true','owner may add equipment to website proposal');
reset role;
update pg_temp.website_results set input=jsonb_build_object('requestId',value->>'id','requestRevision',2,'configurationVersion',2,'scheduleRevision',(select revision from private.schedule_state where organization_id='20000000-0000-4000-8000-000000000001'),
 'appointmentId',(select id from public.appointments where status='proposal'),'appointmentRevision',2,'resources',jsonb_build_array('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002'),
 'travelBeforeMinutes',0,'travelAfterMinutes',0,'scopeReviewed',true,'equipmentReviewed',true,'pickupReviewed',true,'reviewNote','Synthetic owner scope and equipment review');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
update pg_temp.website_results set review=public.record_scheduling_review('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','website-owner-facts-01',input||jsonb_build_object('commandInput',input,'startAt',pg_temp.future_start()+interval '5 hours','endAt',pg_temp.future_start()+interval '7 hours','arrivalAt',pg_temp.future_start()+interval '5 hours'),pg_temp.provider_input(pg_temp.future_start()+interval '5 hours'));
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.commit_reviewed_schedule('20000000-0000-4000-8000-000000000001',(select input from pg_temp.website_results),'website-owner-approve-01',(select (review->>'evidenceId')::uuid from pg_temp.website_results));
select public.commit_reviewed_schedule('20000000-0000-4000-8000-000000000001',(select input from pg_temp.website_results),'website-owner-approve-01',null);
reset role;
select pg_temp.assert_true((select count(*)=1 from public.appointments where status='reserved'),'owner approved canonical appointment');
select pg_temp.assert_true((select count(*)=2 from public.resource_reservations where active),'operator and added mower reserved');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='appointment.confirmation'),'one confirmation after owner approval');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='calendar.upsert'),'one calendar projection intent after approval');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='appointment.reminder' and next_attempt_at=pg_temp.future_start()+interval '5 hours'-interval '24 hours'),'customer reminder is 24 hours ahead');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='appointment.owner_reminder'),'one owner reminder');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','70000000-0000-4000-8000-000000000006',repeat('9',64),repeat('1',64),repeat('2',64),pg_temp.future_start()+interval '1 day',pg_temp.provider_input(pg_temp.future_start()+interval '1 day'));
select public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','70000000-0000-4000-8000-000000000007',repeat('9',64),repeat('3',64),repeat('4',64),pg_temp.future_start()+interval '2 days',pg_temp.provider_input(pg_temp.future_start()+interval '2 days'));
select public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','70000000-0000-4000-8000-000000000008',repeat('9',64),repeat('5',64),repeat('6',64),pg_temp.future_start()+interval '3 days',pg_temp.provider_input(pg_temp.future_start()+interval '3 days'));
do $$begin begin
 perform public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','70000000-0000-4000-8000-000000000009',repeat('9',64),repeat('7',64),repeat('8',64),pg_temp.future_start()+interval '4 days',pg_temp.provider_input(pg_temp.future_start()+interval '4 days'));
 raise exception 'TEST FAILED unbounded selections from one address';exception when raise_exception then if sqlerrm<>'RATE_LIMITED' then raise;end if;end;end$$;
select public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','70000000-0000-4000-8000-000000000010',repeat('5',64),repeat('8',64),repeat('9',64),pg_temp.future_start()+interval '7 days',pg_temp.provider_input(pg_temp.future_start()+interval '7 days'));
create table pg_temp.decline_result as select public.submit_website_request('20000000-0000-4000-8000-000000000001','website-submit-decline',repeat('5',64),pg_temp.request_input(),jsonb_build_object('mode','weekly','start',pg_temp.future_start()+interval '7 days','tokenHash',repeat('9',64),'browserHash',repeat('8',64)),pg_temp.provider_input(pg_temp.future_start()+interval '7 days')) as value;
grant select on pg_temp.decline_result to authenticated;
reset role;
select pg_temp.assert_true((select count(*)=1 from public.appointments where status='proposal'),'weekly intent holds only the first visit');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.scheduling_command('20000000-0000-4000-8000-000000000001','decline_time',jsonb_build_object('id',(select id from public.appointments where status='proposal'),'revision',2,'reason','Synthetic fixture time unavailable'),'website-decline-time-01');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='appointment.declined_time'),'decline queues one customer decision');
select pg_temp.assert_true(not exists(select 1 from public.resource_reservations rr join public.appointments a on a.organization_id=rr.organization_id and a.id=rr.appointment_id where a.status='declined_time' and rr.active),'decline releases operator capacity');
select pg_temp.assert_true((select count(*)=1 from public.appointments where status='reserved'),'decline leaves separate confirmed visit intact');
rollback;
