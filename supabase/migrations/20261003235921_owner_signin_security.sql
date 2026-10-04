-- Server-authenticated owner sign-in audit. Secret digest is provisioned outside Git.
create table private.owner_security_config (
 singleton boolean primary key default true check(singleton), secret_digest bytea not null
);
create table private.owner_signin_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 actor_id uuid references auth.users(id), session_id uuid,
 ip_address inet not null, kind text not null check(kind in ('link_requested','link_limited','code_rejected','session_seen')),
 occurred_at timestamptz not null default now(),
 check((kind='session_seen' and organization_id is not null and actor_id is not null and session_id is not null)
    or (kind<>'session_seen' and organization_id is null and actor_id is null and session_id is null))
);
create unique index owner_signin_session_once on private.owner_signin_events(organization_id,session_id) where kind='session_seen';
create index owner_signin_recent on private.owner_signin_events(organization_id,occurred_at desc);
create index owner_signin_ip_recent on private.owner_signin_events(ip_address,occurred_at desc) where kind in ('link_requested','link_limited');
alter table private.owner_security_config enable row level security;
alter table private.owner_signin_events enable row level security;
revoke all on private.owner_security_config,private.owner_signin_events from public,anon,authenticated;

create function private.owner_security_event(p_secret text,p_ip inet,p_kind text,p_org uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare expected bytea; attempts integer; sid uuid;
begin
 select secret_digest into expected from private.owner_security_config where singleton=true;
 if expected is null or p_secret is null or length(p_secret)<32 or sha256(convert_to(p_secret,'UTF8'))<>expected then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if p_ip is null or p_kind not in ('link_requested','code_rejected','session_seen') then raise exception 'VALIDATION';end if;
 delete from private.owner_signin_events where occurred_at<now()-interval '30 days';
 if p_kind='session_seen' then
  if p_org is null or not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  sid:=nullif(auth.jwt()->>'session_id','')::uuid;
  if sid is null then raise exception 'UNAUTHORIZED' using errcode='42501';end if;
  insert into private.owner_signin_events(organization_id,actor_id,session_id,ip_address,kind)
  values(p_org,auth.uid(),sid,p_ip,'session_seen') on conflict do nothing;
  return jsonb_build_object('allowed',true);
 end if;
 if p_org is not null then raise exception 'VALIDATION';end if;
 if p_kind='link_requested' then
  perform pg_advisory_xact_lock(hashtextextended('owner-login:'||p_ip::text,0));
  select count(*) into attempts from private.owner_signin_events where ip_address=p_ip and kind in ('link_requested','link_limited') and occurred_at>now()-interval '15 minutes';
  if attempts>=8 then
   insert into private.owner_signin_events(ip_address,kind) values(p_ip,'link_limited');
   return jsonb_build_object('allowed',false);
  end if;
 end if;
 insert into private.owner_signin_events(ip_address,kind) values(p_ip,p_kind);
 return jsonb_build_object('allowed',true);
end$$;
create function public.owner_security_event(p_secret text,p_ip inet,p_kind text,p_org uuid default null) returns jsonb
language sql security definer set search_path='' as $$select private.owner_security_event(p_secret,p_ip,p_kind,p_org)$$;
create function private.owner_security_recent(p_org uuid) returns jsonb
language plpgsql security definer stable set search_path='' as $$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('occurredAt',s.occurred_at,'ip',s.ip_address::text,'actorId',s.actor_id) order by s.occurred_at desc)
 from (select occurred_at,ip_address,actor_id from private.owner_signin_events where organization_id=p_org and kind='session_seen' and occurred_at>=now()-interval '30 days' order by occurred_at desc limit 20) s),'[]'::jsonb);
end$$;
create function public.owner_security_recent(p_org uuid) returns jsonb language sql security invoker set search_path='' as $$select private.owner_security_recent(p_org)$$;
revoke all on function private.owner_security_event(text,inet,text,uuid),public.owner_security_event(text,inet,text,uuid),private.owner_security_recent(uuid),public.owner_security_recent(uuid) from public,anon,authenticated;
grant execute on function public.owner_security_event(text,inet,text,uuid) to anon,authenticated;
grant execute on function private.owner_security_recent(uuid),public.owner_security_recent(uuid) to authenticated;
