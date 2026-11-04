-- Synthetic owner-agreed quotes only. Independently tests single-action job creation and replay.
insert into public.configuration_versions(organization_id,version,settings) values
 ('20000000-0000-4000-8000-000000000001',2,'{"region":"IL","policyVersion":"test-only","hourly":{"standardCents":6000,"communityCents":4500},"sellerLegalName":"Synthetic test","invoiceTerms":"Due on completion"}');
update public.catalog_services set compliance='approved';
create table pg_temp.quote_request(id uuid);
grant all on pg_temp.quote_request to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
insert into pg_temp.quote_request
 select (public.create_owner_request('20000000-0000-4000-8000-000000000001',
 jsonb_build_object('name','Synthetic quote customer','phone','','email','','street','100 Synthetic Way','city','DeKalb','state','IL','postalCode','60115',
 'serviceId',(select id from public.catalog_services limit 1),'description','Synthetic quoted lawn and leaf service'),
 'owner-quote-entry-key-00000001')->>'id')::uuid;
create table pg_temp.quote_job_result(result jsonb);
grant all on pg_temp.quote_job_result to authenticated;
insert into pg_temp.quote_job_result
 select public.save_agreed_quote_and_prepare_job('20000000-0000-4000-8000-000000000001',
 (select id from pg_temp.quote_request limit 1),1,'Synthetic agreed leaf cleanup and lawn work',90,false,false,null,
 'test-agreed-job-key-00000001',1,null,null);
select pg_temp.assert_true((select count(*)=1 from public.quotes where status='accepted'),'agreed quote and job saved together');
select pg_temp.assert_true((select count(*)=1 from public.jobs where status='approved'),'one ready job from one quote save');
select pg_temp.assert_true((select count(*)=1 from public.approvals),'one evidence record from the single action');
select pg_temp.assert_true((select count(*)=0 from public.invoices),'job prep does not auto invoice');
select pg_temp.assert_true((select (result->>'jobId')::uuid=(select id from public.jobs limit 1) from pg_temp.quote_job_result),'RPC returns actual prepared job');
select pg_temp.assert_true(
 (select (public.save_agreed_quote_and_prepare_job('20000000-0000-4000-8000-000000000001',
 (select id from pg_temp.quote_request limit 1),1,'Synthetic agreed leaf cleanup and lawn work',90,false,false,null,
 'test-agreed-job-key-00000001',1,null,null)->>'jobId')::uuid=(select id from public.jobs limit 1)),
 'retry cannot generate a second job');
select pg_temp.assert_true((select count(*)=1 from public.jobs),'replay remains one job');
select pg_temp.assert_true(
 (select (public.prepare_agreed_quote_job('20000000-0000-4000-8000-000000000001',
 (select id from public.quotes limit 1),1)->>'id')::uuid=(select id from public.jobs limit 1)),
 'preparation of existing agreed quote is idempotent');
reset role;
rollback;
