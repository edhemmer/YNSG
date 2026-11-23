-- Entire file runs inside the synthetic foundation transaction and rolls back.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$declare r jsonb;again jsonb;c uuid;list jsonb;one jsonb;
 base text:='{"accountType":"church_nonprofit","companyName":"Synthetic Fellowship","billingName":"Synthetic Treasurer","billingEmail":"Billing@Example.test","paymentTermsDays":15,"approvalLimitCents":30000,"stage":"walkthrough","nextAction":"Walk the building with trustees","followUpOn":"2026-12-01","lostReason":null}';
begin
 r:=public.manage_customer_record('20000000-0000-4000-8000-000000000001','{"action":"create_customer","value":{"displayName":"Synthetic business account"},"reason":"Synthetic creation"}','81000000-0000-4000-8000-000000000001');
 c:=(r->>'customerId')::uuid;
 -- Create: revision null for a new profile.
 r:=public.save_business_account('20000000-0000-4000-8000-000000000001',jsonb_build_object('customer',c,'revision',null,'value',base::jsonb,'reason','First visit'),'81000000-0000-4000-8000-000000000002');
 perform pg_temp.assert_true((r->>'revision')::int=1,'new business account starts at revision 1');
 again:=public.save_business_account('20000000-0000-4000-8000-000000000001',jsonb_build_object('customer',c,'revision',null,'value',base::jsonb,'reason','First visit'),'81000000-0000-4000-8000-000000000002');
 perform pg_temp.assert_true(r=again,'exact replay returns the same receipt');
 begin perform public.save_business_account('20000000-0000-4000-8000-000000000001',jsonb_build_object('customer',c,'revision',null,'value',base::jsonb,'reason','Changed'),'81000000-0000-4000-8000-000000000002');raise exception 'TEST FAILED changed replay';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;
 -- A second create with a null revision is stale.
 begin perform public.save_business_account('20000000-0000-4000-8000-000000000001',jsonb_build_object('customer',c,'revision',null,'value',base::jsonb,'reason','Dup'),'81000000-0000-4000-8000-000000000003');raise exception 'TEST FAILED duplicate create';exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;
 -- Lost requires a reason, and only lost carries one.
 begin perform public.save_business_account('20000000-0000-4000-8000-000000000001',jsonb_build_object('customer',c,'revision',1,'value',jsonb_set(base::jsonb,'{stage}','"lost"'),'reason','Lost'),'81000000-0000-4000-8000-000000000004');raise exception 'TEST FAILED lost without reason';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 begin perform public.save_business_account('20000000-0000-4000-8000-000000000001',jsonb_build_object('customer',c,'revision',1,'value',jsonb_set(base::jsonb,'{paymentTermsDays}','45'),'reason','Bad terms'),'81000000-0000-4000-8000-000000000005');raise exception 'TEST FAILED terms';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 begin perform public.save_business_account('20000000-0000-4000-8000-000000000001',jsonb_build_object('customer',c,'revision',1,'value',jsonb_set(base::jsonb,'{followUpOn}','"2026-02-31"'),'reason','Bad date'),'81000000-0000-4000-8000-000000000006');raise exception 'TEST FAILED date';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 begin perform public.save_business_account('20000000-0000-4000-8000-000000000001',jsonb_build_object('customer',c,'revision',1,'value',base::jsonb||'{"extra":1}','reason','Extra key'),'81000000-0000-4000-8000-000000000007');raise exception 'TEST FAILED extra key';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 -- Update with the exact revision; a stale revision is refused.
 r:=public.save_business_account('20000000-0000-4000-8000-000000000001',jsonb_build_object('customer',c,'revision',1,'value',jsonb_set(jsonb_set(base::jsonb,'{stage}','"lost"'),'{lostReason}','"timing"'),'reason','Not this year'),'81000000-0000-4000-8000-000000000008');
 perform pg_temp.assert_true((r->>'revision')::int=2,'update increments revision');
 begin perform public.save_business_account('20000000-0000-4000-8000-000000000001',jsonb_build_object('customer',c,'revision',1,'value',base::jsonb,'reason','Stale'),'81000000-0000-4000-8000-000000000009');raise exception 'TEST FAILED stale';exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;
 one:=public.owner_business_accounts('20000000-0000-4000-8000-000000000001',c);
 perform pg_temp.assert_true(one->'account'->>'billingEmail'='billing@example.test' and one->'account'->>'lostReason'='timing' and (one->'account'->>'approvalLimitCents')::int=30000,'profile reads back normalized');
 list:=public.owner_business_accounts('20000000-0000-4000-8000-000000000001',null,'lost',0);
 perform pg_temp.assert_true(jsonb_array_length(list->'items')=1 and list->'items'->0->>'displayName'='Synthetic business account','pipeline lists the account under its stage');
 list:=public.owner_business_accounts('20000000-0000-4000-8000-000000000001',null,'open',0);
 perform pg_temp.assert_true(jsonb_array_length(list->'items')=0 and (list->'counts'->>'total')::int=1,'lost accounts leave the open pipeline but stay counted');
end$$;
-- Browser roles cannot read the table directly; service role cannot call the owner command.
do $$begin
 begin perform 1 from public.customer_business_profiles;raise exception 'TEST FAILED direct read';exception when insufficient_privilege then null;end;
end$$;
reset role;
select pg_temp.assert_true((select count(*) from private.customer_record_changes where after_value ? 'businessAccount')=2,'each save is in the customer history');
select pg_temp.assert_true(not has_function_privilege('service_role','public.save_business_account(uuid,jsonb,text)','execute') and not has_function_privilege('anon','public.owner_business_accounts(uuid,uuid,text,integer)','execute') and has_function_privilege('service_role','public.marketing_business_sends(uuid,uuid[])','execute') and not has_function_privilege('authenticated','public.marketing_business_sends(uuid,uuid[])','execute'),'business account command surface is owner-only; segment lookup is worker-only');
rollback;
