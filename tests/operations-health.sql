select pg_temp.assert_true(not has_function_privilege('anon','public.operations_health(uuid,text[])','EXECUTE'),'public visitors cannot access detailed operations data');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.operations_health(uuid,text[])','EXECUTE'),'signed-in clients cannot forge worker health');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.assert_true(public.operations_health('20000000-0000-4000-8000-000000000001',array['request.owner_notification'])->>'healthy'='false','missing worker evidence fails closed');
reset role;
rollback;
