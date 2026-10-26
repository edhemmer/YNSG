-- Narrow self-enrollment: never email-match or attach preexisting customers.
create function private.create_customer_profile(p_org uuid,p_key uuid,p_profile jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); account_email text; config jsonb; customer uuid; contact uuid; property uuid;
 command_name text; fingerprint text; previous private.command_receipts; result jsonb;
begin
 if actor is null or not private.live_identity(false) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_org is null or p_key is null or p_profile is null or jsonb_typeof(p_profile)<>'object'
  or (select count(*) from jsonb_object_keys(p_profile))<>5
  or exists(select 1 from jsonb_object_keys(p_profile) k where k not in ('name','phone','street','city','postalCode'))
  or exists(select 1 from jsonb_each(p_profile) kv where jsonb_typeof(kv.value)<>'string')
  or length(trim(p_profile->>'name')) not between 2 and 120
  or length(trim(p_profile->>'phone')) not between 7 and 35
  or length(trim(p_profile->>'street')) not between 5 and 200
  or p_profile->>'city' not in ('DeKalb','Sycamore','Cortland')
  or p_profile->>'postalCode' is distinct from (case p_profile->>'city' when 'DeKalb' then '60115' when 'Sycamore' then '60178' when 'Cortland' then '60112' end)
 then raise exception 'VALIDATION';end if;
 -- Serializes enrollment/replay for one live identity and company.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,831));
 perform 1 from public.organizations where id=p_org for update;
 perform pg_advisory_xact_lock(hashtextextended('customer-profile:'||p_org::text||':'||actor::text,0));
 if not private.live_identity(false) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select lower(trim(u.email)) into account_email from auth.users u where u.id=actor;
 if account_email is null or account_email='' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select c.settings into config from public.configuration_versions c join public.organizations o on o.id=c.organization_id
  where c.organization_id=p_org and o.status='active' order by c.version desc limit 1;
 if config is null or config->'intakeEnabled' is distinct from 'true'::jsonb or not coalesce(config->'cities' ? (p_profile->>'city'),false)
 then raise exception 'SETUP_REQUIRED';end if;
 command_name:='CreateCustomerProfile:'||actor::text;
 fingerprint:=encode(sha256(convert_to(p_profile::text,'UTF8')),'hex');
 select * into previous from private.command_receipts where organization_id=p_org and command=command_name and key=p_key::text;
 if found then
  if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  if not private.customer_allowed(p_org,(previous.result->>'customer')::uuid,true,true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  return previous.result;
 end if;
 -- A revoked/expired/delegated relationship cannot be bypassed through enrollment.
 if exists(select 1 from public.customer_access where organization_id=p_org and user_id=actor) then
  if exists(select 1 from public.customer_access where organization_id=p_org and user_id=actor and private.customer_allowed(p_org,customer_id,false,true)) then raise exception 'PROFILE_EXISTS';end if;
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 insert into public.customers(organization_id,display_name) values(p_org,trim(p_profile->>'name')) returning id into customer;
 insert into public.contacts(organization_id,customer_id,name,email,phone,relationship)
  values(p_org,customer,trim(p_profile->>'name'),account_email,trim(p_profile->>'phone'),'self') returning id into contact;
 insert into public.properties(organization_id,customer_id,street,city,region,postal_code)
  values(p_org,customer,trim(p_profile->>'street'),p_profile->>'city','IL',p_profile->>'postalCode') returning id into property;
 insert into public.customer_access(organization_id,customer_id,user_id,can_approve,can_view_billing) values(p_org,customer,actor,true,true);
 result:=jsonb_build_object('organization',p_org,'customer',customer,'contact',contact,'property',property);
 insert into private.command_receipts(organization_id,command,key,fingerprint,result) values(p_org,command_name,p_key::text,fingerprint,result);
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
  values(p_org,actor,'customer.self_enrolled',customer,1,p_key);
 return result;
end$$;
create function public.create_customer_profile(p_org uuid,p_key uuid,p_profile jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.create_customer_profile(p_org,p_key,p_profile)$$;
revoke all on function private.create_customer_profile(uuid,uuid,jsonb),public.create_customer_profile(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.create_customer_profile(uuid,uuid,jsonb),public.create_customer_profile(uuid,uuid,jsonb) to authenticated;
