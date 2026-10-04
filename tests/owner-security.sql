-- Synthetic verified owner IP assertions, rolled back with foundation fixtures.
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$begin
 begin perform public.record_owner_session_ip('20000000-0000-4000-8000-000000000001','198.51.100.9');raise exception 'TEST FAILED anonymous event';exception when insufficient_privilege then null;end;
 begin perform count(*) from private.owner_signin_events;raise exception 'TEST FAILED anonymous table read';exception when insufficient_privilege then null;end;
end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.record_owner_session_ip('20000000-0000-4000-8000-000000000001','198.51.100.9');
select public.record_owner_session_ip('20000000-0000-4000-8000-000000000001','198.51.100.9');
select pg_temp.assert_true((select jsonb_array_length(public.owner_security_recent('20000000-0000-4000-8000-000000000001'))=1),'session logged once and visible to owner');
select pg_temp.assert_true((select public.owner_security_recent('20000000-0000-4000-8000-000000000001')->0->>'ip'='198.51.100.9'),'owner sees correct IP');
do $$begin
 begin perform public.owner_security_recent('20000000-0000-4000-8000-000000000002');raise exception 'TEST FAILED cross tenant read';exception when insufficient_privilege then null;end;
 begin perform public.record_owner_session_ip('20000000-0000-4000-8000-000000000002','198.51.100.9');raise exception 'TEST FAILED cross tenant write';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
do $$begin
 begin perform public.owner_security_recent('20000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED customer read';exception when insufficient_privilege then null;end;
 begin perform public.record_owner_session_ip('20000000-0000-4000-8000-000000000001','198.51.100.9');raise exception 'TEST FAILED customer event';exception when insufficient_privilege then null;end;
end$$;
reset role;
select 'PASS: verified owner IP auditing and authorization' as evidence;
rollback;
