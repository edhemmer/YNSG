-- Run with synthetic foundation prefix; no live storage objects or production records.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select pg_temp.assert_true((public.reserve_customer_file('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','receipt','test.png','image/png',12,repeat('a',64))->>'ready')='false','reserve starts pending');
select pg_temp.assert_true((public.reserve_customer_file('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','receipt','test.png','image/png',12,repeat('a',64))->>'ready')='false','same attempt replays without new row');
do $assert$begin begin perform public.reserve_customer_file('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','receipt','changed.png','image/png',12,repeat('a',64));raise exception 'TEST FAILED changed attempt';exception when others then if sqlerrm='TEST FAILED changed attempt' then raise;end if;end;end$assert$;
select pg_temp.assert_true((select count(*)=1 from private.customer_supporting_files),'one durable pending record per key');
select pg_temp.assert_true((select private.customer_file_object_permission(object_path,'insert') from private.customer_supporting_files limit 1),'same actor owner may upload reserved path');
select pg_temp.assert_true(not private.customer_file_object_permission('another/path','insert'),'unknown path refused');
select pg_temp.assert_true((public.list_customer_files('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'))='[]'::jsonb,'pending object not public to list');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000004","session_id":"10000000-0000-4000-8000-000000000004","aal":"aal1"}',true);
select pg_temp.assert_true(not private.customer_file_object_permission((select object_path from private.customer_supporting_files limit 1),'insert'),'other actor denied upload');
do $assert$begin begin perform public.list_customer_files('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED non-owner list';exception when insufficient_privilege then null;end;end$assert$;
reset role;
rollback;
