create table private.customer_account_invitations (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'), organization_id uuid not null, customer_id uuid not null,
 email text not null, expires_at timestamptz not null default now()+interval '24 hours', created_by uuid not null references auth.users(id),
 claimed_by uuid references auth.users(id),claimed_at timestamptz,
 foreign key(organization_id,customer_id) references public.customers(organization_id,id)
);
create index customer_account_invitation_customer on private.customer_account_invitations(organization_id,customer_id);
create index customer_account_invitation_creator on private.customer_account_invitations(created_by);
create index customer_account_invitation_claimant on private.customer_account_invitations(claimed_by) where claimed_by is not null;
alter table private.customer_account_invitations enable row level security;
revoke all on private.customer_account_invitations from public,anon,authenticated,service_role;
create policy account_invitation_deny on private.customer_account_invitations to anon,authenticated using(false) with check(false);
create function public.invite_customer_account(p_org uuid,p_customer uuid,p_email text,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_email is null or length(p_email)>254 then raise exception 'VALIDATION';end if;
 if not exists(select 1 from public.contacts where organization_id=p_org and customer_id=p_customer and lower(trim(email))=lower(trim(p_email))) then raise exception 'CONTACT_REQUIRED';end if;
 insert into private.customer_account_invitations(token_hash,organization_id,customer_id,email,created_by) values(p_hash,p_org,p_customer,lower(trim(p_email)),auth.uid());
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) select p_org,auth.uid(),'customer.account_invited',id,revision,gen_random_uuid() from public.customers where organization_id=p_org and id=p_customer;
 return jsonb_build_object('expiresAt',now()+interval '24 hours');
end$$;
create function public.claim_customer_account(p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare invitation private.customer_account_invitations;email_address text;result jsonb;
begin
 if not private.live_identity(false) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select lower(trim(email)) into email_address from auth.users where id=auth.uid() and email_confirmed_at is not null;
 select * into invitation from private.customer_account_invitations where token_hash=p_hash for update;
 if not found or invitation.expires_at<=now() or invitation.email is distinct from email_address or (invitation.claimed_by is not null and invitation.claimed_by<>auth.uid()) then raise exception 'INVALID_INVITATION' using errcode='42501';end if;
 if not exists(select 1 from public.organizations where id=invitation.organization_id and status='active') then raise exception 'SETUP_REQUIRED';end if;
 if not exists(select 1 from public.contacts where organization_id=invitation.organization_id and customer_id=invitation.customer_id and lower(trim(email))=email_address) then raise exception 'INVALID_INVITATION';end if;
 if invitation.claimed_by is null then
  -- Existing revoked access is never silently restored by an old invitation.
  if exists(select 1 from public.customer_access where organization_id=invitation.organization_id and customer_id=invitation.customer_id and user_id=auth.uid()) then raise exception 'ACCESS_REVIEW_REQUIRED';end if;
  insert into public.customer_access(organization_id,customer_id,user_id,can_approve,can_view_billing) values(invitation.organization_id,invitation.customer_id,auth.uid(),true,true);
  update private.customer_account_invitations set claimed_by=auth.uid(),claimed_at=now() where token_hash=p_hash;
  insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) select invitation.organization_id,auth.uid(),'customer.account_connected',id,revision,gen_random_uuid() from public.customers where organization_id=invitation.organization_id and id=invitation.customer_id;
 end if;
 result:=jsonb_build_object('organization',invitation.organization_id,'customer',invitation.customer_id);return result;
end$$;
revoke all on function public.invite_customer_account(uuid,uuid,text,text),public.claim_customer_account(text) from public,anon,service_role;
grant execute on function public.invite_customer_account(uuid,uuid,text,text),public.claim_customer_account(text) to authenticated;
