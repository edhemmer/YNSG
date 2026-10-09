-- Synthetic owner receipt and leased worker. No external emails are sent.
update public.organizations set status='active' where id='20000000-0000-4000-8000-000000000001';
insert into public.configuration_versions(organization_id,version,settings) values('20000000-0000-4000-8000-000000000001',2,'{"displayName":"Synthetic Company","sender":"owner@example.invalid","notificationRecipient":"owner@example.invalid"}');
insert into private.google_accounts(organization_id,revision,encrypted_tokens,email,subject,scopes,gmail_test,test_key) values('20000000-0000-4000-8000-000000000001',1,'synthetic-ciphertext','owner@example.invalid','synthetic-account',array['https://www.googleapis.com/auth/gmail.send'],'accepted','90000000-0000-4000-8000-000000000001');
insert into public.outbox(organization_id,id,kind,event_key,object_id,payload) values('20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','request.owner_notification','synthetic-request-notice','50000000-0000-4000-8000-000000000001','{}');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select pg_temp.assert_true(public.mail_delivery_status('20000000-0000-4000-8000-000000000001')->>'enabled'='false','accepted provider test alone does not authorize delivery');
select pg_temp.assert_true((select count(*)=0 from public.claim_outbox('20000000-0000-4000-8000-000000000001',5)),'accepted provider test alone leases nothing');
do $$begin begin perform public.configure_mail_delivery('20000000-0000-4000-8000-000000000001',true,1,'90000000-0000-4000-8000-000000000002',2,'mail-invalid-test-0001');raise exception 'TEST FAILED wrong receipt test';exception when raise_exception then if sqlerrm<>'STALE_CONNECTION' then raise;end if;end;end$$;
select public.configure_mail_delivery('20000000-0000-4000-8000-000000000001',true,1,'90000000-0000-4000-8000-000000000001',2,'mail-enable-key-0001');
select public.configure_mail_delivery('20000000-0000-4000-8000-000000000001',true,1,'90000000-0000-4000-8000-000000000001',2,'mail-enable-key-0001');
reset role;
insert into public.service_requests(organization_id,id,service_id,original_submission,privacy_version)
select '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',id,'{"name":"Synthetic Customer","email":"customer@example.invalid"}','test-only' from public.catalog_services;
insert into public.appointments(organization_id,id,request_id,start_at,end_at,arrival_at,timezone,status,created_by)
values('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',now(),now()+interval '2 hours',now(),'UTC','reserved','00000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$begin begin perform public.request_delay_notice('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',null,10,'delay-null-revision-key');raise exception 'TEST FAILED missing revision';exception when raise_exception then if sqlerrm<>'INVALID_DELAY' then raise;end if;end;end$$;
select public.request_delay_notice('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',1,10,'delay-notice-retry-key-01');
select public.request_delay_notice('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',1,10,'delay-notice-retry-key-01');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='appointment.delay_notice'),'one delay email intent on transport retry');
do $$begin begin perform public.request_delay_notice('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',1,15,'delay-notice-retry-key-01');raise exception 'TEST FAILED changed payload';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;end$$;
do $$begin begin perform public.request_delay_notice('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',1,15,'delay-notice-new-key-001');raise exception 'TEST FAILED cooldown';exception when raise_exception then if sqlerrm<>'DELAY_ALREADY_QUEUED' then raise;end if;end;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
do $$begin begin perform public.request_delay_notice('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',1,10,'delay-cross-tenant-001');raise exception 'TEST FAILED tenant';exception when insufficient_privilege then null;end;end$$;
reset role;
select pg_temp.assert_true((select count(*)=1 from public.audit_events where action='appointment.delay_notice_requested'),'single owner audit');
select pg_temp.assert_true((select payload->>'recipient'='customer@example.invalid' from public.outbox where kind='appointment.delay_notice'),'recipient resolved from authoritative appointment order');
select pg_temp.assert_true((select private.appointment_notice_current(organization_id,id) from public.outbox where kind='appointment.delay_notice'),'current delay can send');
update public.appointments set revision=revision+1 where id='60000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select not private.appointment_notice_current(organization_id,id) from public.outbox where kind='appointment.delay_notice'),'changed appointment suppresses old delay');
rollback;
