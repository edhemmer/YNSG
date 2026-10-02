-- R03/R04: control-plane invitation; verified identity + live MFA required to claim.
-- Invitations are provisioned only through the administrative database connection.
create table private.owner_setup_invitations (
 email text primary key check(email=lower(email)),
 slug text not null unique,
 display_name text not null,
 timezone text not null,
 expires_at timestamptz not null,
 claimed_by uuid references auth.users(id),
 organization_id uuid references public.organizations(id),
 check ((claimed_by is null)=(organization_id is null))
);
alter table private.owner_setup_invitations enable row level security;
revoke all on private.owner_setup_invitations from public,anon,authenticated,service_role;

create function private.owner_setup(p_claim boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare invitation private.owner_setup_invitations; owner_email text; org uuid;
begin
 if not private.live_identity(false) then raise exception 'UNAUTHORIZED' using errcode='42501';end if;
 select lower(email) into owner_email from auth.users where id=auth.uid();
 select * into invitation from private.owner_setup_invitations where email=owner_email for update;
 if not found then
  if p_claim then raise exception 'SETUP_NOT_INVITED' using errcode='42501';end if;
  return jsonb_build_object('eligible',false);
 end if;
 if invitation.claimed_by is not null then
  if invitation.claimed_by<>auth.uid() or not exists(select 1 from public.memberships where organization_id=invitation.organization_id and user_id=auth.uid() and role='owner' and revoked_at is null) then
   raise exception 'SETUP_NOT_INVITED' using errcode='42501';
  end if;
  if p_claim and not private.live_identity(true) then raise exception 'MFA_REQUIRED' using errcode='42501';end if;
  return jsonb_build_object('eligible',true,'organization',invitation.organization_id,'claimed',true);
 end if;
 if invitation.expires_at<=now() then
  if p_claim then raise exception 'SETUP_EXPIRED' using errcode='42501';end if;
  return jsonb_build_object('eligible',false);
 end if;
 if not p_claim then return jsonb_build_object('eligible',true,'claimed',false);end if;
 if not private.live_identity(true) then raise exception 'MFA_REQUIRED' using errcode='42501';end if;
 -- Never attach an invitation to an existing tenant or elevate an existing membership.
 insert into public.organizations(slug,display_name,timezone)
 values(invitation.slug,invitation.display_name,invitation.timezone) returning id into org;
 insert into public.memberships(organization_id,user_id,role) values(org,auth.uid(),'owner');
 insert into public.entitlements(organization_id,module,enabled) values(org,'crm',true);
 update private.owner_setup_invitations set claimed_by=auth.uid(),organization_id=org where email=owner_email;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
 values(org,auth.uid(),'owner_setup_claimed',org,1,gen_random_uuid());
 return jsonb_build_object('eligible',true,'claimed',true,'organization',org);
end $$;
revoke all on function private.owner_setup(boolean) from public,anon,service_role;
grant execute on function private.owner_setup(boolean) to authenticated;
create function public.owner_setup(p_claim boolean default false) returns jsonb
language sql security invoker set search_path='' as $$ select private.owner_setup(p_claim) $$;
revoke all on function public.owner_setup(boolean) from public,anon,service_role;
grant execute on function public.owner_setup(boolean) to authenticated;
