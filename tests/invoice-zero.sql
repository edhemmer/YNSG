-- Run after fixture prefix from foundation.sql; everything rolls back.
update public.catalog_services set compliance='approved',pricing_mode='hourly';
insert into public.entitlements values('20000000-0000-4000-8000-000000000001','finance',true);
insert into public.configuration_versions(organization_id,version,settings) values('20000000-0000-4000-8000-000000000001',2,
 '{"intakeEnabled":true,"cities":["DeKalb"],"region":"IL","privacyVersion":"test-only","notificationRecipient":"owner@example.invalid","hourly":{"standardCents":6000,"communityCents":4500},"policyVersion":"synthetic-1","sellerVerified":true,"sellerLegalName":"SYNTHETIC TEST ONLY","taxTreatmentVerified":true,"laborTaxTreatment":"reviewed_non_taxable","invoiceTerms":"Synthetic test only"}');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.submit_service_request('20000000-0000-4000-8000-000000000001','test-commercial-01',repeat('a',64),'{"service":"Lawn care","name":"Synthetic Test","phone":"5550000000","email":"test@example.invalid","street":"100 Test Street","city":"DeKalb","description":"Synthetic integration request","communityRate":"Yes"}');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.review_service_request('20000000-0000-4000-8000-000000000001',(select id from public.service_requests limit 1),1,'reviewing','test-commercial-review');
select public.publish_hourly_quote('20000000-0000-4000-8000-000000000001',(select id from public.service_requests limit 1),2,'Synthetic hourly scope for testing',120,false,false,null,'test-commercial-quote1');
select public.publish_hourly_quote('20000000-0000-4000-8000-000000000001',(select id from public.service_requests limit 1),3,'Revised synthetic hourly scope',180,true,true,null,'test-commercial-quote2');
select pg_temp.assert_true((select count(*)=2 from public.quote_versions),'commercial versions retained');
select pg_temp.assert_true((select labor_cents=13500 from public.quote_versions where version=2),'Community three-hour quote');
do $$begin begin
 perform public.approve_quote('20000000-0000-4000-8000-000000000001',(select id from public.quotes limit 1),1,'Synthetic stale approval');raise exception 'TEST FAILED stale quote approval';
 exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;end$$;
select public.approve_quote('20000000-0000-4000-8000-000000000001',(select id from public.quotes limit 1),2,'Synthetic recorded approval for test only');
select public.approve_quote('20000000-0000-4000-8000-000000000001',(select id from public.quotes limit 1),2,'Synthetic recorded approval for test only');
select pg_temp.assert_true((select count(*)=1 from public.jobs),'approval retry creates one job');
do $$begin begin
 perform public.complete_and_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),1);raise exception 'TEST FAILED premature completion';
 exception when raise_exception then if sqlerrm<>'TRANSITION' then raise;end if;end;end$$;
reset role;
-- Scheduling/execution not under test here; explicit fixture establishes their precondition.
update public.jobs set status='working',revision=2;
set local role authenticated;

select public.save_invoice_labor('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),2,'[{"description":"Recorded garden work","recordedMinutes":120,"chargedCents":0,"waiverReason":"Courtesy"},{"description":"Small extra task","recordedMinutes":15,"chargedCents":0,"waiverReason":"Courtesy"}]','invoice-draft-test-key01');
select public.save_invoice_labor('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),2,'[{"description":"Recorded garden work","recordedMinutes":120,"chargedCents":0,"waiverReason":"Courtesy"},{"description":"Small extra task","recordedMinutes":15,"chargedCents":0,"waiverReason":"Courtesy"}]','invoice-draft-test-key01');
select public.complete_and_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),3);
select pg_temp.assert_true((select total_cents=0 from public.invoices),'invoice uses reviewed reduced labor');
select pg_temp.assert_true((select snapshot->'recordedWork'->1->>'chargedCents'='0' from public.invoices),'unbilled work remains recorded');
select pg_temp.assert_true((select snapshot->>'approvedLaborCents'='13500' from public.invoices),'original approved labor retained');
select pg_temp.assert_true((select count(*)=0 from public.journal_entries),'zero invoice needs no artificial financial posting');
do $$begin begin perform public.save_invoice_labor('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),4,'[{"description":"Changed issued work","recordedMinutes":120,"chargedCents":0,"waiverReason":"Changed"}]','invoice-draft-test-key02');raise exception 'TEST FAILED issued invoice changed';exception when raise_exception then if sqlerrm<>'TRANSITION' then raise;end if;end;end$$;
reset role;set constraints all immediate;rollback;
