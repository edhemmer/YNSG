-- Account identity deletion is distinct from retained company evidence.
create table private.retention_policies (
 organization_id uuid not null references public.organizations(id), version integer not null,
 record_days integer not null check(record_days between 1 and 36500), audit_days integer not null check(audit_days between 1 and 36500),
 basis text not null check(length(basis) between 10 and 2000), notice text not null check(length(notice) between 10 and 2000),
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(), primary key(organization_id,version)
);
create table private.account_deletions (
 id uuid primary key, user_id uuid not null references auth.users(id), secret_hash text not null,
 status text not null check(status in ('requested','canceled','processing','completed')), revision integer not null default 1,
 created_at timestamptz not null default now(), processing_at timestamptz, completed_at timestamptz, lease uuid, lease_until timestamptz
);
create unique index account_deletion_active on private.account_deletions(user_id) where status<>'canceled';
create table private.deletion_reviews (
 request_id uuid not null references private.account_deletions(id), organization_id uuid not null references public.organizations(id),
 policy_version integer not null, actor_id uuid not null references auth.users(id), reviewed_at timestamptz not null default now(),
 primary key(request_id,organization_id,policy_version), foreign key(organization_id,policy_version) references private.retention_policies(organization_id,version)
);
create table private.retention_holds (
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 reason text not null check(length(reason) between 10 and 2000), review_on date not null,
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 released_at timestamptz, released_by uuid references auth.users(id), release_reason text
);
create table private.retention_events (
 id uuid primary key default gen_random_uuid(), request_id uuid references private.account_deletions(id),
 organization_id uuid references public.organizations(id), actor_id uuid references auth.users(id),
 action text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table private.retention_policies enable row level security;
alter table private.account_deletions enable row level security;
alter table private.deletion_reviews enable row level security;
alter table private.retention_holds enable row level security;
alter table private.retention_events enable row level security;
revoke all on private.retention_policies,private.account_deletions,private.deletion_reviews,private.retention_holds,private.retention_events from public,anon,authenticated,service_role;
create table private.privacy_receipts(actor_id uuid not null references auth.users(id), key uuid not null, fingerprint text not null, result jsonb not null, primary key(actor_id,key));
alter table private.privacy_receipts enable row level security;
revoke all on private.privacy_receipts from public,anon,authenticated,service_role;
-- Keep a separate session predicate for narrow deletion recovery while business access is blocked.
create function private.privacy_identity(p_fresh boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
 where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id' and u.deleted_at is null and not u.is_anonymous
 and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
 and (s.not_after is null or s.not_after>now())
 and (not p_fresh or (s.created_at<=clock_timestamp() and s.created_at>=clock_timestamp()-interval '15 minutes')))
$$;
create or replace function private.live_identity(require_mfa boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select private.privacy_identity(false)
 and (not require_mfa or exists(select 1 from auth.sessions where id::text=auth.jwt()->>'session_id' and user_id=auth.uid() and aal='aal2' and auth.jwt()->>'aal'='aal2'))
 and not exists(select 1 from private.account_deletions where user_id=auth.uid() and status in ('processing','completed'))
$$;
create function private.deletion_scopes(p_user uuid) returns setof uuid
language sql stable security definer set search_path='' as $$
 select organization_id from public.memberships where user_id=p_user
 union select organization_id from public.customer_access where user_id=p_user
 union select organization_id from public.audit_events where actor_id=p_user
$$;
create function private.privacy_command(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a text:=p->>'action'; org uuid:=(p->>'organization')::uuid; rid uuid:=(p->>'request')::uuid;
 r private.account_deletions; pol private.retention_policies; v integer; scopes jsonb; result jsonb; hid uuid; receipt private.privacy_receipts;
begin
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>12000 then raise exception 'INVALID_COMMAND';end if;
 if not private.privacy_identity(false) then raise exception 'UNAUTHORIZED' using errcode='42501';end if;
 -- Serialize commands for one identity, and owner changes against deletion processing per company.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,831));
 if a in ('policy','hold','release','approve','retain') then
  perform 1 from public.organizations where id=org for update;
  perform 1 from public.memberships where organization_id=org and user_id=auth.uid() for share;
  if not private.staff(org,array['owner']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if not private.privacy_identity(true) then raise exception 'REAUTHENTICATION_REQUIRED';end if;
 end if;
 if a not in ('read','fresh') then
  if p->>'key' is null then raise exception 'INVALID_COMMAND';end if;
  select * into receipt from private.privacy_receipts where actor_id=auth.uid() and key=(p->>'key')::uuid;
  if found then
   if receipt.fingerprint<>encode(sha256(convert_to(p::text,'UTF8')),'hex') then raise exception 'COMMAND_CONFLICT';end if;
   return receipt.result;
  end if;
 end if;
 if (select count(*) from private.deletion_scopes(auth.uid()))>100 then raise exception 'PRIVACY_SCOPE_REVIEW_REQUIRED';end if;
 if a='policy' then
  select coalesce(max(version),0) into v from private.retention_policies where organization_id=org;
  if v is distinct from (p->>'revision')::integer then raise exception 'STALE_REVISION';end if;
  if (p->>'reviewed') is distinct from 'true' then raise exception 'REVIEW_REQUIRED';end if;
  insert into private.retention_policies values(org,v+1,(p->>'recordDays')::integer,(p->>'auditDays')::integer,p->>'basis',p->>'notice',auth.uid(),now());
 elsif a='hold' then
  hid:=(p->>'hold')::uuid;
  if exists(select 1 from private.retention_holds where id=hid) then
   if not exists(select 1 from private.retention_holds where id=hid and organization_id=org and actor_id=auth.uid() and reason=p->>'reason' and review_on=(p->>'reviewOn')::date) then raise exception 'COMMAND_CONFLICT';end if;
  else
   insert into private.retention_holds(id,organization_id,reason,review_on,actor_id) values(hid,org,p->>'reason',(p->>'reviewOn')::date,auth.uid());
  end if;
 elsif a='release' then
  if length(coalesce(p->>'reason','')) not between 10 and 2000 then raise exception 'REVIEW_REQUIRED';end if;
  update private.retention_holds set released_at=now(),released_by=auth.uid(),release_reason=p->>'reason' where id=(p->>'hold')::uuid and organization_id=org and released_at is null;
  if not found then raise exception 'STALE_REVISION';end if;
 elsif a='approve' then
  select * into r from private.account_deletions where id=rid for update;
  if not found or r.status<>'requested' or r.revision is distinct from (p->>'revision')::integer or org not in(select private.deletion_scopes(r.user_id)) then raise exception 'STALE_REVISION';end if;
  select * into pol from private.retention_policies where organization_id=org order by version desc limit 1;
  if pol.version is null or pol.version is distinct from (p->>'policyVersion')::integer then raise exception 'POLICY_REQUIRED';end if;
  if exists(select 1 from private.retention_holds where organization_id=org and released_at is null) then raise exception 'LEGAL_HOLD';end if;
  insert into private.deletion_reviews values(rid,org,pol.version,auth.uid(),now()) on conflict do nothing;
 elsif a='retain' then
  select * into r from private.account_deletions where id=rid for update;
  if not found or coalesce(r.status,'requested') not in ('processing','completed') or org not in(select private.deletion_scopes(r.user_id)) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  select count(*) into v from private.retention_events where request_id=rid and organization_id=org and action='retain';
  if v is distinct from (p->>'revision')::integer then raise exception 'STALE_REVISION';end if;
  if length(coalesce(p->>'reason','')) not between 10 and 2000 or (p->>'reviewOn') is null or (p->>'reviewOn')::date<=current_date then raise exception 'REVIEW_REQUIRED';end if;
 elsif a='request' then
  if (p->>'secret') is null or (p->>'secret')!~'^[a-f0-9]{64}$' then raise exception 'INVALID_RECEIPT';end if;
  if not private.privacy_identity(true) then raise exception 'REAUTHENTICATION_REQUIRED';end if;
  select * into r from private.account_deletions where id=rid;
  if found then
   if r.user_id<>auth.uid() or r.secret_hash<>encode(sha256(convert_to(p->>'secret','UTF8')),'hex') then raise exception 'COMMAND_CONFLICT';end if;
  else
   insert into private.account_deletions(id,user_id,secret_hash,status) values(rid,auth.uid(),encode(sha256(convert_to(p->>'secret','UTF8')),'hex'),'requested');
  end if;
 elsif a in ('cancel','prepare') then
  if a='prepare' then perform 1 from public.organizations where id in(select private.deletion_scopes(auth.uid())) order by id for update;end if;
  select * into r from private.account_deletions where id=rid and user_id=auth.uid() for update;
  if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if a='cancel' and r.status='canceled' then return jsonb_build_object('status','canceled','revision',r.revision);end if;
  if r.status<>'requested' or r.revision is distinct from (p->>'revision')::integer then raise exception 'STALE_REVISION';end if;
  if not private.privacy_identity(true) then raise exception 'REAUTHENTICATION_REQUIRED';end if;
  if a='prepare' then
   if r.secret_hash is distinct from encode(sha256(convert_to(p->>'secret','UTF8')),'hex') then raise exception 'INVALID_RECEIPT';end if;
   if (p->>'confirmation') is distinct from 'DELETE MY ACCOUNT' then raise exception 'REVIEW_REQUIRED';end if;
   perform 1 from public.organizations where id in(select private.deletion_scopes(auth.uid())) order by id for update;
   perform 1 from public.memberships where organization_id in(select private.deletion_scopes(auth.uid())) order by organization_id,user_id for update;
   if exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.role='owner' and m.revoked_at is null
    and not exists(select 1 from public.memberships other where other.organization_id=m.organization_id and other.user_id<>auth.uid() and other.role='owner' and other.revoked_at is null
    and not exists(select 1 from private.account_deletions d where d.user_id=other.user_id and d.status in ('processing','completed')))) then raise exception 'SOLE_OWNER';end if;
   if exists(select 1 from private.retention_holds where organization_id in(select private.deletion_scopes(auth.uid())) and released_at is null) then raise exception 'LEGAL_HOLD';end if;
   if exists(select 1 from private.deletion_scopes(auth.uid()) s where not exists(select 1 from private.retention_policies pp join private.deletion_reviews dr on dr.organization_id=pp.organization_id and dr.policy_version=pp.version and dr.request_id=rid
     where pp.organization_id=s and pp.version=(select max(version) from private.retention_policies where organization_id=s))) then raise exception 'REVIEW_REQUIRED';end if;
   update private.account_deletions set status='processing',processing_at=now(),revision=revision+1 where id=rid;
   update public.memberships set revoked_at=now() where user_id=auth.uid() and revoked_at is null;
   update public.customer_access set revoked_at=now() where user_id=auth.uid() and revoked_at is null;
  else update private.account_deletions set status='canceled',revision=revision+1 where id=rid;end if;
 elsif a='fresh' then
  if not private.privacy_identity(true) then raise exception 'REAUTHENTICATION_REQUIRED';end if;
  return jsonb_build_object('fresh',true);
 elsif a<>'read' then raise exception 'INVALID_ACTION';
 end if;
 if a not in ('read','fresh') then insert into private.retention_events(request_id,organization_id,actor_id,action,details) values(case when a in ('request','cancel','prepare','approve','retain') then rid end,org,auth.uid(),a,case when a='retain' then jsonb_build_object('reason',p->>'reason','reviewOn',p->>'reviewOn','revision',v+1) else '{}'::jsonb end);end if;
 select * into r from private.account_deletions where user_id=auth.uid() order by created_at desc,id desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('organization',o.id,'name',o.display_name,'policy',
  (select jsonb_build_object('version',pp.version,'recordDays',pp.record_days,'auditDays',pp.audit_days,'notice',pp.notice) from private.retention_policies pp where pp.organization_id=o.id and (coalesce(r.status,'requested') not in ('processing','completed') or pp.version=(select max(dr.policy_version) from private.deletion_reviews dr where dr.request_id=r.id and dr.organization_id=o.id)) order by version desc limit 1),
  'held',exists(select 1 from private.retention_holds where organization_id=o.id and released_at is null),
  'approved',exists(select 1 from private.deletion_reviews dr where dr.request_id=r.id and dr.organization_id=o.id and dr.policy_version=(select max(version) from private.retention_policies where organization_id=o.id)))),'[]') into scopes
  from public.organizations o where o.id in(select private.deletion_scopes(auth.uid()));
 result:=jsonb_build_object('request',case when r.id is null then null else jsonb_build_object('id',r.id,'status',r.status,'revision',r.revision) end,'scopes',scopes);
 if org is not null and private.staff(org,array['owner']) then
  select * into pol from private.retention_policies where organization_id=org order by version desc limit 1;
  result:=result||jsonb_build_object('policy',case when pol.version is null then null else to_jsonb(pol)-'actor_id'-'organization_id' end,
   'holds',(select coalesce(jsonb_agg(to_jsonb(h)-'actor_id'-'released_by'-'organization_id'),'[]') from (select * from private.retention_holds where organization_id=org and ((p->>'holdsAfter') is null or id>(p->>'holdsAfter')::uuid) order by id limit 50) h),
   'queue',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'status',d.status,'revision',d.revision,'createdAt',d.created_at,'account',case when d.status in ('processing','completed') then 'Deleted sign-in identity' else (select email from auth.users where id=d.user_id) end,'retentionRevision',(select count(*) from private.retention_events e where e.request_id=d.id and e.organization_id=org and e.action='retain'),'nextReviewOn',(select e.details->>'reviewOn' from private.retention_events e where e.request_id=d.id and e.organization_id=org and e.action='retain' order by (e.details->>'revision')::integer desc limit 1),
    'approved',exists(select 1 from private.deletion_reviews dr where dr.request_id=d.id and dr.organization_id=org and dr.policy_version=pol.version),
    'recordReviewOn',d.processing_at+(select pp.record_days from private.retention_policies pp where pp.organization_id=org and pp.version=(select max(dr.policy_version) from private.deletion_reviews dr where dr.request_id=d.id and dr.organization_id=org))*interval '1 day','auditReviewOn',d.processing_at+(select pp.audit_days from private.retention_policies pp where pp.organization_id=org and pp.version=(select max(dr.policy_version) from private.deletion_reviews dr where dr.request_id=d.id and dr.organization_id=org))*interval '1 day')),'[]') from (select * from private.account_deletions dd where org in(select private.deletion_scopes(dd.user_id)) and dd.status<>'canceled' and ((p->>'after') is null or dd.id>(p->>'after')::uuid) order by dd.id limit 50) d),
   'queueNext',(select case when count(*)=50 then max(q.id::text) end from (select id from private.account_deletions dd where org in(select private.deletion_scopes(dd.user_id)) and dd.status<>'canceled' and ((p->>'after') is null or dd.id>(p->>'after')::uuid) order by dd.id limit 50) q),
   'holdsNext',(select case when count(*)=50 then max(q.id::text) end from (select id from private.retention_holds where organization_id=org and ((p->>'holdsAfter') is null or id>(p->>'holdsAfter')::uuid) order by id limit 50) q));
 end if;
 if a not in ('read','fresh') then insert into private.privacy_receipts values(auth.uid(),(p->>'key')::uuid,encode(sha256(convert_to(p::text,'UTF8')),'hex'),result);end if;
 return result;
