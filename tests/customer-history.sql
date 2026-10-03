-- Explicit account relationships, pre-job appointment visibility and revocation. Entire fixture rolls back.
insert into public.catalog_services(organization_id,name,pricing_mode,scope,exclusions)
values('20000000-0000-4000-8000-000000000002','Synthetic category','hourly','Synthetic scope','Synthetic exclusions');
insert into public.service_requests(organization_id,id,service_id,customer_id,original_submission,privacy_version)
select organization_id,'50000000-0000-4000-8000-000000000001',id,'30000000-0000-4000-8000-000000000001','{}','synthetic' from public.catalog_services where organization_id='20000000-0000-4000-8000-000000000001';
insert into public.service_requests(organization_id,id,service_id,customer_id,original_submission,privacy_version)
select organization_id,'50000000-0000-4000-8000-000000000002',id,'30000000-0000-4000-8000-000000000002','{}','synthetic' from public.catalog_services where organization_id='20000000-0000-4000-8000-000000000001';
insert into public.service_requests(organization_id,id,service_id,customer_id,original_submission,privacy_version)
select organization_id,'50000000-0000-4000-8000-000000000003',id,'30000000-0000-4000-8000-000000000003','{}','synthetic' from public.catalog_services where organization_id='20000000-0000-4000-8000-000000000002';
insert into public.appointments(organization_id,request_id,start_at,end_at,arrival_at,timezone,status)
values
('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',now()-interval '2 days',now()-interval '2 days'+interval '2 hours',now()-interval '2 days','America/Chicago','reserved'),
('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',now()+interval '2 days',now()+interval '2 days 2 hours',now()+interval '2 days','America/Chicago','reserved'),
('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002',now()+interval '3 days',now()+interval '3 days 2 hours',now()+interval '3 days','America/Chicago','reserved'),
('20000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003',now()+interval '4 days',now()+interval '4 days 2 hours',now()+interval '4 days','America/Chicago','reserved');
select pg_temp.assert_true((select count(*)=0 from public.jobs),'pre-job history has no jobs');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
select pg_temp.assert_true((select count(*)=2 from public.appointments),'account sees past and future pre-job appointments only');
select pg_temp.assert_true((select count(*)=0 from public.appointments where organization_id='20000000-0000-4000-8000-000000000002'),'customer cannot see other tenant appointments');
select pg_temp.assert_true((select count(*)=0 from public.appointments where request_id='50000000-0000-4000-8000-000000000002'),'customer cannot see unrelated same-company appointment');
reset role;
update public.customer_access set revoked_at=now() where user_id='00000000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.appointments),'revoked account relationship removes history immediately');
reset role;
rollback;
