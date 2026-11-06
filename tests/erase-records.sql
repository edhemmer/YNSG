-- Continues the canonical website submission and owner-approved booking fixture.
-- Permanent delete: a request and its agreement, job and visit are removed only when no invoice exists,
-- a customer only when nothing is left under it, and the tamper-proof rules still hold everywhere else.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.publish_hourly_quote('20000000-0000-4000-8000-000000000001',(select id from public.service_requests),(select revision from public.service_requests),'Synthetic agreed leaf management scope',120,false,false,null,'erase-price-key-01');
select public.approve_quote('20000000-0000-4000-8000-000000000001',(select id from public.quotes),1,'Synthetic customer agreement for isolated local test');
select set_config('test.req',(select id::text from public.service_requests),true);
select set_config('test.rev',(select revision::text from public.service_requests),true);
select set_config('test.cust',coalesce((select customer_id::text from public.service_requests),''),true);
select pg_temp.assert_true((select count(*)=1 from public.jobs) and (select count(*)>=1 from public.quote_versions) and (select count(*)>=1 from public.approvals) and (select count(*)>=1 from public.appointments),'fixture has agreement, job and visit to erase');
do $$begin begin perform public.erase_service_request('20000000-0000-4000-8000-000000000001',current_setting('test.req')::uuid,current_setting('test.rev')::int+99,'erase-key-stale-0001');raise exception 'TEST FAILED stale revision';exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;end$$;
do $$begin if current_setting('test.cust')<>'' then begin perform public.erase_customer('20000000-0000-4000-8000-000000000001',current_setting('test.cust')::uuid,'erase-key-cust-early-01');raise exception 'TEST FAILED customer with records';exception when raise_exception then if sqlerrm<>'ERASE_HAS_RECORDS' then raise;end if;end;end if;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
do $$begin begin perform public.erase_service_request('20000000-0000-4000-8000-000000000001',current_setting('test.req')::uuid,current_setting('test.rev')::int,'erase-key-other-0001');raise exception 'TEST FAILED other account';exception when insufficient_privilege then null;end;end$$;
select pg_temp.assert_true((select count(*)=1 from public.service_requests),'refused erase leaves the request');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select set_config('test.result',public.erase_service_request('20000000-0000-4000-8000-000000000001',current_setting('test.req')::uuid,current_setting('test.rev')::int,'erase-key-request-0001')::text,true);
select pg_temp.assert_true(current_setting('test.result')::jsonb->>'erased'='true','erase reports success');
select pg_temp.assert_true(public.erase_service_request('20000000-0000-4000-8000-000000000001',current_setting('test.req')::uuid,current_setting('test.rev')::int,'erase-key-request-0001')::text=current_setting('test.result'),'exact retry returns the saved result');
reset role;
select pg_temp.assert_true((select count(*)=0 from public.service_requests where id=current_setting('test.req')::uuid) and (select count(*)=0 from public.quotes) and (select count(*)=0 from public.quote_versions) and (select count(*)=0 from public.approvals) and (select count(*)=0 from public.jobs) and (select count(*)=0 from public.appointments),'request, agreement, job and visit are gone');
select pg_temp.assert_true((select count(*)=1 from public.audit_events where action='request.erased' and object_id=current_setting('test.req')::uuid),'erase leaves one audit entry');
select pg_temp.assert_true(coalesce(current_setting('ynsg.record_erase',true),'off')='off','erase permission does not outlive the action');
do $$begin begin delete from public.audit_events;raise exception 'TEST FAILED audit delete';exception when raise_exception then if sqlerrm<>'IMMUTABLE_RECORD' then raise;end if;end;end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$begin if current_setting('test.cust')<>'' then
 perform public.erase_customer('20000000-0000-4000-8000-000000000001',current_setting('test.cust')::uuid,'erase-key-cust-0001');
 if exists(select 1 from public.customers where id=current_setting('test.cust')::uuid) then raise exception 'TEST FAILED customer still present';end if;
end if;end$$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.erase_service_request(uuid,uuid,integer,text)','execute') and not has_function_privilege('anon','public.erase_customer(uuid,uuid,text)','execute'),'anonymous delete denied');
rollback;
