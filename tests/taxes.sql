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
 perform public.approve_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),1,0,true,'premature-invoice-key');raise exception 'TEST FAILED premature completion';
 exception when raise_exception then if sqlerrm<>'TRANSITION' then raise;end if;end;end$$;
reset role;
-- Scheduling/execution not under test here; explicit fixture establishes their precondition.
update public.jobs set status='working',revision=2;
set local role authenticated;

select public.save_invoice_labor('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),2,'[{"description":"Recorded garden work","recordedMinutes":120,"chargedCents":4500,"waiverReason":""},{"description":"Small extra task","recordedMinutes":15,"chargedCents":0,"waiverReason":"Courtesy"}]','invoice-draft-test-key01');
select public.save_invoice_labor('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),2,'[{"description":"Recorded garden work","recordedMinutes":120,"chargedCents":4500,"waiverReason":""},{"description":"Small extra task","recordedMinutes":15,"chargedCents":0,"waiverReason":"Courtesy"}]','invoice-draft-test-key01');
select public.complete_service_call('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),3,'complete-service-test-key');

select public.tax_command('20000000-0000-4000-8000-000000000001','profile',0,jsonb_build_object('year',2026,'state','IL','entity','individual_calendar','federalAnnualPaymentCents',100001,'stateAnnualPaymentCents',120000,'federalSource','https://www.irs.gov/pub/irs-pdf/f1040es.pdf','stateSource','https://tax.illinois.gov/forms.html','reviewedOn',timezone('America/Chicago',now())::date,'reviewNote','Synthetic worksheet and rules only','rules',jsonb_build_array(jsonb_build_object('id','50000000-0000-4000-8000-000000000001','label','Synthetic labor tax','state','IL','county','DeKalb','city','DeKalb','jurisdictionEvidence','Synthetic exact address verified','scope','Synthetic labor-only rule; not a real Illinois tax decision','effectiveFrom',timezone('America/Chicago',now())::date,'effectiveTo',timezone('America/Chicago',now())::date,'reviewedOn',timezone('America/Chicago',now())::date,'sourceUrl','https://example.invalid/synthetic','reviewed',true,'rounding','component_half_up','components','[{"kind":"state","label":"Synthetic state","ratePpm":62500},{"kind":"county","label":"Synthetic county","ratePpm":12500},{"kind":"city","label":"Synthetic city","ratePpm":5000}]'::jsonb))),'tax-profile-synthetic-001');
do $$begin
 begin perform public.approve_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),4,4500,true,'bypass-tax-synthetic');raise exception 'TEST FAILED bypass';exception when raise_exception then if sqlerrm<>'TAX_REVIEW_REQUIRED' then raise;end if;end;
 begin perform public.approve_taxed_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),4,'50000000-0000-4000-8000-000000000001','Synthetic approval',4500,'wrong-tax-total-001');raise exception 'TEST FAILED stale total';exception when raise_exception then if sqlerrm<>'INVOICE_TOTAL_CHANGED' then raise;end if;end;
end$$;
do $$begin
 begin perform public.tax_command('20000000-0000-4000-8000-000000000001','profile',1,jsonb_set(public.tax_workspace('20000000-0000-4000-8000-000000000001',2026)->'profile'->'data','{rules,0,components,0,ratePpm}','"62500"'::jsonb),'tax-malformed-type01');raise exception 'TEST FAILED numeric string accepted';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
end$$;
select pg_temp.assert_true((select revision=4 from public.jobs),'failed combined approval rolls back tax review revision');
select public.approve_taxed_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),4,'50000000-0000-4000-8000-000000000001','Synthetic accepted total plus exact address review',4860,'tax-invoice-issue-001');
select public.approve_taxed_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),4,'50000000-0000-4000-8000-000000000001','Synthetic accepted total plus exact address review',4860,'tax-invoice-issue-001');
select pg_temp.assert_true((select count(*)=1 and max(total_cents)=4860 from public.invoices),'one taxed invoice on replay');
select pg_temp.assert_true((select snapshot->>'taxCents'='360' and snapshot->'tax'->>'subtotalCents'='4500' and jsonb_array_length(snapshot->'tax'->'components')=3 from public.invoices),'components and base frozen');
select pg_temp.assert_true((select sum(credit_cents)=360 from public.journal_lines where account='tax_payable'),'sales tax separate from revenue');
select pg_temp.assert_true((select sum(credit_cents)=4500 from public.journal_lines where account='labor_revenue'),'labor revenue excludes tax');
select public.record_payment('20000000-0000-4000-8000-000000000001',(select id from public.invoices limit 1),1000,'cash','Synthetic cash portion',now(),true,'tax-cash-portion-001');
select public.record_payment('20000000-0000-4000-8000-000000000001',(select id from public.invoices limit 1),2000,'zelle','Synthetic Zelle portion',now(),true,'tax-zelle-portion-001');
select pg_temp.assert_true((select total_cents-(select sum(cents) from public.payments)=1860 from public.invoices),'mixed partial payments exact balance');
select pg_temp.assert_true((select sum(debit_cents::bigint-credit_cents)=0 from public.journal_lines),'tax invoice and partial-payment ledger balanced');
select public.tax_command('20000000-0000-4000-8000-000000000001','payment',1,jsonb_build_object('year',2026,'kind','federal_estimated','label','Synthetic IRS','period','2026 installment 1','date',timezone('America/Chicago',now())::date,'amountCents',1000,'sourceUrl','https://www.irs.gov/pub/irs-pdf/f1040es.pdf','paymentUrl','https://www.irs.gov/payments','reference','Synthetic confirmation','reviewed',true,'deadlineId','federal_estimated:2026:1'),'tax-payment-synthetic');
select pg_temp.assert_true((select jsonb_array_length(public.tax_workspace('20000000-0000-4000-8000-000000000001',2026)->'records')=1),'confirmed tax payment stored');
do $$begin
 begin perform public.tax_workspace('20000000-0000-4000-8000-000000000002',2026);raise exception 'TEST FAILED cross tenant';exception when insufficient_privilege then null;end;
 begin perform public.tax_command('20000000-0000-4000-8000-000000000001','payment',0,'{}','tax-payment-stale001');raise exception 'TEST FAILED profile race';exception when raise_exception then if sqlerrm<>'TAX_PROFILE_CHANGED' then raise;end if;end;
