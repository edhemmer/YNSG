-- Platform operations are deliberately separate from tenant/customer authorization.
create table private.platform_administrators(user_id uuid primary key references auth.users(id),revoked_at timestamptz,created_at timestamptz not null default now());
create table private.owner_subscription_records(organization_id uuid primary key references public.organizations(id),status text not null default 'not_activated' check(status in ('not_activated','trial','active','past_due','paused','canceled')),provider_subscription_ref text,revision integer not null default 1 check(revision>0),updated_at timestamptz not null default now());
create table private.platform_audit_events(id uuid primary key default gen_random_uuid(),actor_id uuid not null references auth.users(id),organization_id uuid not null references public.organizations(id),action text not null,occurred_at timestamptz not null default now());
create index platform_audit_actor on private.platform_audit_events(actor_id);
create index platform_audit_company on private.platform_audit_events(organization_id);
alter table private.platform_administrators enable row level security;
alter table private.owner_subscription_records enable row level security;
alter table private.platform_audit_events enable row level security;
revoke all on private.platform_administrators,private.owner_subscription_records,private.platform_audit_events from public,anon,authenticated,service_role;
create policy platform_admin_deny on private.platform_administrators to anon,authenticated using(false) with check(false);
create policy subscription_deny on private.owner_subscription_records to anon,authenticated using(false) with check(false);
create policy platform_audit_deny on private.platform_audit_events to anon,authenticated using(false) with check(false);
create function private.platform_admin() returns boolean language sql stable security definer set search_path='' as $$select private.live_identity(true) and exists(select 1 from private.platform_administrators where user_id=auth.uid() and revoked_at is null)$$;
revoke all on function private.platform_admin() from public,anon,service_role;
grant execute on function private.platform_admin() to authenticated;
create function public.platform_owner_accounts(p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.platform_admin() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_page is null or p_page<0 or p_page>10000 then raise exception 'VALIDATION';end if;
 -- No customer, property, request, invoice, notes, financial totals or tenant integrations are queried.
 return coalesce((select jsonb_agg(row_to_json(r)) from (select o.id,o.display_name,o.status as company_status,coalesce(s.status,'not_activated') as subscription_status,s.revision,
 (select coalesce(jsonb_agg(jsonb_build_object('email',u.email)), '[]'::jsonb) from public.memberships m join auth.users u on u.id=m.user_id where m.organization_id=o.id and m.role='owner' and m.revoked_at is null and u.deleted_at is null) as owners
 from public.organizations o left join private.owner_subscription_records s on s.organization_id=o.id order by o.created_at,o.id limit 51 offset p_page*50) r),'[]'::jsonb);
end$$;
revoke all on function public.platform_owner_accounts(integer) from public,anon,service_role;
grant execute on function public.platform_owner_accounts(integer) to authenticated;
-- No self-enrollment, impersonation, payment activation, entitlement changes or customer-data export RPC.
