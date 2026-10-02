-- Run with foundation fixture prefix. Synthetic records, rollback after all assertions.
insert into public.entitlements values('20000000-0000-4000-8000-000000000001','scheduling',true);
insert into private.schedule_state values('20000000-0000-4000-8000-000000000001',1);
insert into public.configuration_versions(organization_id,version,settings) values('20000000-0000-4000-8000-000000000001',2,
 '{"timezone":"America/Chicago","notificationRecipient":"owner@example.invalid","sender":"owner@example.invalid","scheduling":{"weekdays":[1,2,3,4,5],"earliestStart":480,"latestStart":900,"endOfDay":1020,"bufferMinutes":15,"leadMinutes":0,"horizonDays":90,"selectionMinutes":10,"proposalMinutes":120,"pendingLimit":2}}');
insert into public.resources(organization_id,id,name,kind) values
 ('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Synthetic operator','operator'),
 ('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','Synthetic second operator','operator');
insert into public.service_requests(organization_id,id,service_id,original_submission,privacy_version) select
 '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',id,'{}','test-only' from public.catalog_services;
-- Dynamic next Monday uses business timezone; calendar arithmetic is independent of current weekday.
create function pg_temp.future_start() returns timestamptz language sql as $$ select ((date_trunc('week',now() at time zone 'America/Chicago')+interval '14 days 8 hours') at time zone 'America/Chicago') $$;
-- Test-only provider fixture: real providers do not yet generate this evidence.
create function pg_temp.fact(shift_minutes integer,resource_number integer default 1) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 insert into private.schedule_evidence(organization_id,request_id,configuration_version,schedule_revision,start_at,end_at,arrival_at,resources,valid_until,scope_reviewed,travel_verified,pickup_verified,google_busy_verified,provider_references)
 values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',2,
 (select revision from private.schedule_state where organization_id='20000000-0000-4000-8000-000000000001'),
 pg_temp.future_start()+make_interval(mins=>shift_minutes),pg_temp.future_start()+make_interval(mins=>shift_minutes+120),pg_temp.future_start()+make_interval(mins=>shift_minutes),
 array[('40000000-0000-4000-8000-00000000000'||resource_number)::uuid],now()+interval '1 hour',true,true,true,true,'{"source":"test-fixture-only"}') returning id into result;
 return result;
end$$;
create function pg_temp.hold(shift_minutes integer,key_text text,replaces uuid default null,resource_number integer default 1) returns jsonb language sql as $$
 select public.scheduling_command('20000000-0000-4000-8000-000000000001','hold',jsonb_build_object('requestId','50000000-0000-4000-8000-000000000001','evidenceId',pg_temp.fact(shift_minutes,resource_number),'replacesId',replaces),key_text)
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select pg_temp.hold(0,'scheduler-first-hold');
select pg_temp.assert_true((select count(*)=1 from public.resource_reservations where active),'hold reserves physical capacity');
do $$begin begin perform pg_temp.hold(30,'scheduler-overlap-01');raise exception 'TEST FAILED overlap allowed';exception when exclusion_violation then null;end;end$$;
select pg_temp.hold(30,'scheduler-other-resource',null,2);
select pg_temp.assert_true((select count(*)=2 from public.resource_reservations where active),'independent resource allowed');
select public.scheduling_command('20000000-0000-4000-8000-000000000001','decline_time',jsonb_build_object('id',(select id from public.appointments order by start_at desc limit 1),'revision',1,'reason','Synthetic declined time'),'scheduler-decline-01');
select pg_temp.assert_true((select count(*)=1 from public.resource_reservations where active),'decline releases only selected time');
select public.scheduling_command('20000000-0000-4000-8000-000000000001','submit',jsonb_build_object('id',(select id from public.appointments where status='held'),'revision',1),'scheduler-submit-01');
select public.scheduling_command('20000000-0000-4000-8000-000000000001','submit',jsonb_build_object('id',(select id from public.appointments where status='proposal'),'revision',1),'scheduler-submit-01');
select pg_temp.assert_true((select count(*)=1 from public.appointment_tasks where kind='owner_approval'),'submit retry one approval task');
select public.scheduling_command('20000000-0000-4000-8000-000000000001','approve',jsonb_build_object('id',(select id from public.appointments where status='proposal'),'revision',2,'evidenceId',pg_temp.fact(0)),'scheduler-approve-01');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='appointment.reminder'),'one reminder');
select pg_temp.assert_true((select next_attempt_at=pg_temp.future_start()-interval '24 hours' from public.outbox where kind='appointment.reminder'),'24 elapsed hours before arrival');
select pg_temp.hold(240,'scheduler-alternative',(select id from public.appointments where status='reserved'));
select pg_temp.assert_true((select count(*)=2 from public.resource_reservations where active),'alternative retains original capacity');
select public.scheduling_command('20000000-0000-4000-8000-000000000001','submit',jsonb_build_object('id',(select id from public.appointments where status='held'),'revision',1),'scheduler-submit-02');
select public.scheduling_command('20000000-0000-4000-8000-000000000001','approve',jsonb_build_object('id',(select id from public.appointments where status='proposal'),'revision',2,'evidenceId',pg_temp.fact(240)),'scheduler-approve-02');
select pg_temp.assert_true((select count(*)=1 from public.resource_reservations where active),'replacement swaps reservations');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='appointment.reminder' and status='suppressed'),'old reminder suppressed');
select pg_temp.assert_true((select count(*)=1 from public.appointments where status='reserved'),'one confirmed appointment');
do $$begin begin
 perform public.scheduling_command('20000000-0000-4000-8000-000000000001','decline_time',jsonb_build_object('id',(select id from public.appointments where status='reserved'),'revision',2,'reason','Stale owner link'),'scheduler-stale-01');raise exception 'TEST FAILED stale revision';exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;
