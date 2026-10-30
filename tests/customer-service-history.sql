-- Synthetic fixture transaction starts in foundation.sql; never touch production rows.
insert into public.service_requests(organization_id,customer_id,service_id,privacy_version,original_submission,status,created_at)
 select '20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',s.id,'test-only',
 '{"services":[{"service":"Lawn care","task":"Leaf management"},{"service":"Lawn care","task":"Leaf cleanup"}]}'::jsonb,
 case when n=1 then 'canceled' else 'submitted' end,now()-n*interval '1 day'
 from public.catalog_services s cross join generate_series(1,25) n where s.organization_id='20000000-0000-4000-8000-000000000001';
insert into public.service_requests(organization_id,customer_id,service_id,privacy_version,original_submission)
 select s.organization_id,'30000000-0000-4000-8000-000000000001',s.id,'test-only','{"service":"Lawn care","task":"Leaf cleanup"}' from public.catalog_services s;
insert into public.service_requests(organization_id,customer_id,service_id,privacy_version,original_submission)
 select s.organization_id,'30000000-0000-4000-8000-000000000001',s.id,'test-only','{"services":[{"service":"Lawn care","task":"Leaf management"}],"recurringVisit":true}' from public.catalog_services s;
insert into public.service_requests(organization_id,customer_id,service_id,privacy_version,original_submission)
 select s.organization_id,'30000000-0000-4000-8000-000000000002',s.id,'test-only','{"services":[{"service":"Lawn care","task":"Mowing"},{"service":"Lawn care","task":"Trimming and edging"}],"email":"shared@example.invalid"}' from public.catalog_services s;
insert into public.service_requests(organization_id,service_id,privacy_version,original_submission)
 select s.organization_id,s.id,'test-only','{"service":"Lawn care","task":"Mowing","email":"shared@example.invalid"}' from public.catalog_services s;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$declare report jsonb;item jsonb;begin
 report:=public.owner_customer_service_history('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');item:=report->'items'->0;
 perform pg_temp.assert_true((item->>'requestCount')::int=26,'all requests counted beyond the twenty-request UI page, including cancellation');
 perform pg_temp.assert_true((item->>'generatedVisits')::int=1,'generated visits remain separate');
 perform pg_temp.assert_true(jsonb_array_length(item->'services')=1 and item->'services'->0->>'task'='Leaf management' and (item->'services'->0->>'requestCount')::int=26,'legacy leaf names normalize and duplicate task choices count once per request');
 perform pg_temp.assert_true((item->'categories'->0->>'requestCount')::int=26,'category totals count distinct requests');
 report:=public.owner_customer_service_history('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
 perform pg_temp.assert_true((report->'items'->0->'categories'->0->>'requestCount')::int=1 and jsonb_array_length(report->'items'->0->'services')=2,'two lawn tasks in one request count once for lawn care');
 report:=public.owner_customer_service_history('20000000-0000-4000-8000-000000000001',null,'leaf management');
 perform pg_temp.assert_true((report->>'matchingCustomers')::int=1,'service interest finds the exact linked customer');
 perform pg_temp.assert_true((report->>'unlinkedRequests')::int=1 and (report->>'linkedRequests')::int=27,'same email never invents a customer link; original guest request remains visible');
 report:=public.owner_customer_service_history('20000000-0000-4000-8000-000000000001',null,'',1);
 perform pg_temp.assert_true(jsonb_array_length(report->'items')=0,'directory pagination is bounded');
 begin perform public.owner_customer_service_history('20000000-0000-4000-8000-000000000002');raise exception 'TEST FAILED cross tenant';exception when insufficient_privilege then null;end;
 begin perform public.owner_customer_service_history('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003');raise exception 'TEST FAILED foreign customer';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
do $$begin begin perform public.owner_customer_service_history('20000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED customer access';exception when insufficient_privilege then null;end;end$$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.owner_customer_service_history(uuid,uuid,text,integer)','EXECUTE') and not has_function_privilege('service_role','public.owner_customer_service_history(uuid,uuid,text,integer)','EXECUTE'),'anonymous and service role cannot execute owner report');
update public.memberships set revoked_at=now() where organization_id='20000000-0000-4000-8000-000000000001' and user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$begin begin perform public.owner_customer_service_history('20000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED revoked owner';exception when insufficient_privilege then null;end;end$$;
reset role;
select pg_temp.assert_true((select count(*)=25 from public.service_requests where original_submission->'services'->1->>'task'='Leaf cleanup'),'reporting does not rewrite retained submissions');
rollback;
