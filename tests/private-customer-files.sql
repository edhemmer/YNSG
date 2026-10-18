-- Run with synthetic foundation prefix; no live storage objects or production records.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select pg_temp.assert_true((public.reserve_customer_file('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','receipt','test.png','image/png',12,repeat('a',64))->>'ready')='false','reserve starts pending');
select pg_temp.assert_true((public.reserve_customer_file('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','receipt','test.png','image/png',12,repeat('a',64))->>'ready')='false','same attempt replays without new row');
do $assert$begin begin perform public.reserve_customer_file('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','receipt','changed.png','image/png',12,repeat('a',64));raise exception 'TEST FAILED changed attempt';exception when others then if sqlerrm='TEST FAILED changed attempt' then raise;end if;end;end$assert$;
select pg_temp.assert_true(private.customer_file_object_permission('20000000-0000-4000-8000-000000000001/'||(select (public.reserve_customer_file('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','receipt','test.png','image/png',12,repeat('a',64))->>'id')),'insert'),'same actor owner may upload reserved path');
select pg_temp.assert_true(private.customer_file_object_permission('20000000-0000-4000-8000-000000000001/'||(select (public.reserve_customer_file('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','receipt','test.png','image/png',12,repeat('a',64))->>'id')),'verify'),'same pending actor may reread exact bytes');
select pg_temp.assert_true(not private.customer_file_object_permission('another/path','insert'),'unknown path refused');
select pg_temp.assert_true((public.list_customer_files('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'))='[]'::jsonb,'pending object not public to list');
reset role;
select set_config('ynsg.qa_saved_file_path',(select object_path from private.customer_supporting_files limit 1),true);
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000004","session_id":"10000000-0000-4000-8000-000000000004","aal":"aal1"}',true);
select pg_temp.assert_true(not private.customer_file_object_permission('20000000-0000-4000-8000-000000000001/'||split_part(current_setting('ynsg.qa_saved_file_path'), '/',2),'insert'),'other actor denied upload');
select pg_temp.assert_true(not private.customer_file_object_permission(current_setting('ynsg.qa_saved_file_path'),'verify'),'other actor cannot inspect pending bytes');
do $assert$begin begin perform public.list_customer_files('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED non-owner list';exception when insufficient_privilege then null;end;end$assert$;
reset role;

-- Only the server verifier can promote bytes. Raw authenticated RPC is closed.
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select set_config('ynsg.qa_file_id',(select id::text from private.customer_supporting_files limit 1),true);
set local role authenticated;
do $$begin begin perform public.finalize_customer_file('20000000-0000-4000-8000-000000000001',current_setting('ynsg.qa_file_id')::uuid);raise exception 'TEST FAILED direct finalize';exception when others then if sqlerrm<>'SERVER_VERIFICATION_REQUIRED' then raise;end if;end;end$$;
select pg_temp.assert_true(not has_function_privilege('authenticated','public.confirm_verified_customer_file(uuid,uuid,uuid,uuid,text,integer,text)','execute'),'browser cannot attest file verification');
reset role;
insert into storage.objects(bucket_id,name) values('ynsg-customer-files',current_setting('ynsg.qa_saved_file_path'));
set local role service_role;
do $$begin begin perform public.confirm_verified_customer_file('20000000-0000-4000-8000-000000000001',current_setting('ynsg.qa_file_id')::uuid,'00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','image/png',12,repeat('b',64));raise exception 'TEST FAILED mismatched verifier';exception when others then if sqlerrm<>'FILE_VERIFICATION_MISMATCH' then raise;end if;end;end$$;
reset role;
update auth.sessions set not_after=now()-interval '1 hour' where id='10000000-0000-4000-8000-000000000001';
set local role service_role;
do $$begin begin perform public.confirm_verified_customer_file('20000000-0000-4000-8000-000000000001',current_setting('ynsg.qa_file_id')::uuid,'00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','image/png',12,repeat('a',64));raise exception 'TEST FAILED revoked verifier session';exception when insufficient_privilege then null;end;end$$;
reset role;
update auth.sessions set not_after=null where id='10000000-0000-4000-8000-000000000001';
reset role;
update public.memberships set revoked_at=now() where user_id='00000000-0000-4000-8000-000000000001';
set local role service_role;
do $$begin begin perform public.confirm_verified_customer_file('20000000-0000-4000-8000-000000000001',current_setting('ynsg.qa_file_id')::uuid,'00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','image/png',12,repeat('a',64));raise exception 'TEST FAILED revoked verifier membership';exception when insufficient_privilege then null;end;end$$;
reset role;
update public.memberships set revoked_at=null where user_id='00000000-0000-4000-8000-000000000001';
set local role service_role;
select public.confirm_verified_customer_file('20000000-0000-4000-8000-000000000001',current_setting('ynsg.qa_file_id')::uuid,'00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','image/png',12,repeat('a',64));
select public.confirm_verified_customer_file('20000000-0000-4000-8000-000000000001',current_setting('ynsg.qa_file_id')::uuid,'00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','image/png',12,repeat('a',64));
reset role;
select pg_temp.assert_true((select count(*)=1 from public.audit_events where action='customer.file_uploaded'),'one file verification audit after retry');
set local role authenticated;
select pg_temp.assert_true((public.verified_customer_file_access('20000000-0000-4000-8000-000000000001',current_setting('ynsg.qa_file_id')::uuid)->>'sha256')=repeat('a',64),'read authorization retains frozen byte digest');
reset role;

-- More than the former 250-file ceiling; all metadata is isolated synthetic.
insert into private.customer_supporting_files(organization_id,id,customer_id,actor_id,request_key,purpose,original_name,mime,bytes,sha256,object_path,status,created_at)
select '20000000-0000-4000-8000-000000000001',('84000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',gen_random_uuid(),'receipt','pagination-fixture.png','image/png',12,repeat('a',64),'20000000-0000-4000-8000-000000000001/84000000-0000-4000-8000-'||lpad(n::text,12,'0'),'ready','2026-01-01T00:00:00.123456Z' from generate_series(1,260) n;
set local role authenticated;
do $$declare p jsonb; stamp timestamptz; last_id uuid; seen uuid[]='{}';item jsonb;begin
 loop
  p=public.customer_file_pages('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',stamp,last_id);
  if jsonb_array_length(p->'files')>50 then raise exception 'TEST FAILED unbounded file page';end if;
  for item in select value from jsonb_array_elements(p->'files') loop
   if (item->>'id')::uuid=any(seen) then raise exception 'TEST FAILED duplicate file';end if;
   seen=array_append(seen,(item->>'id')::uuid);
  end loop;
  exit when not (p->>'hasMore')::boolean;
  stamp=(p->'nextCursor'->>'createdAt')::timestamptz;last_id=(p->'nextCursor'->>'id')::uuid;
 end loop;
 perform pg_temp.assert_true(cardinality(seen)=261,'all 261 ready files across equal-microsecond timestamps; no missing or duplicate records');
 begin perform public.customer_file_pages('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',now(),null);raise exception 'TEST FAILED partial cursor';exception when others then if sqlerrm<>'VALIDATION' then raise;end if;end;
end$$;
select pg_temp.assert_true(not has_function_privilege('anon','public.customer_file_pages(uuid,uuid,timestamptz,uuid,uuid[],uuid[])','execute'),'anonymous cannot enumerate private pages');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000004","session_id":"10000000-0000-4000-8000-000000000004","aal":"aal1"}',true);
do $$begin begin perform public.customer_file_pages('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED non-owner page';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