end$$;
-- Expired alternatives release only their own capacity during the next valid engine decision.
select pg_temp.hold(0,'scheduler-expire-hold',(select id from public.appointments where status='reserved'));
reset role;
update public.appointments set expires_at=now()-interval '1 minute' where status='held';
set local role authenticated;
select pg_temp.hold(0,'scheduler-expire-reuse',(select id from public.appointments where status='reserved'));
select pg_temp.assert_true((select count(*)=1 from public.appointments where status='expired'),'expired selection retained as history');
select pg_temp.assert_true((select count(*)=2 from public.resource_reservations where active),'expired capacity reused with original retained');
do $$begin begin
 perform public.reserve_appointment('20000000-0000-4000-8000-000000000001',gen_random_uuid(),pg_temp.future_start(),pg_temp.future_start()+interval '2 hours','America/Chicago','scheduler-old-bypass');raise exception 'TEST FAILED legacy bypass';exception when raise_exception then if sqlerrm<>'SCHEDULER_UPGRADE_REQUIRED' then raise;end if;end;
end$$;
select pg_temp.assert_true((select count(*)=0 from public.claim_outbox('20000000-0000-4000-8000-000000000001',25)),'disabled provider leases no work');
reset role;
update public.organizations set status='active' where id='20000000-0000-4000-8000-000000000001';
insert into private.google_accounts(organization_id,revision,encrypted_tokens,email,subject,scopes,gmail_test,test_key) values('20000000-0000-4000-8000-000000000001',1,'synthetic-not-real','owner@example.invalid','synthetic-subject',array['https://www.googleapis.com/auth/gmail.send'],'accepted','90000000-0000-4000-8000-000000000001');
insert into private.mail_delivery_controls(organization_id,enabled,account_subject,test_key,configuration_version,receipt_confirmed_at,receipt_confirmed_by) values('20000000-0000-4000-8000-000000000001',true,'synthetic-subject','90000000-0000-4000-8000-000000000001',2,now(),'00000000-0000-4000-8000-000000000001');
insert into public.integration_connections(organization_id,provider,status,secret_ref) values('20000000-0000-4000-8000-000000000001','gmail','active','synthetic-not-a-real-secret');
set local role authenticated;
select id from public.claim_outbox('20000000-0000-4000-8000-000000000001',25);
select public.begin_delivery('20000000-0000-4000-8000-000000000001',id,lease_token) from public.outbox where status='leased';
reset role;
-- Simulate remote acceptance followed by process crash: no safe evidence of delivery available.
update public.outbox set lease_until=now()-interval '1 second' where status='sending';
set local role authenticated;
select id from public.claim_outbox('20000000-0000-4000-8000-000000000001',25);
select pg_temp.assert_true((select count(*)>=1 from public.outbox where status='needs_reconciliation'),'sending crash becomes uncertain, not retryable');
select pg_temp.assert_true((select count(*)=0 from public.delivery_attempts where status='started'),'crashed attempt records unknown');
select pg_temp.assert_true((select count(*)=0 from public.outbox where status='leased' and kind='calendar.upsert'),'calendar tasks not passed to Gmail worker');
reset role;
-- Force deferred integrity checks; a transaction must not commit a capacity-free booking.
set constraints all immediate;
do $$begin begin
 delete from public.resource_reservations where active;
 raise exception 'TEST FAILED removed active capacity';
 exception when raise_exception then if sqlerrm<>'APPOINTMENT_CAPACITY_REQUIRED' then raise;end if;end;
end$$;
select 'PASS: selection, overlap, resources, proposal, approval, reminder, replacement, expiry, legacy bypass and ambiguous-send assertions' as evidence;
-- Minute-precision horizon: evaluate with a synthetic clock, never wall-clock weekday assumptions.
insert into public.configuration_versions(organization_id,version,settings)
select organization_id,3,jsonb_set(settings,'{scheduling}',((settings->'scheduling')-'horizonDays')||'{"leadMinutes":1440,"horizonMinutes":2160}')
from public.configuration_versions where organization_id='20000000-0000-4000-8000-000000000001' and version=2;
do $$declare fact uuid;begin
 fact:=pg_temp.fact(0);
 update private.schedule_evidence set configuration_version=3,valid_until=pg_temp.future_start()+interval '1 hour' where id=fact;
 perform private.assert_schedule_evidence('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',fact,pg_temp.future_start()-interval '30 hours');
 begin
  perform private.assert_schedule_evidence('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',fact,pg_temp.future_start()-interval '37 hours');
  raise exception 'TEST FAILED beyond 36-hour horizon';
 exception when raise_exception then if sqlerrm<>'OUTSIDE_BOOKING_WINDOW' then raise;end if;end;
 begin
  perform private.assert_schedule_evidence('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',fact,pg_temp.future_start()-interval '23 hours');
  raise exception 'TEST FAILED below 24-hour notice';
 exception when raise_exception then if sqlerrm<>'OUTSIDE_BOOKING_WINDOW' then raise;end if;end;
end$$;
rollback;