end $$;
create function public.privacy_command(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.privacy_command(p)$$;
-- A receipt grants only narrowly scoped recovery, never record or tenant access.
create function private.deletion_recovery(p_id uuid,p_secret text,p_finish boolean default false,p_lease uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.account_deletions;
begin
 select * into r from private.account_deletions where id=p_id and secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex') for update;
 if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_finish and r.status='processing' then
  if p_lease is null or r.lease is distinct from p_lease then raise exception 'LEASE_LOST';end if;
  if not exists(select 1 from auth.users where id=r.user_id and deleted_at is not null) then raise exception 'PROVIDER_NOT_CONFIRMED';end if;
  update private.account_deletions set status='completed',completed_at=now(),revision=revision+1 where id=r.id returning * into r;
  insert into private.retention_events(request_id,action) values(r.id,'identity_deleted');
 end if;
 if not p_finish and p_lease is not null and r.status='processing' then
  if r.lease_until>clock_timestamp() and r.lease is distinct from p_lease then return jsonb_build_object('status','processing','busy',true);end if;
  update private.account_deletions set lease=p_lease,lease_until=clock_timestamp()+interval '2 minutes' where id=r.id;
  return jsonb_build_object('status',r.status,'user',r.user_id,'identityDeleted',exists(select 1 from auth.users where id=r.user_id and deleted_at is not null));
 end if;
 return jsonb_build_object('status',r.status);
end $$;
create function public.deletion_recovery(p_id uuid,p_secret text,p_finish boolean default false,p_lease uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.deletion_recovery(p_id,p_secret,p_finish,p_lease)$$;
revoke all on function private.privacy_identity(boolean),private.deletion_scopes(uuid),private.privacy_command(jsonb),private.deletion_recovery(uuid,text,boolean,uuid),public.privacy_command(jsonb),public.deletion_recovery(uuid,text,boolean,uuid) from public,anon,authenticated,service_role;
grant execute on function private.privacy_command(jsonb),public.privacy_command(jsonb) to authenticated;
grant execute on function private.deletion_recovery(uuid,text,boolean,uuid),public.deletion_recovery(uuid,text,boolean,uuid) to service_role;

-- No new authority can be attached to an identity after irreversible processing starts.
create function private.block_deleted_account_grant() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,831));
 perform 1 from public.organizations where id=new.organization_id for update;
 if new.revoked_at is null and exists(select 1 from private.account_deletions where user_id=new.user_id and status in ('processing','completed')) then raise exception 'ACCOUNT_DELETING';end if;
 return new;
end $$;
revoke all on function private.block_deleted_account_grant() from public,anon,authenticated,service_role;
create trigger no_deleted_membership before insert or update on public.memberships for each row execute function private.block_deleted_account_grant();
create trigger no_deleted_customer_access before insert or update on public.customer_access for each row execute function private.block_deleted_account_grant();
create index deletion_reviews_org on private.deletion_reviews(organization_id,request_id);
create index retention_holds_active on private.retention_holds(organization_id) where released_at is null;
create index retention_events_request on private.retention_events(request_id,created_at);
create index retention_events_org on private.retention_events(organization_id,created_at);
create index account_deletion_user_history on private.account_deletions(user_id,created_at desc);
create index retention_policies_actor on private.retention_policies(actor_id);
create index deletion_reviews_actor on private.deletion_reviews(actor_id);
create index retention_holds_actor on private.retention_holds(actor_id);
create index retention_holds_released_by on private.retention_holds(released_by) where released_by is not null;
create index retention_events_actor on private.retention_events(actor_id) where actor_id is not null;
create index memberships_privacy_scope on public.memberships(user_id,organization_id);
create index customer_access_privacy_scope on public.customer_access(user_id,organization_id);
