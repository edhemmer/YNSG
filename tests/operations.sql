-- Synthetic fixtures with foundation prefix; all writes roll back.
insert into public.entitlements values('20000000-0000-4000-8000-000000000001','finance',true);
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.publish_configuration('20000000-0000-4000-8000-000000000001',1,
'{"schemaVersion":1,"displayName":"Synthetic One","sellerLegalName":"Synthetic Seller","timezone":"America/Chicago","currency":"USD","region":"IL","policyVersion":"test","privacyVersion":"test","cities":["DeKalb"],"brand":{"navy":"#10283c","forest":"#315842","gold":"#edbd6b","cream":"#f8f6ef"},"sender":"owner@example.invalid","notificationRecipient":"owner@example.invalid","intakeEnabled":true,"hourly":{"standardCents":6000,"communityCents":4500,"minimumMinutes":120,"incrementMinutes":30,"partialExtension":"ceil"},"scheduling":{"weekdays":[1,2,3,4,5],"earliestStart":480,"latestStart":900,"endOfDay":1020,"bufferMinutes":30,"selectionMinutes":10,"proposalMinutes":120,"leadMinutes":1440,"horizonMinutes":2160,"pendingLimit":1},"sellerVerified":true,"invoiceTerms":"Synthetic approved terms","taxTreatmentVerified":true,"laborTaxTreatment":"reviewed_non_taxable","review":{"enabled":false,"url":null}}',
'[{"name":"Lawn care","scope":"Synthetic leaf management scope","exclusions":"Synthetic exclusions reviewed","compliance":"approved","pricingMode":"hourly"},{"name":"Yard & garden","scope":"Synthetic mulch application scope","exclusions":"Supplier-prepaid mulch not reimbursed","compliance":"review","pricingMode":"hourly"}]','configuration-test-001');
select pg_temp.assert_true((select count(*)=2 from public.configuration_versions),'new immutable settings version');
do $$begin begin perform public.publish_configuration('20000000-0000-4000-8000-000000000001',1,'{}','[]','configuration-stale-1');raise exception 'TEST FAILED stale publication';exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;end$$;
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.submit_service_request('20000000-0000-4000-8000-000000000001','multiple-services-01',repeat('b',64),'{"services":[{"service":"Lawn care","task":"Leaf management"},{"service":"Yard & garden","task":"Mulch application"}],"name":"Synthetic Test","phone":"5550000000","email":"test@example.invalid","street":"100 Test Street","city":"DeKalb","communityRate":"No"}');
select public.submit_service_request('20000000-0000-4000-8000-000000000001','multiple-services-01',repeat('b',64),'{"services":[{"service":"Lawn care","task":"Leaf management"},{"service":"Yard & garden","task":"Mulch application"}],"name":"Synthetic Test","phone":"5550000000","email":"test@example.invalid","street":"100 Test Street","city":"DeKalb","communityRate":"No"}');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.service_requests),'retry one request');
select pg_temp.assert_true((select count(*)=2 from public.service_request_items),'all category items preserved');
select pg_temp.assert_true((select count(*)=1 from public.outbox),'one owner notification');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.review_service_request('20000000-0000-4000-8000-000000000001',(select id from public.service_requests),1,'reviewing','operations-review-01');
do $$begin begin perform public.publish_hourly_quote('20000000-0000-4000-8000-000000000001',(select id from public.service_requests),2,'Synthetic combined scope',120,false,false,null,'operations-quote-01');raise exception 'TEST FAILED second category bypass';exception when raise_exception then if sqlerrm<>'SERVICE_REVIEW_REQUIRED' then raise;end if;end;end$$;
reset role;
update public.catalog_services set compliance='approved' where name='Yard & garden';
set local role authenticated;
select public.publish_hourly_quote('20000000-0000-4000-8000-000000000001',(select id from public.service_requests),2,'Synthetic combined scope',120,false,false,null,'operations-quote-01');
select public.approve_quote('20000000-0000-4000-8000-000000000001',(select id from public.quotes),1,'Synthetic actual customer approval');
select public.job_action('20000000-0000-4000-8000-000000000001',(select id from public.jobs),1,'start','Synthetic work begins','operations-start-01');
select public.job_action('20000000-0000-4000-8000-000000000001',(select id from public.jobs),1,'start','Synthetic work begins','operations-start-01');
select pg_temp.assert_true((select count(*)=1 from public.work_sessions),'start retry one time session');
select public.job_action('20000000-0000-4000-8000-000000000001',(select id from public.jobs),2,'pause','','operations-pause-01');
select pg_temp.assert_true((select count(*)=0 from public.work_sessions where ended_at is null),'pause closes active time');
select public.job_action('20000000-0000-4000-8000-000000000001',(select id from public.jobs),3,'resume','','operations-resume-01');
select public.complete_service_call('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),4,'complete-service-test-key');
select public.complete_service_call('20000000-0000-4000-8000-000000000001',(select id from public.jobs),4,'complete-service-test-key');
select pg_temp.assert_true((select count(*)=0 from public.invoices),'completion does not issue invoice');
select pg_temp.assert_true((select count(*)=0 from public.outbox where kind like 'invoice.%'),'completion queues no invoice mail');
select pg_temp.assert_true((select count(*)=0 from public.work_sessions where ended_at is null),'completion closes timer before invoice');
select pg_temp.assert_true((select count(*)=1 from public.audit_events where action='job.completed'),'completion retry records one audit');
do $$begin begin
 perform public.complete_service_call('20000000-0000-4000-8000-000000000001',(select id from public.jobs),5,'complete-service-test-key');raise exception 'TEST FAILED changed completion retry';
 exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;end$$;
do $$begin begin
 perform public.approve_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs),5,12000,false,'no-review-approval-key');raise exception 'TEST FAILED missing review';
 exception when raise_exception then if sqlerrm<>'INVOICE_REVIEW_REQUIRED' then raise;end if;end;end$$;
