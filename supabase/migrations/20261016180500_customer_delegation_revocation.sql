-- Customer delegation corrections: owner-only capabilities and irreversible revocation.
-- Grants remain invitation-only; this command cannot create or restore access.
create function public.manage_customer_delegate(p_org uuid,p_customer uuid,p_user uuid,p_action text,p_can_approve boolean default false,p_can_view_billing boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.customer_access%rowtype;changed boolean:=false;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_org is null or p_customer is null or p_user is null or p_action not in ('revoke','capabilities') then raise exception 'VALIDATION';end if;
 select * into target from public.customer_access
 where organization_id=p_org and customer_id=p_customer and user_id=p_user for update;
 if not found then raise exception 'ACCESS_NOT_FOUND' using errcode='42501';end if;
 if p_action='capabilities' then
  if target.revoked_at is not null or (target.expires_at is not null and target.expires_at<=now()) then raise exception 'ACCESS_REVOKED' using errcode='42501';end if;
  if target.can_approve is distinct from p_can_approve or target.can_view_billing is distinct from p_can_view_billing then
   update public.customer_access set can_approve=p_can_approve,can_view_billing=p_can_view_billing
   where organization_id=p_org and customer_id=p_customer and user_id=p_user;
   changed:=true;
  end if;
 else
  if target.revoked_at is null then
   update public.customer_access set revoked_at=now()
   where organization_id=p_org and customer_id=p_customer and user_id=p_user;
   changed:=true;
  end if;
 end if;
 if changed then
  insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
  select p_org,auth.uid(),case when p_action='revoke' then 'customer.delegate_revoked' else 'customer.delegate_updated' end,id,revision,gen_random_uuid()
  from public.customers where organization_id=p_org and id=p_customer;
 end if;
 return jsonb_build_object('customer',p_customer,'user',p_user,'revoked',p_action='revoke' or target.revoked_at is not null,'canApprove',case when p_action='revoke' then false else p_can_approve end,'canViewBilling',case when p_action='revoke' then false else p_can_view_billing end,'changed',changed);
end$$;
revoke all on function public.manage_customer_delegate(uuid,uuid,uuid,text,boolean,boolean) from public,anon,service_role;
grant execute on function public.manage_customer_delegate(uuid,uuid,uuid,text,boolean,boolean) to authenticated;

-- Read-only owner/customer relationship list; the current customer email is
-- shown only to authorized company owners and admins.
create function public.customer_delegates(p_org uuid,p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $delegates$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.customers where organization_id=p_org and id=p_customer) then raise exception 'NOT_FOUND' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user',a.user_id,'email',u.email,'canApprove',a.can_approve,'canViewBilling',a.can_view_billing,'revoked',a.revoked_at is not null,'expired',a.expires_at is not null and a.expires_at<=now()) order by a.created_at,a.user_id)
 from public.customer_access a join auth.users u on u.id=a.user_id where a.organization_id=p_org and a.customer_id=p_customer),'[]'::jsonb);
end$delegates$;
revoke all on function public.customer_delegates(uuid,uuid) from public,anon,service_role;
grant execute on function public.customer_delegates(uuid,uuid) to authenticated;
