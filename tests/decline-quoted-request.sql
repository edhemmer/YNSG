-- Isolated synthetic quoted lead; no providers or production records.
update public.catalog_services set compliance='approved',pricing_mode='hourly';
insert into public.configuration_versions(organization_id,version,settings) values('20000000-0000-4000-8000-000000000001',2,
 '{"hourly":{"standardCents":6000,"communityCents":4500},"policyVersion":"synthetic-1","region":"IL"}');
insert into public.service_requests(organization_id,id,service_id,status,original_submission,privacy_version)
select '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',id,'reviewing','{"name":"Synthetic Customer","email":"customer@example.invalid","phone":"5550100","street":"Test Street","city":"DeKalb"}','test-only' from public.catalog_services;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.publish_hourly_quote('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',1,'Synthetic furniture assembly scope',120,false,false,null,'quoted-decline-publish');
do $$begin begin perform public.decline_service_request_with_message('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',1,'Synthetic service explanation','quoted-decline-stale');raise exception 'TEST FAILED stale decline';exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;end$$;
select public.decline_service_request_with_message('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',2,'Synthetic service explanation','quoted-decline-save');
select public.decline_service_request_with_message('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',2,'Synthetic service explanation','quoted-decline-save');
select pg_temp.assert_true((select status='declined' and revision=3 from public.service_requests),'quoted unconfirmed request declined');
select pg_temp.assert_true((select status='declined' from public.quotes),'pending agreement cannot be approved after decline');
select pg_temp.assert_true((select count(*)=1 from public.quote_versions),'original quote evidence retained');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='request.declined' and payload->>'reason'='Synthetic service explanation'),'one explicit decline intent');
do $$begin begin perform public.approve_quote('20000000-0000-4000-8000-000000000001',(select id from public.quotes limit 1),1,'Synthetic late approval');raise exception 'TEST FAILED late agreement';exception when raise_exception then if sqlerrm<>'TRANSITION' then raise;end if;end;end$$;
reset role;
rollback;
