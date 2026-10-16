-- Customer portability audit: records explicit owner export disclosure, no account data returned.
create function public.audit_customer_export(p_org uuid,p_customer uuid,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $audit$
declare existing uuid;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or not exists(select 1 from public.customers where organization_id=p_org and id=p_customer) then raise exception 'NOT_FOUND' using errcode='42501';end if;
 select id into existing from public.audit_events where organization_id=p_org and actor_id=auth.uid() and action='customer.exported'
  and object_id=p_customer and correlation_id=p_key limit 1;
 if existing is null then
  insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
  values(p_org,auth.uid(),'customer.exported',p_customer,1,p_key);
 end if;
 return jsonb_build_object('logged',true,'customer',p_customer,'key',p_key);
end$audit$;
revoke all on function public.audit_customer_export(uuid,uuid,uuid) from public,anon,service_role;
grant execute on function public.audit_customer_export(uuid,uuid,uuid) to authenticated;
