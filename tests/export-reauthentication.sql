-- Synthetic, rolled-back current-session export authority checks.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select pg_temp.assert_true(public.authorize_record_export('20000000-0000-4000-8000-000000000001')->>'authorized'='true','fresh current owner session can authorize export');
reset role;
update auth.sessions set created_at=now()-interval '16 minutes' where id='10000000-0000-4000-8000-000000000001';
insert into auth.sessions(id,user_id,aal,created_at) values('10000000-0000-4000-8000-000000000099','00000000-0000-4000-8000-000000000001','aal1',now());
set local role authenticated;
do $$begin
 begin perform public.authorize_record_export('20000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED old session export';exception when others then if sqlerrm<>'REAUTHENTICATION_REQUIRED' then raise;end if;end;
 begin perform public.audit_customer_export('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED old audit export';exception when others then if sqlerrm<>'REAUTHENTICATION_REQUIRED' then raise;end if;end;
 begin perform public.accounting_journal_export('20000000-0000-4000-8000-000000000001',current_date,current_date);raise exception 'TEST FAILED old journal export';exception when others then if sqlerrm<>'REAUTHENTICATION_REQUIRED' then raise;end if;end;
end$$;
-- A freshly issued token for the same OLD session is not a new sign-in.
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub','00000000-0000-4000-8000-000000000001','session_id','10000000-0000-4000-8000-000000000001','iat',extract(epoch from now()),'aal','aal1')::text,true);
do $$begin begin perform public.authorize_record_export('20000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED refreshed token bypass';exception when others then if sqlerrm<>'REAUTHENTICATION_REQUIRED' then raise;end if;end;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000099","aal":"aal1"}',true);
select pg_temp.assert_true(public.authorize_record_export('20000000-0000-4000-8000-000000000001')->>'authorized'='true','actual new current session passes');
reset role;
update public.memberships set revoked_at=now() where organization_id='20000000-0000-4000-8000-000000000001' and user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin begin perform public.authorize_record_export('20000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED revoked fresh export';exception when insufficient_privilege then null;end;end$$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.authorize_record_export(uuid)','execute') and not has_function_privilege('service_role','public.authorize_record_export(uuid)','execute'),'export check has no anonymous/service bypass');
rollback;
