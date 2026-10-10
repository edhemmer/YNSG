-- Run after fixture prefix from foundation.sql; everything rolls back.
update public.catalog_services set compliance='approved',pricing_mode='hourly';
insert into public.entitlements values('20000000-0000-4000-8000-000000000001','finance',true);
insert into public.configuration_versions(organization_id,version,settings) values('20000000-0000-4000-8000-000000000001',2,
 '{"intakeEnabled":true,"cities":["DeKalb"],"region":"IL","privacyVersion":"test-only","notificationRecipient":"owner@example.invalid","hourly":{"standardCents":6000,"communityCents":4500},"policyVersion":"synthetic-1","sellerVerified":true,"sellerLegalName":"SYNTHETIC TEST ONLY","taxTreatmentVerified":true,"laborTaxTreatment":"reviewed_non_taxable","invoiceTerms":"Synthetic test only","displayName":"Synthetic Company","sender":"owner@example.invalid","review":{"enabled":true,"url":"https://example.invalid/review"}}');
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
select public.complete_service_call('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),2,'complete-service-test-key');
select public.save_invoice_labor('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),3,'[{"description":"Synthetic recorded work","recordedMinutes":120,"chargedCents":13500,"waiverReason":""}]','saved-approval-draft-key');
select public.approve_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),4,13500,true,'approved-invoice-key');
select public.approve_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),4,13500,true,'approved-invoice-key');
select pg_temp.assert_true((select count(*)=1 from public.invoices),'one authoritative invoice');
select pg_temp.assert_true((select number/1000000=to_char(now() at time zone 'UTC','YYYYMM')::bigint and number%1000000=1 from public.invoices limit 1),'monthly first invoice and idempotent retry');
reset role;
select pg_temp.assert_true(private.next_monthly_invoice_number('20000000-0000-4000-8000-000000000001',now(),'UTC')=(select number+1 from public.invoices limit 1),'existing monthly invoice advances sequence');
select pg_temp.assert_true(private.next_monthly_invoice_number('20000000-0000-4000-8000-000000000002','2027-01-01T00:30Z','America/Chicago')=202612000001,'seller local year boundary');
select pg_temp.assert_true(private.next_monthly_invoice_number('20000000-0000-4000-8000-000000000002','2027-01-01T06:30Z','America/Chicago')=202701000001,'new year resets sequence');
select pg_temp.assert_true(private.next_monthly_invoice_number('20000000-0000-4000-8000-000000000002',now(),'UTC')%1000000=1,'organizations have independent counters');
set local role authenticated;

select pg_temp.assert_true((select total_cents=13500 from public.invoices limit 1),'invoice matches accepted version');
do $$begin begin
 perform public.record_payment('20000000-0000-4000-8000-000000000001',(select id from public.invoices limit 1),3000,'zelle','Customer said sent',now(),false,'test-payment-unconfirmed');raise exception 'TEST FAILED unconfirmed payment';
 exception when raise_exception then if sqlerrm<>'PAYMENT_CONFIRMATION_REQUIRED' then raise;end if;end;end$$;
select public.record_payment('20000000-0000-4000-8000-000000000001',(select id from public.invoices limit 1),3000,'cash','Synthetic cash receipt 1',now(),true,'test-payment-received1');
select pg_temp.assert_true((select count(*)=0 from public.outbox where kind='invoice.paid'),'partial payment no paid thank you');
select public.record_payment('20000000-0000-4000-8000-000000000001',(select id from public.invoices limit 1),10500,'cash','Synthetic cash receipt 2',now(),true,'test-payment-received2');
select public.record_payment('20000000-0000-4000-8000-000000000001',(select id from public.invoices limit 1),10500,'cash','Synthetic cash receipt 2',now(),true,'test-payment-received2');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='invoice.paid'),'one paid milestone intent');
select pg_temp.assert_true((select count(*)=2 from public.payments),'payment retries do not duplicate');
select pg_temp.assert_true((select sum(debit_cents::bigint-credit_cents)=0 from public.journal_lines),'ledger balanced');
reset role;
set constraints all immediate;
do $$begin begin update public.invoices set total_cents=1;raise exception 'TEST FAILED invoice mutable';exception when raise_exception then if sqlerrm<>'IMMUTABLE_RECORD' then raise;end if;end;end$$;
do $$begin begin insert into public.journal_entries(organization_id,source_kind,source_id) values('20000000-0000-4000-8000-000000000001','expense',gen_random_uuid());raise exception 'TEST FAILED unbalanced journal accepted';exception when raise_exception then if sqlerrm<>'UNBALANCED_JOURNAL' then raise;end if;end;end$$;

