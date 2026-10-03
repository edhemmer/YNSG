-- Synthetic requests only; no provider I/O.
insert into public.service_requests(organization_id,id,service_id,original_submission,privacy_version)
select '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',id,'{"name":"Synthetic Customer","email":"customer@example.invalid"}','test-only' from public.catalog_services;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.review_service_request('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',1,'declined','decline-request-retry-01');
select public.review_service_request('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',1,'declined','decline-request-retry-01');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='request.declined'),'one durable decline on replay');
select pg_temp.assert_true((select count(*)=1 from public.audit_events where action='request.declined'),'one decline audit on replay');
reset role;
select pg_temp.assert_true((select private.request_notice_current(organization_id,id) from public.outbox where kind='request.declined'),'current request decline is sendable');
update public.service_requests set revision=revision+1;
select pg_temp.assert_true((select not private.request_notice_current(organization_id,id) from public.outbox where kind='request.declined'),'stale decline is suppressed');
update public.service_requests set status='reviewing';
insert into public.appointments(organization_id,id,request_id,start_at,end_at,arrival_at,timezone,status,created_by)
values('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',now()+interval '2 days',now()+interval '2 days 2 hours',now()+interval '2 days','America/Chicago','reserved','00000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$begin begin perform public.review_service_request('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',3,'declined','decline-booked-request-01');raise exception 'TEST FAILED active appointment decline';exception when raise_exception then if sqlerrm<>'APPOINTMENT_DECISION_REQUIRED' then raise;end if;end;end$$;
select pg_temp.assert_true((select status='reserved' from public.appointments),'manual decline preserves booked appointment');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
do $$begin begin perform public.review_service_request('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',3,'declined','decline-cross-tenant-01');raise exception 'TEST FAILED tenant denial';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
