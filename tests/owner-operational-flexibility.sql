-- Synthetic owner-led walk-up and retrospective work. No real recipients.
insert into public.entitlements values('20000000-0000-4000-8000-000000000001','finance',true);
insert into public.configuration_versions(organization_id,version,settings) values('20000000-0000-4000-8000-000000000001',2,
'{"region":"IL","privacyVersion":"test-only","policyVersion":"test-only","hourly":{"standardCents":6000,"communityCents":4500},"sellerVerified":true,"sellerLegalName":"SYNTHETIC ONLY","taxTreatmentVerified":true,"laborTaxTreatment":"reviewed_non_taxable","invoiceTerms":"Due on receipt","notificationRecipient":"owner@example.invalid"}');
update public.catalog_services set compliance='approved',pricing_mode='quote';
create table pg_temp.owner_flex_results(request jsonb,work jsonb);
grant all on pg_temp.owner_flex_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
insert into pg_temp.owner_flex_results(request) select public.create_owner_request('20000000-0000-4000-8000-000000000001',jsonb_build_object('name','Synthetic walk-up','phone','','email','','street','100 Test Street','city','Naperville','state','IL','postalCode','60540','serviceId',(select id from public.catalog_services limit 1),'description','Actual leaf management performed'),'owner-walkup-create-01');
select pg_temp.assert_true((select count(*)=1 from public.service_requests),'owner creates job outside marketing cities with no email/phone');
select pg_temp.assert_true((select count(*)=0 from public.outbox),'owner intake sends no customer email');
-- Capture the actual work even before a price/approval is known.
update pg_temp.owner_flex_results set work=public.record_owner_work('20000000-0000-4000-8000-000000000001',(request->>'id')::uuid,1,date_trunc('minute',now())-interval '2 hours',date_trunc('minute',now())-interval '1 hour','Actual leaf management performed',null,null,'owner-work-only-01');
select pg_temp.assert_true(public.owner_work_record('20000000-0000-4000-8000-000000000001',(select (request->>'id')::uuid from pg_temp.owner_flex_results))->>'description'='Actual leaf management performed','actual work remains readable');
select pg_temp.assert_true((select count(*)=0 from public.approvals) and (select count(*)=0 from public.jobs) and (select count(*)=0 from public.invoices),'work capture invents no agreement, job approval or invoice');
-- Replay returns the original result even though the request revision advanced.
select public.record_owner_work('20000000-0000-4000-8000-000000000001',(select (request->>'id')::uuid from pg_temp.owner_flex_results),1,date_trunc('minute',now())-interval '2 hours',date_trunc('minute',now())-interval '1 hour','Actual leaf management performed',null,null,'owner-work-only-01');
-- Real explicit synthetic agreement can be captured alongside the work, then billed.
update pg_temp.owner_flex_results set work=public.record_owner_work('20000000-0000-4000-8000-000000000001',(request->>'id')::uuid,2,date_trunc('minute',now())-interval '2 hours',date_trunc('minute',now())-interval '1 hour','Actual leaf management performed',6000,'Synthetic customer agreed in person to one hour at $60.','owner-work-with-price-01');
select pg_temp.assert_true((select count(*)=0 from public.appointments),'retrospective work does not fabricate an appointment');
select pg_temp.assert_true((select count(*)=1 from public.jobs where status='completed'),'actual completed job saved');
select pg_temp.assert_true((select duration_minutes=60 and labor_cents=6000 and snapshot->'crew'->>'billingBasis'='per_person_actual' from public.quote_versions),'one-hour charge is not forced to two hours');
select pg_temp.assert_true((select count(*)=1 from public.work_sessions where ended_at-started_at=interval '1 hour'),'real closed work session retained');
select pg_temp.assert_true((select count(*)=0 from public.invoices) and (select count(*)=0 from public.payments),'recording work never issues a bill or invents money');
select pg_temp.assert_true(public.field_job_clock('20000000-0000-4000-8000-000000000001',(select (work->>'jobId')::uuid from pg_temp.owner_flex_results))->>'closedSeconds'='3600','recorded work feeds canonical time reporting');
select public.approve_invoice('20000000-0000-4000-8000-000000000001',(select (work->>'jobId')::uuid from pg_temp.owner_flex_results),(select revision from public.jobs limit 1),6000,true,'owner-work-invoice-01');
select pg_temp.assert_true((select count(*)=1 from public.invoices where total_cents=6000),'actual completed work can be invoiced');
-- Live tenant permissions also protect retries and private work reads.
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
do $$begin begin perform public.owner_work_record('20000000-0000-4000-8000-000000000001',(select (request->>'id')::uuid from pg_temp.owner_flex_results));raise exception 'TEST FAILED cross-tenant work';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
