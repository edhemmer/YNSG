-- Intentionally exposed owner RPCs must retain live authorization and a locked
-- namespace. Do not "fix" an advisor warning by breaking guarded workflows.
reset role;
do $review$
declare f record; reviewed integer:=0;
begin
 for f in select p.oid,p.proname,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) definition
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in (
  'apply_customer_import','audit_customer_export','authorize_customer_file',
  'customer_delegates','finalize_customer_file','list_customer_files',
  'manage_customer_delegate','mileage_activity','record_mileage_trip',
  'reserve_customer_file','reverse_mileage_trip','verified_customer_file_access')
 loop
  reviewed:=reviewed+1;
  if not f.prosecdef or not coalesce(f.proconfig @> array['search_path=""'],false)
   or has_function_privilege('anon',f.oid,'execute')
   or has_function_privilege('service_role',f.oid,'execute')
   or not has_function_privilege('authenticated',f.oid,'execute')
   or position('private.staff(p_org' in f.definition)=0
  then raise exception 'Owner RPC security boundary regressed: %',f.proname;end if;
 end loop;
 if reviewed<>12 then raise exception 'Expected 12 reviewed owner RPCs, found %',reviewed;end if;
 if position('private.live_identity(false)' in pg_get_functiondef('private.staff(uuid,text[])'::regprocedure))=0
  or position('m.revoked_at is null' in lower(pg_get_functiondef('private.staff(uuid,text[])'::regprocedure)))=0
 then raise exception 'Live staff identity/revocation guard missing';end if;
if has_function_privilege('authenticated','public.confirm_verified_customer_file(uuid,uuid,uuid,uuid,text,integer,text)','execute') or has_function_privilege('anon','public.confirm_verified_customer_file(uuid,uuid,uuid,uuid,text,integer,text)','execute') or not has_function_privilege('service_role','public.confirm_verified_customer_file(uuid,uuid,uuid,uuid,text,integer,text)','execute') then raise exception 'File server-verification privilege regressed';end if;
end$review$;
rollback;