select pg_temp.assert_true((select payload->>'schemaVersion'='2' and payload->>'recipient'='test@example.invalid' and payload->'review'->>'url'='https://example.invalid/review' from public.outbox where kind='invoice.paid'),'paid event freezes recipient and reviewed destination');
select pg_temp.assert_true((select private.paid_notice_current(organization_id,id) from public.outbox where kind='invoice.paid'),'settled owner-approved invoice is current');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.paid_notice_current(uuid,uuid)','EXECUTE'),'no direct paid-state privileged API');
update public.organizations set status='active';
insert into private.google_accounts(organization_id,revision,encrypted_tokens,email,subject,scopes,gmail_test,test_key) values('20000000-0000-4000-8000-000000000001',1,'synthetic-ciphertext','owner@example.invalid','synthetic-account',array['https://www.googleapis.com/auth/gmail.send'],'accepted','90000000-0000-4000-8000-000000000001');
insert into public.outbox(organization_id,event_key,kind,object_id,payload) select organization_id,'legacy-paid-test','invoice.paid',object_id,'{"schemaVersion":1}' from public.outbox where kind='invoice.paid';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.configure_mail_delivery('20000000-0000-4000-8000-000000000001',true,1,'90000000-0000-4000-8000-000000000001',2,'paid-mail-enable-test');
select * from public.claim_outbox('20000000-0000-4000-8000-000000000001',25);
reset role;
select pg_temp.assert_true((select status='pending' from public.outbox where event_key='legacy-paid-test'),'legacy event never leased');
select pg_temp.assert_true((select status='leased' from public.outbox where kind='invoice.paid' and payload->>'schemaVersion'='2'),'new settled paid event leased');
-- Corrupt event recipient after lease; dispatch must stop instead of sending to a different address.
update public.outbox set payload=jsonb_set(payload,'{recipient}','"different@example.invalid"') where kind='invoice.paid' and payload->>'schemaVersion'='2';
set local role authenticated;
select pg_temp.assert_true(public.begin_delivery('20000000-0000-4000-8000-000000000001',(select id from public.outbox where kind='invoice.paid' and payload->>'schemaVersion'='2'),(select lease_token from public.outbox where kind='invoice.paid' and payload->>'schemaVersion'='2'))->>'status'='suppressed','invalid recipient suppressed at final dispatch boundary');
reset role;

update public.outbox set payload=jsonb_set(payload,'{recipient}','"test@example.invalid"'),status='pending',lease_until=null,lease_token=null where kind='invoice.paid' and payload->>'schemaVersion'='2';
set local role authenticated;
select * from public.claim_outbox('20000000-0000-4000-8000-000000000001',25);
select pg_temp.assert_true(public.begin_delivery('20000000-0000-4000-8000-000000000001',(select id from public.outbox where kind='invoice.paid' and payload->>'schemaVersion'='2'),(select lease_token from public.outbox where kind='invoice.paid' and payload->>'schemaVersion'='2'))->>'status'='sending','valid paid event enters delivery');
select public.finish_delivery('20000000-0000-4000-8000-000000000001',(select id from public.outbox where kind='invoice.paid' and payload->>'schemaVersion'='2'),(select lease_token from public.outbox where kind='invoice.paid' and payload->>'schemaVersion'='2'),'needs_reconciliation',null,'synthetic timeout');
select * from public.claim_outbox('20000000-0000-4000-8000-000000000001',25);
select pg_temp.assert_true((select status='needs_reconciliation' from public.outbox where kind='invoice.paid' and payload->>'schemaVersion'='2'),'uncertain paid thank-you never blindly retried');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
do $$begin begin perform public.claim_outbox('20000000-0000-4000-8000-000000000001',25);raise exception 'TEST FAILED cross-company mail';exception when insufficient_privilege then null;end;end$$;
reset role;
select 'PASS: versioned quote, approval, invoice, manual payment and ledger assertions; rollback' as evidence;
rollback;
