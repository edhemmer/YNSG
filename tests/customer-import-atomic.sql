-- Synthetic all-or-nothing import test: transaction scope only.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $qa$declare cid uuid;r jsonb;again jsonb; rev integer; contacts jsonb:='[{"name":"Imported one","email":"imported.one@example.invalid","phone":"","relationship":"Friend"}]'::jsonb;properties jsonb:='[{"street":"111 Test Import Street","city":"DeKalb","state":"IL","postalCode":"60115"}]'::jsonb;
begin
 r:=public.manage_customer_record('20000000-0000-4000-8000-000000000001','{"action":"create_customer","value":{"displayName":"Synthetic import target"},"reason":"Synthetic import fixture"}','80000000-0000-4000-8000-000000000076'); cid:=(r->>'customerId')::uuid;
 r:=public.apply_customer_import('20000000-0000-4000-8000-000000000001',cid,1,'86000000-0000-4000-8000-000000000001',contacts,properties);
 perform pg_temp.assert_true((r->>'contactsAdded')::integer=1 and (r->>'propertiesAdded')::integer=1,'imports both children transactionally');
 perform pg_temp.assert_true((r->>'revision')::integer=3,'two new children advance parent revision twice');
 again:=public.apply_customer_import('20000000-0000-4000-8000-000000000001',cid,1,'86000000-0000-4000-8000-000000000001',contacts,properties);
 perform pg_temp.assert_true(r=again,'same import key gets same canonical receipt');
 perform pg_temp.assert_true((select count(*)=1 from public.contacts where organization_id='20000000-0000-4000-8000-000000000001' and customer_id=cid),'no contact duplication');
 begin perform public.apply_customer_import('20000000-0000-4000-8000-000000000001',cid,3,'86000000-0000-4000-8000-000000000002',contacts,'[]'::jsonb);raise exception 'TEST FAILED duplicate';exception when raise_exception then if sqlerrm<>'DUPLICATE_CONTACT' then raise;end if;end;
 begin perform public.apply_customer_import('20000000-0000-4000-8000-000000000001',cid,1,'86000000-0000-4000-8000-000000000003',contacts,'[]'::jsonb);raise exception 'TEST FAILED stale import';exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;
 begin perform public.apply_customer_import('20000000-0000-4000-8000-000000000001',cid,3,'86000000-0000-4000-8000-000000000004','[{"name":"Different Contact","email":"valid@example.invalid","phone":"","relationship":"Friend"}]'::jsonb,'[{"street":"No","city":"DeKalb","state":"IL","postalCode":"60115"}]'::jsonb);raise exception 'TEST FAILED partial save';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 perform pg_temp.assert_true((select count(*)=1 from public.contacts where organization_id='20000000-0000-4000-8000-000000000001' and customer_id=cid),'failed multi-item import rolls back preceding insert');
end$qa$;
-- A different authenticated actor cannot replay a prior owner's request key or read the private receipt.
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000004","session_id":"10000000-0000-4000-8000-000000000004","aal":"aal1"}',true);
do $qa$begin
 begin
  perform public.apply_customer_import('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1,'86000000-0000-4000-8000-000000000001','[{"name":"Denied Test","email":"denied@example.invalid","phone":"","relationship":"Friend"}]'::jsonb,'[]'::jsonb);
  raise exception 'TEST FAILED unauthorized import';
 exception when insufficient_privilege then null;end;
end$qa$;
reset role;
select pg_temp.assert_true((select count(*)=1 from private.customer_import_receipts where organization_id='20000000-0000-4000-8000-000000000001' and request_key='86000000-0000-4000-8000-000000000001'),'denied actor did not add a receipt');
reset role;
rollback;
