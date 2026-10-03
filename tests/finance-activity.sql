-- Synthetic two-company finance assertions; fixture is rolled back.
insert into public.entitlements(organization_id,module,enabled) values
('20000000-0000-4000-8000-000000000001','finance',true),
('20000000-0000-4000-8000-000000000002','finance',true);
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.record_business_expense('20000000-0000-4000-8000-000000000001',timezone('America/Chicago',now())::date,'Synthetic Supply Shop','supplies','Work gloves',1299,'external_card','synthetic-receipt',true,'expense-test-key-000001');
select public.record_business_expense('20000000-0000-4000-8000-000000000001',timezone('America/Chicago',now())::date,'Synthetic Supply Shop','supplies','Work gloves',1299,'external_card','synthetic-receipt',true,'expense-test-key-000001');
select pg_temp.assert_true((select count(*)=1 from public.business_expenses),'idempotent expense records once');
select pg_temp.assert_true((select count(*)=2 from public.journal_lines where account in ('cash','expenses')),'two expense journal lines');
select pg_temp.assert_true((select (public.finance_activity('20000000-0000-4000-8000-000000000001',timezone('America/Chicago',now())::date,timezone('America/Chicago',now())::date)->>'expenseCents')::bigint=1299),'expense total exact');
do $$begin
 begin perform public.record_business_expense('20000000-0000-4000-8000-000000000001',timezone('America/Chicago',now())::date,'Synthetic Supply Shop','supplies','Changed gloves',1299,'external_card','synthetic-receipt',true,'expense-test-key-000001');raise exception 'TEST FAILED changed retry';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;
 begin perform public.record_business_expense('20000000-0000-4000-8000-000000000001',(timezone('America/Chicago',now())::date+1),'Synthetic Supply Shop','supplies','Future gloves',100,'cash','synthetic',true,'expense-test-key-000002');raise exception 'TEST FAILED future expense';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 begin perform public.record_business_expense('20000000-0000-4000-8000-000000000002',timezone('America/Chicago',now())::date,'Synthetic Supply Shop','supplies','Cross-tenant gloves',100,'cash','synthetic',true,'expense-test-key-000003');raise exception 'TEST FAILED cross-tenant record';exception when insufficient_privilege then null;end;
end$$;
select public.reverse_business_expense('20000000-0000-4000-8000-000000000001',(select id from public.business_expenses limit 1),'Wrong receipt entered','expense-reverse-key-001');
select public.reverse_business_expense('20000000-0000-4000-8000-000000000001',(select id from public.business_expenses limit 1),'Wrong receipt entered','expense-reverse-key-001');
select pg_temp.assert_true((select (public.finance_activity('20000000-0000-4000-8000-000000000001',timezone('America/Chicago',now())::date,timezone('America/Chicago',now())::date)->>'expenseCents')::bigint=0),'reversal removes amount from corrected report');
select pg_temp.assert_true((select count(*)=4 and sum(debit_cents)=2598 and sum(credit_cents)=2598 from public.journal_lines),'expense and reversal ledger balanced');
do $$begin
 begin perform public.reverse_business_expense('20000000-0000-4000-8000-000000000001',(select id from public.business_expenses limit 1),'Another reversal attempt','expense-reverse-key-002');raise exception 'TEST FAILED duplicate reversal';exception when raise_exception then if sqlerrm<>'ALREADY_REVERSED' then raise;end if;end;
 begin update public.business_expenses set amount_cents=1;raise exception 'TEST FAILED direct update';exception when insufficient_privilege then null;end;
end$$;
do $$declare n integer;begin
 for n in 1..55 loop
  perform public.record_business_expense('20000000-0000-4000-8000-000000000001',timezone('America/Chicago',now())::date,'Synthetic Shop','tools','Synthetic item',100,'cash','receipt-'||n,true,'many-expense-'||lpad(n::text,12,'0'));
 end loop;
end$$;
select pg_temp.assert_true((select (public.finance_activity('20000000-0000-4000-8000-000000000001',timezone('America/Chicago',now())::date,timezone('America/Chicago',now())::date)->>'expenseCents')::bigint=5500),'report totals span beyond 50-row workspace page');
select pg_temp.assert_true((select (public.finance_activity('20000000-0000-4000-8000-000000000001',(timezone('America/Chicago',now())::date-1),(timezone('America/Chicago',now())::date-1))->>'expenseCents')::bigint=0),'date range excludes other days');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
select pg_temp.assert_true((select count(*)=0 from public.business_expenses),'customer sees no expenses');
do $$begin
 begin perform public.finance_activity('20000000-0000-4000-8000-000000000001',timezone('America/Chicago',now())::date,timezone('America/Chicago',now())::date);raise exception 'TEST FAILED customer report';exception when insufficient_privilege then null;end;
 begin perform public.record_business_expense('20000000-0000-4000-8000-000000000001',timezone('America/Chicago',now())::date,'Synthetic Supply Shop','supplies','Customer forged',100,'cash','synthetic',true,'expense-test-key-000004');raise exception 'TEST FAILED customer record';exception when insufficient_privilege then null;end;
end$$;
reset role;
select 'PASS: finance authorization, replay, reversal, balances, and report assertions' as evidence;
rollback;
