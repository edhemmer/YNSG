-- Synthetic fixture transaction starts in foundation.sql; never touch production rows.
insert into public.contacts(organization_id,customer_id,name,email,relationship) values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Synthetic One','one@example.invalid','requester');
insert into public.service_requests(organization_id,id,customer_id,service_id,privacy_version,original_submission)
 select s.organization_id,'71000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',s.id,'test-only','{"service":"Lawn care","task":"Mowing","email":"one@example.invalid"}' from public.catalog_services s limit 1;
-- Same email, but no customer link: must never be attributed to customer one.
insert into public.service_requests(organization_id,id,service_id,privacy_version,original_submission)
 select s.organization_id,'71000000-0000-4000-8000-000000000002',s.id,'test-only','{"service":"Lawn care","task":"Mowing","email":"one@example.invalid"}' from public.catalog_services s limit 1;
insert into public.outbox(organization_id,id,event_key,kind,object_id,payload,status,created_at) values
 ('20000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','test-receipt-1','request.customer_receipt','71000000-0000-4000-8000-000000000001','{"recipient":"one@example.invalid"}','accepted',now()-interval '3 days'),
 ('20000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000002','test-owner-1','request.owner_notification','71000000-0000-4000-8000-000000000001','{}','accepted',now()-interval '3 days'),
 ('20000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000003','test-declined-1','request.declined','71000000-0000-4000-8000-000000000001','{"recipient":"one@example.invalid"}','dead_letter',now()-interval '2 days'),
 ('20000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000004','test-guest-1','request.customer_receipt','71000000-0000-4000-8000-000000000002','{"recipient":"one@example.invalid"}','accepted',now()-interval '1 day');
insert into public.delivery_attempts(organization_id,outbox_id,attempt_no,status,finished_at) values('20000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001',1,'accepted',now()-interval '3 days'+interval '1 minute');
insert into public.marketing_contacts(organization_id,email,basis,first_source,last_source,subscribed,consent_at) values('20000000-0000-4000-8000-000000000001','one@example.invalid','opt_in','test-entry','test-entry',true,now()-interval '6 days') on conflict (organization_id,email) do nothing;
insert into public.marketing_sends(organization_id,contact_id,journey,period,audience,status,scheduled_for,sent_at,clicked_at)
 select organization_id,id,'welcome','test-1','prospect','sent',now()-interval '5 days',now()-interval '5 days',now()-interval '4 days' from public.marketing_contacts where organization_id='20000000-0000-4000-8000-000000000001' and email='one@example.invalid';
insert into public.marketing_sends(organization_id,contact_id,journey,period,audience,status,scheduled_for)
 select organization_id,id,'monthly','test-2','prospect','skipped',now() from public.marketing_contacts where organization_id='20000000-0000-4000-8000-000000000001' and email='one@example.invalid';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$declare report jsonb;begin
 report:=public.owner_customer_email_history('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
 perform pg_temp.assert_true((report->>'total')::int=3,'customer receipt, failed decline and marketing welcome are listed; owner notices, skipped sends and unlinked guest mail are not');
 perform pg_temp.assert_true(report->'items'->0->>'kind'='request.declined' and report->'items'->0->>'state'='not_delivered','newest first, and a dead-lettered email reads as not delivered');
 perform pg_temp.assert_true(report->'items'->1->>'kind'='request.customer_receipt' and report->'items'->1->>'state'='sent' and report->'items'->1->>'channel'='service','accepted service email reads as sent');
 perform pg_temp.assert_true(report->'items'->2->>'channel'='marketing' and report->'items'->2->>'kind'='welcome' and report->'items'->2->>'clickedAt' is not null,'marketing email to a saved contact address is listed with its click');
 report:=public.owner_customer_email_history('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
 perform pg_temp.assert_true((report->>'total')::int=0,'another customer sees none of these emails');
 begin perform public.owner_customer_email_history('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED cross tenant';exception when insufficient_privilege then null;end;
 begin perform public.owner_customer_email_history('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003');raise exception 'TEST FAILED foreign customer';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
do $$begin begin perform public.owner_customer_email_history('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED customer access';exception when insufficient_privilege then null;end;end$$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.owner_customer_email_history(uuid,uuid)','EXECUTE') and not has_function_privilege('service_role','public.owner_customer_email_history(uuid,uuid)','EXECUTE'),'anonymous and service role cannot execute');
rollback;
