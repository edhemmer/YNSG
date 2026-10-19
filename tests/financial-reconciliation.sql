-- Isolated effective-date correction, complete range and current-session tests.
insert into public.entitlements(organization_id,module,enabled) values('20000000-0000-4000-8000-000000000001','finance',true);
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.record_business_expense('20000000-0000-4000-8000-000000000001',(now() at time zone 'America/Chicago')::date-1,'Synthetic Store','tools','Synthetic wrong receipt',1299,'cash','synthetic fixture',true,'reconcile-expense-00001');
select public.reverse_business_expense('20000000-0000-4000-8000-000000000001',(select id from public.business_expenses limit 1),'Synthetic corrected receipt','reconcile-reverse-00001');
do $$declare d jsonb;r jsonb;today date:=(now() at time zone 'America/Chicago')::date;begin
 d:=public.financial_reconciliation('20000000-0000-4000-8000-000000000001',today-1,today-1);
 perform pg_temp.assert_true((d->>'complete')::boolean and jsonb_array_length(d->'rows')=1,'earlier expense remains in earlier range after later correction');
 perform pg_temp.assert_true((d->'rows'->0->>'expenseCents')::bigint=1299,'earlier expense exact cents');
 r:=public.financial_reconciliation('20000000-0000-4000-8000-000000000001',today,today);
 perform pg_temp.assert_true(jsonb_array_length(r->'rows')=1 and (r->'rows'->0->>'expenseCents')::bigint=-1299,'expense correction stays on actual correction business date');
 d:=public.financial_reconciliation('20000000-0000-4000-8000-000000000001',today-1,today);
 perform pg_temp.assert_true(jsonb_array_length(d->'rows')=2,'complete span preserves both original and correction');
 perform pg_temp.assert_true((public.finance_activity('20000000-0000-4000-8000-000000000001',today-1,today-1)->>'expenseCents')::bigint=1299,'money summary keeps earlier original');
 perform pg_temp.assert_true((public.finance_activity('20000000-0000-4000-8000-000000000001',today,today)->>'expenseCents')::bigint=-1299,'money summary applies current correction');
 begin perform public.financial_reconciliation('20000000-0000-4000-8000-000000000002',today,today);raise exception 'TEST FAILED tenant isolation';exception when insufficient_privilege then null;end;
 begin perform public.financial_reconciliation('20000000-0000-4000-8000-000000000001',today-367,today);raise exception 'TEST FAILED excessive range';exception when others then if sqlerrm<>'VALIDATION' then raise;end if;end;
end$$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.financial_reconciliation(uuid,date,date)','execute') and not has_function_privilege('service_role','public.financial_reconciliation(uuid,date,date)','execute'),'no anonymous or service-role report execution');
select pg_temp.assert_true((select not prosecdef from pg_proc where oid='public.financial_reconciliation(uuid,date,date)'::regprocedure),'public invoker wrapper');
-- Reader/customer denial, bookkeeper access and finance entitlement are independent.
insert into public.memberships(organization_id,user_id,role) values('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','bookkeeper');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
do $$begin begin perform public.financial_reconciliation('20000000-0000-4000-8000-000000000001',current_date,current_date);raise exception 'TEST FAILED customer report';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000004","session_id":"10000000-0000-4000-8000-000000000004","aal":"aal1"}',true);
select pg_temp.assert_true((public.financial_reconciliation('20000000-0000-4000-8000-000000000001',current_date,current_date)->>'complete')::boolean,'current bookkeeper may read complete report');
reset role;
update public.entitlements set enabled=false where organization_id='20000000-0000-4000-8000-000000000001' and module='finance';
set local role authenticated;
do $$begin begin perform public.financial_reconciliation('20000000-0000-4000-8000-000000000001',current_date,current_date);raise exception 'TEST FAILED no finance entitlement';exception when others then if sqlerrm<>'SETUP_REQUIRED' then raise;end if;end;end$$;
reset role;
update public.entitlements set enabled=true where organization_id='20000000-0000-4000-8000-000000000001' and module='finance';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
reset role;
-- Bounded complete report must reject rather than silently cut transactions.
insert into public.business_expenses(organization_id,expense_date,vendor,category,description,amount_cents,payment_method,reference,recorded_by)
select '20000000-0000-4000-8000-000000000001',(now() at time zone 'America/Chicago')::date,'Synthetic bulk','tools','Synthetic boundary fixture',1,'cash','synthetic','00000000-0000-4000-8000-000000000001' from generate_series(1,10001);
set local role authenticated;
do $$declare today date:=(now() at time zone 'America/Chicago')::date;begin begin perform public.financial_reconciliation('20000000-0000-4000-8000-000000000001',today,today);raise exception 'TEST FAILED partial report';exception when others then if sqlerrm<>'EXPORT_RANGE_TOO_LARGE' then raise;end if;end;end$$;
reset role;
update auth.sessions set not_after=now()-interval '1 second' where id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin begin perform public.financial_reconciliation('20000000-0000-4000-8000-000000000001',current_date,current_date);raise exception 'TEST FAILED expired session';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