do $$begin begin
 perform public.approve_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs),5,12000,true,'no-draft-approval-key');raise exception 'TEST FAILED missing draft';
 exception when raise_exception then if sqlerrm<>'INVOICE_DRAFT_REQUIRED' then raise;end if;end;end$$;
select pg_temp.assert_true(not has_function_privilege('authenticated','public.complete_and_invoice(uuid,uuid,integer)','execute'),'old combined RPC closed');
select pg_temp.assert_true(not has_function_privilege('service_role','public.approve_invoice(uuid,uuid,integer,integer,boolean,text)','execute'),'generic worker cannot approve');
select pg_temp.assert_true(not has_function_privilege('anon','public.complete_service_call(uuid,uuid,integer,text)','execute'),'anonymous completion denied');
select public.save_invoice_labor('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1),5,'[{"description":"Synthetic recorded work","recordedMinutes":120,"chargedCents":12000,"waiverReason":""}]','saved-approval-draft-key');
do $$begin begin
 perform public.approve_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs),5,12000,true,'stale-draft-approval-key');raise exception 'TEST FAILED stale approval';
 exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;end$$;
do $$begin begin
 perform public.approve_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs),6,1,true,'wrong-total-approval-key');raise exception 'TEST FAILED changed total';
 exception when raise_exception then if sqlerrm<>'INVOICE_TOTAL_CHANGED' then raise;end if;end;end$$;
select public.approve_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs),6,12000,true,'approved-invoice-key');
select public.approve_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs),6,12000,true,'approved-invoice-key');
do $$begin begin
 perform public.approve_invoice('20000000-0000-4000-8000-000000000001',(select id from public.jobs),6,1,true,'approved-invoice-key');raise exception 'TEST FAILED changed approval retry';
 exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;end$$;
select pg_temp.assert_true((select count(*)=1 from public.audit_events where action='invoice.owner_approved'),'approval retry has one audit');
select pg_temp.assert_true((select count(*)=1 from public.invoices),'closeout retry one invoice');
select pg_temp.assert_true((select count(*)=0 from public.work_sessions where ended_at is null),'completion closes active time');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
select pg_temp.assert_true((select count(*)=0 from public.work_sessions),'time records tenant isolation');
do $$begin begin perform public.job_action('20000000-0000-4000-8000-000000000001',gen_random_uuid(),1,'start','','operations-forbidden');raise exception 'TEST FAILED cross tenant command';exception when insufficient_privilege then null;end;end$$;
do $$begin begin perform public.approve_invoice('20000000-0000-4000-8000-000000000001',gen_random_uuid(),1,0,true,'other-company-approval');raise exception 'TEST FAILED other company approval';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin begin perform public.complete_service_call('20000000-0000-4000-8000-000000000001',gen_random_uuid(),1,'customer-completion-key');raise exception 'TEST FAILED customer completion';exception when insufficient_privilege then null;end;end$$;
do $$begin begin perform public.approve_invoice('20000000-0000-4000-8000-000000000001',gen_random_uuid(),1,0,true,'customer-approval-key');raise exception 'TEST FAILED customer approval';exception when insufficient_privilege then null;end;end$$;
reset role;
update public.memberships set revoked_at=now() where user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin begin perform public.approve_invoice('20000000-0000-4000-8000-000000000001',gen_random_uuid(),6,12000,true,'approved-invoice-key');raise exception 'TEST FAILED revoked owner replay';exception when insufficient_privilege then null;end;end$$;
reset role;
update public.memberships set revoked_at=null where user_id='00000000-0000-4000-8000-000000000001';
update auth.sessions set not_after=now()-interval '1 second' where user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin begin perform public.complete_service_call('20000000-0000-4000-8000-000000000001',gen_random_uuid(),4,'complete-service-test-key');raise exception 'TEST FAILED expired completion replay';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
