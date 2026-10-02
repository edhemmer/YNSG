insert into public.entitlements values('20000000-0000-4000-8000-000000000001','scheduling',true);
insert into public.resources(organization_id,id,name,kind) values
 ('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','Operator','operator'),
 ('20000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','Other operator','operator');
insert into public.service_requests(organization_id,id,service_id,original_submission,privacy_version)
 select organization_id,'50000000-0000-4000-8000-000000000001',id,'{}','test' from public.catalog_services;
insert into public.appointments(organization_id,id,request_id,start_at,end_at,arrival_at,timezone,status,expires_at) values
 ('20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',now()+interval '1 day',now()+interval '1 day 2 hours',now()+interval '1 day','America/Chicago','held',now()-interval '1 minute');
insert into public.resource_reservations(organization_id,appointment_id,resource_id,during,active)
 select organization_id,id,'60000000-0000-4000-8000-000000000001',tstzrange(start_at,end_at,'[)'),true from public.appointments;
set constraints all immediate;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select pg_temp.assert_true(jsonb_array_length(public.scheduling_snapshot('20000000-0000-4000-8000-000000000001')->'resources')=1,'snapshot resources tenant scoped');
select pg_temp.assert_true(jsonb_array_length(public.scheduling_snapshot('20000000-0000-4000-8000-000000000001')->'reservations')=0,'expired holds do not masquerade as availability blocks');
do $$begin begin perform public.scheduling_snapshot('20000000-0000-4000-8000-000000000002');raise exception 'TEST FAILED tenant snapshot';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
do $$begin begin perform public.scheduling_snapshot('20000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED customer snapshot';exception when insufficient_privilege then null;end;end$$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.scheduling_snapshot(uuid)','EXECUTE'),'anonymous snapshot denied');
select pg_temp.assert_true((select count(*)=1 from public.appointments),'reading does not expire or mutate appointments');
rollback;
