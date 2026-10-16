-- Synthetic all-or-nothing import test: transaction scope only.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $qa$declare cid uuid;r jsonb;again jsonb; rev integer; contacts jsonb:='[{"name":"Imported one","email":"imported.one@example.invalid","phone":"","relationship":"Friend"}]'::jsonb;properties jsonb:='[{"street":"111 Test Import Street","city":"DeKalb","state":"IL","postalCode":"60115"}]'::jsonb;
begin
 insert into public.customers(organization_id,display_name) values('20000000-0000-4000-8000-000000000001','Synthetic import target') returning id into cid;
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
reset role;
rollback;
