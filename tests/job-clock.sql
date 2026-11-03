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
select public.publish_hourly_crew_quote('20000000-0000-4000-8000-000000000001',(select id from public.service_requests limit 1),2,'Synthetic three-person hourly scope',120,true,true,null,'test-crew-publish-01',3);
select public.publish_hourly_crew_quote('20000000-0000-4000-8000-000000000001',(select id from public.service_requests limit 1),2,'Synthetic three-person hourly scope',120,true,true,null,'test-crew-publish-01',3);
select pg_temp.assert_true((select count(*)=1 from public.quote_versions),'crew quote retry does not publish twice');
select pg_temp.assert_true((select labor_cents=27000 and duration_minutes=120 and snapshot->'crew'->>'plannedPeople'='3' and snapshot->'crew'->>'additionalPersonMinimumMinutes'='0' from public.quote_versions),'three-person estimate cap and first-person-only minimum snapshot');
do $$begin begin
 perform public.publish_hourly_crew_quote('20000000-0000-4000-8000-000000000001',(select id from public.service_requests limit 1),2,'Synthetic three-person hourly scope',120,true,true,null,'test-crew-publish-01',2);raise exception 'TEST FAILED changed headcount replay';
 exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;end$$;
select public.approve_quote('20000000-0000-4000-8000-000000000001',(select id from public.quotes limit 1),1,'Synthetic approval of scope and financial cap only');
reset role;

-- Clock cases use only isolated synthetic work sessions.
update public.jobs set status='paused',revision=2;
insert into public.work_sessions(organization_id,job_id,started_at,ended_at,actor_id) select organization_id,id,'2020-01-01T10:00:00Z','2020-01-01T10:20:00Z','00000000-0000-4000-8000-000000000001' from public.jobs;
insert into public.work_sessions(organization_id,job_id,started_at,ended_at,actor_id) select organization_id,id,'2020-01-01T10:30:00Z','2020-01-01T11:30:00Z','00000000-0000-4000-8000-000000000001' from public.jobs;
set local role authenticated;
select pg_temp.assert_true(public.field_job_clock('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1))->>'closedSeconds'='4800','clock sums exact completed sessions without pause gaps');
select pg_temp.assert_true(public.field_job_clock('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1))->'runningSince'='null','paused clock never advances');
reset role;
update public.jobs set status='working',revision=3;
insert into public.work_sessions(organization_id,job_id,started_at,actor_id) select organization_id,id,statement_timestamp()-interval '90 seconds','00000000-0000-4000-8000-000000000001' from public.jobs;
set local role authenticated;
select pg_temp.assert_true((public.field_job_clock('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1))->>'runningSince')::timestamptz<statement_timestamp(),'working clock carries server timestamp');
select pg_temp.assert_true(public.field_job_clock('20000000-0000-4000-8000-000000000001',(select id from public.jobs limit 1))->>'revision'='3','clock is bound to exact job revision');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin begin perform public.field_job_clock('20000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED cross-tenant clock';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000004","session_id":"10000000-0000-4000-8000-000000000004"}',true);
do $$begin begin perform public.field_job_clock('20000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED unassigned clock';exception when insufficient_privilege then null;end;end$$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.field_job_clock(uuid,uuid)','execute') and not has_function_privilege('service_role','public.field_job_clock(uuid,uuid)','execute'),'clock has no anonymous or service-role API grant');
select pg_temp.assert_true((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.field_job_clock(uuid,uuid)'::regprocedure),'clock locks privileged search path');
rollback;
