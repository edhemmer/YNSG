-- A selected, provider-checked calendar is a live connection, not a Gmail test.
-- Keep failures visible; do not enable email or change scheduling permissions.
do $$declare definition text;old text:=$old$case when a.encrypted_tokens is null then 'disabled' when a.calendar_id is null then 'configured' else 'test' end$old$;
 replacement text:=$new$case when a.encrypted_tokens is null then 'disabled' when a.calendar_id is null then 'configured' when a.health in ('connected','healthy') then 'active' else 'error' end$new$;
begin
 definition:=pg_get_functiondef('private.google_store(uuid,text,jsonb)'::regprocedure);
 if position(old in definition)=0 then raise exception 'MIGRATION_REVIEW_REQUIRED';end if;
 execute replace(definition,old,replacement);
end$$;
update public.integration_connections c set
 status=case when a.encrypted_tokens is null then 'disabled' when a.calendar_id is null then 'configured' when a.health in('connected','healthy') then 'active' else 'error' end
from private.google_accounts a where c.organization_id=a.organization_id and c.provider='google_calendar';

create table private.maps_probe_states(
 organization_id uuid primary key references public.organizations(id),
 key_fingerprint text not null check(key_fingerprint~'^[a-f0-9]{64}$'),
 status text not null check(status in('active','error','disabled')),checked_at timestamptz not null
);
create table private.google_route_budget(
 id integer primary key check(id=1),day date not null,month date not null,
 daily_calls integer not null check(daily_calls>=0),monthly_calls integer not null check(monthly_calls>=0)
);
alter table private.maps_probe_states enable row level security;
alter table private.google_route_budget enable row level security;
revoke all on private.maps_probe_states,private.google_route_budget from public,anon,authenticated,service_role;
create policy maps_probe_deny on private.maps_probe_states to anon,authenticated using(false) with check(false);
create policy route_budget_deny on private.google_route_budget to anon,authenticated using(false) with check(false);

-- Atomic, deployment-wide budget across all CRM tenants and environments.
-- This does not meter other apps sharing the Google billing account.
create function private.reserve_google_route_request() returns boolean
language plpgsql security definer set search_path='' as $$
declare today date:=(clock_timestamp() at time zone 'America/Los_Angeles')::date;
 this_month date:=date_trunc('month',today)::date;b private.google_route_budget;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 insert into private.google_route_budget values(1,today,this_month,0,0) on conflict do nothing;
 select * into b from private.google_route_budget where id=1 for update;
 if b.day<>today then b.day:=today;b.daily_calls:=0;end if;
 if b.month<>this_month then b.month:=this_month;b.monthly_calls:=0;end if;
 if b.daily_calls>=100 or b.monthly_calls>=4000 then return false;end if;
 update private.google_route_budget set day=b.day,month=b.month,daily_calls=b.daily_calls+1,monthly_calls=b.monthly_calls+1 where id=1;
 return true;
end$$;
create function public.reserve_google_route_request() returns boolean language sql security invoker set search_path='' as $$select private.reserve_google_route_request()$$;
revoke all on function private.reserve_google_route_request(),public.reserve_google_route_request() from public,anon,authenticated;
grant execute on function private.reserve_google_route_request(),public.reserve_google_route_request() to service_role;

-- Server-only probe bridge. No API key or fingerprint is exposed to tenants.
create function private.routes_connection_health(p_org uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare state private.maps_probe_states;fingerprint text:=p_input->>'fingerprint';result text:=p_input->>'status';
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.organizations where id=p_org and status='active') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_action='read' then select * into state from private.maps_probe_states where organization_id=p_org;return case when state.organization_id is null then null else to_jsonb(state) end;end if;
 if p_action<>'record' or fingerprint is null or fingerprint!~'^[a-f0-9]{64}$' or result is null or result not in('active','error','disabled') then raise exception 'VALIDATION';end if;
 insert into private.maps_probe_states values(p_org,fingerprint,result,clock_timestamp())
 on conflict(organization_id) do update set key_fingerprint=excluded.key_fingerprint,status=excluded.status,checked_at=excluded.checked_at;
 insert into public.integration_connections(organization_id,provider,status,last_success_at,last_error,secret_ref)
 values(p_org,'maps',result,case when result='active' then clock_timestamp() end,case when result='error' then 'Routes API verification failed. Check key restrictions, API enablement, billing and quota.' end,case when result<>'disabled' then 'deployment:GOOGLE_ROUTES_API_KEY' end)
 on conflict(organization_id,provider) do update set status=excluded.status,last_success_at=coalesce(excluded.last_success_at,public.integration_connections.last_success_at),last_error=excluded.last_error,secret_ref=excluded.secret_ref;
 return jsonb_build_object('status',result,'checkedAt',clock_timestamp());
end$$;
create function public.routes_connection_health(p_org uuid,p_action text,p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.routes_connection_health(p_org,p_action,p_input)$$;
revoke all on function private.routes_connection_health(uuid,text,jsonb),public.routes_connection_health(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.routes_connection_health(uuid,text,jsonb),public.routes_connection_health(uuid,text,jsonb) to service_role;
