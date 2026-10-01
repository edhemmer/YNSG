-- Synthetic fixtures only. Entire test transaction is rolled back, including auth fixtures.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'TEST FAILED: %',label;end if;end$$;
insert into auth.users(id,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000001',now()),('00000000-0000-4000-8000-000000000002',now()),
 ('00000000-0000-4000-8000-000000000003',now()),('00000000-0000-4000-8000-000000000004',now());
insert into auth.sessions(id,user_id,aal) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','aal2'),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','aal2'),
 ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003','aal1'),
 ('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000004','aal1');
insert into public.organizations(id,slug,display_name,timezone) values
 ('20000000-0000-4000-8000-000000000001','test-one','Synthetic One','America/Chicago'),
 ('20000000-0000-4000-8000-000000000002','test-two','Synthetic Two','America/Los_Angeles');
insert into public.memberships(organization_id,user_id,role) values
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner'),
 ('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','owner');
insert into public.entitlements values('20000000-0000-4000-8000-000000000001','crm',true);
insert into public.configuration_versions(organization_id,version,settings) values
 ('20000000-0000-4000-8000-000000000001',1,'{"intakeEnabled":true,"cities":["DeKalb"],"privacyVersion":"test-only","notificationRecipient":"owner@example.invalid"}');
insert into public.customers(organization_id,id,display_name) values
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Customer One'),
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','Customer Two'),
 ('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','Other Tenant');
insert into public.customer_access(organization_id,customer_id,user_id) values
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003'),
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004');
insert into public.catalog_services(organization_id,name,pricing_mode,scope,exclusions) values
 ('20000000-0000-4000-8000-000000000001','Lawn care','starting','test','test');

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.submit_service_request('20000000-0000-4000-8000-000000000001','test-request-key-01',repeat('a',64),'{"service":"Lawn care","name":"Synthetic Test","phone":"5550000000","email":"test@example.invalid","street":"100 Test Street","city":"DeKalb","description":"Synthetic integration request","communityRate":"No"}');
select public.submit_service_request('20000000-0000-4000-8000-000000000001','test-request-key-01',repeat('a',64),'{"service":"Lawn care","name":"Synthetic Test","phone":"5550000000","email":"test@example.invalid","street":"100 Test Street","city":"DeKalb","description":"Synthetic integration request","communityRate":"No"}');
do $$begin
 begin
 perform public.submit_service_request('20000000-0000-4000-8000-000000000001','test-request-key-01',repeat('a',64),'{"service":"Lawn care","name":"Changed Test","phone":"5550000000","email":"test@example.invalid","street":"100 Test Street","city":"DeKalb","description":"Synthetic integration request","communityRate":"No"}');
 raise exception 'TEST FAILED changed payload accepted';
 exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;
end $$;
reset role;
select pg_temp.assert_true((select count(*)=1 from public.service_requests),'one durable request on retry');
select pg_temp.assert_true((select count(*)=1 from public.outbox),'one owner notification intent');
select pg_temp.assert_true((select count(*)=1 from public.audit_events),'one audit event');
select pg_temp.assert_true((select count(*)=0 from public.memberships where user_id='00000000-0000-4000-8000-000000000003'),'guest does not acquire staff identity');

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select pg_temp.assert_true((select count(*)=1 from public.organizations),'owner cannot see other tenant');
select pg_temp.assert_true((select count(*)=2 from public.customers),'owner sees only own customers');
select public.review_service_request('20000000-0000-4000-8000-000000000001',(select id from public.service_requests limit 1),1,'reviewing','test-review-key-0001');
select public.review_service_request('20000000-0000-4000-8000-000000000001',(select id from public.service_requests limit 1),1,'reviewing','test-review-key-0001');
do $$begin begin
 perform public.review_service_request('20000000-0000-4000-8000-000000000001',(select id from public.service_requests limit 1),1,'declined','test-review-key-0002');
 raise exception 'TEST FAILED stale revision accepted';
 exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;end $$;
select pg_temp.assert_true((select revision=2 from public.service_requests limit 1),'review replay keeps revision');
do $$begin begin update public.entitlements set enabled=false;raise exception 'TEST FAILED direct write';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","aal":"aal1","user_metadata":{"role":"owner"}}',true);
select pg_temp.assert_true((select count(*)=1 from public.customers),'customer sees own explicit relationship only');
select pg_temp.assert_true((select count(*)=0 from public.service_requests),'unlinked request not claimed by email');
select pg_temp.assert_true(not private.customer_allowed('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true,true),'delegate lacks billing/approval by default');
select pg_temp.assert_true((select count(*)=0 from public.outbox),'customer cannot read internal notification');
reset role;
update public.memberships set revoked_at=now() where user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select pg_temp.assert_true((select count(*)=0 from public.customers),'stale token cannot bypass revoked membership');
reset role;
delete from auth.sessions where id='10000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
select pg_temp.assert_true((select count(*)=0 from public.customers),'deleted session immediately loses access');
reset role;
do $$begin begin
 insert into public.properties(organization_id,customer_id,street,city,region) values('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','100 Test St','Test','IL');
 raise exception 'TEST FAILED cross-tenant foreign key';exception when foreign_key_violation then null;end;end$$;
select 'PASS: foundation assertions; transaction rolled back' as evidence;
rollback;