end$$;

reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.stripe_store('20000000-0000-4000-8000-000000000001',null,'merchant','{"accountId":"acct_synthetic"}');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.prepare_card_payment('20000000-0000-4000-8000-000000000001',(select id from public.invoices limit 1),1860,'acct_synthetic');
do $$begin
 begin perform public.record_payment('20000000-0000-4000-8000-000000000001',(select id from public.invoices limit 1),1860,'cash','Synthetic unsafe duplicate',now(),true,'pending-card-cash01');raise exception 'TEST FAILED cash while card pending';exception when raise_exception then if sqlerrm<>'CARD_PAYMENT_PENDING' then raise;end if;end;
 begin perform public.stripe_store('20000000-0000-4000-8000-000000000001',null,'merchant','{"accountId":"acct_forged"}');raise exception 'TEST FAILED staff provider forge';exception when insufficient_privilege then null;end;
end$$;
select public.manage_invoice('20000000-0000-4000-8000-000000000001',(select id from public.invoices limit 1),0,timezone('America/Chicago',now())::date,true,'Synthetic archive and agreed due date','invoice-admin-test01');
select pg_temp.assert_true((public.invoice_payment_context('20000000-0000-4000-8000-000000000001',(select id from public.invoices limit 1))->'admin'->>'archived')::boolean,'archive preserves document');
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
reset role;
-- Capture the private synthetic order as test administrator before service-only processing.
select set_config('test.card_order',(select id::text from private.card_orders),true);
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.stripe_store('20000000-0000-4000-8000-000000000001',current_setting('test.card_order')::uuid,'session','{"accountId":"acct_synthetic","sessionId":"cs_live_synthetic","url":"https://checkout.stripe.com/c/pay/synthetic"}');
select public.stripe_store('20000000-0000-4000-8000-000000000001',current_setting('test.card_order')::uuid,'payment',jsonb_build_object('accountId','acct_synthetic','sessionId','cs_live_synthetic','providerId','ch_synthetic','chargeId','ch_synthetic','paymentIntent','pi_synthetic','amountCents',1860,'feeCents',86,'netCents',1774,'currency','usd','occurredAt',now()));
select public.stripe_store('20000000-0000-4000-8000-000000000001',current_setting('test.card_order')::uuid,'payment',jsonb_build_object('accountId','acct_synthetic','sessionId','cs_live_synthetic','providerId','ch_synthetic','chargeId','ch_synthetic','paymentIntent','pi_synthetic','amountCents',1860,'feeCents',86,'netCents',1774,'currency','usd','occurredAt',now()));
select public.stripe_store('20000000-0000-4000-8000-000000000001',current_setting('test.card_order')::uuid,'refund',jsonb_build_object('accountId','acct_synthetic','providerId','re_synthetic','chargeId','ch_synthetic','amountCents',-400,'feeCents',0,'netCents',-400,'currency','usd','occurredAt',now()));
select public.stripe_store('20000000-0000-4000-8000-000000000001',current_setting('test.card_order')::uuid,'refund',jsonb_build_object('accountId','acct_synthetic','providerId','re_synthetic','chargeId','ch_synthetic','amountCents',-400,'feeCents',0,'netCents',-400,'currency','usd','occurredAt',now()));
reset role;
select pg_temp.assert_true((select sum(cents)=4460 and count(*)=4 from public.payments),'mixed cash Zelle card and partial refund recorded exactly once');
select pg_temp.assert_true((select sum(debit_cents::bigint-credit_cents)=0 from public.journal_lines),'all mixed-payment and refund entries balanced');
select pg_temp.assert_true((select sum(debit_cents-credit_cents)=1374 from public.journal_lines where account='stripe_clearing'),'Stripe clearing reflects actual net, not bank cash');
select pg_temp.assert_true((select total_cents=4860 from public.invoices),'archive and refund do not edit issued amount');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select pg_temp.assert_true((public.finance_activity('20000000-0000-4000-8000-000000000001',timezone('America/Chicago',now())::date,timezone('America/Chicago',now())::date)->>'cardFeeCents')::integer=86,'actual card fees in report');
reset role;
select 'PASS: reviewed tax rules, atomic invoice issue, tax liability, mixed payments, isolation and stale profile' as evidence;
set constraints all immediate;rollback;
