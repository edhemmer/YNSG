-- R03/R04/R05. Additive foundation; no existing public-site delivery changes.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table public.organizations (
 id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z][a-z0-9-]{1,62}$'),
 display_name text not null check(length(display_name) between 2 and 160),
 timezone text not null, currency text not null default 'USD' check(currency='USD'),
 status text not null default 'setup' check(status in ('setup','active','suspended','canceled')),
 created_at timestamptz not null default now()
);
create table public.memberships (
 organization_id uuid not null references public.organizations(id), user_id uuid not null references auth.users(id),
 role text not null check(role in ('owner','admin','dispatcher','technician','bookkeeper','support')),
 revoked_at timestamptz, created_at timestamptz not null default now(), primary key(organization_id,user_id)
);
create index memberships_user on public.memberships(user_id,organization_id) where revoked_at is null;
create table public.entitlements (
 organization_id uuid not null references public.organizations(id), module text not null check(module in ('crm','scheduling','finance','assistant','mobile')),
 enabled boolean not null default false, primary key(organization_id,module)
);
create table public.configuration_versions (
 organization_id uuid not null references public.organizations(id), version integer not null check(version>0),
 schema_version integer not null default 1 check(schema_version=1), settings jsonb not null check(jsonb_typeof(settings)='object'),
 published_at timestamptz not null default now(), published_by uuid references auth.users(id), primary key(organization_id,version)
);
create table public.customers (
 organization_id uuid not null references public.organizations(id), id uuid not null default gen_random_uuid(),
 display_name text not null check(length(display_name) between 2 and 160), revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), primary key(organization_id,id)
);
create table public.customer_access (
 organization_id uuid not null, customer_id uuid not null, user_id uuid not null references auth.users(id),
 can_approve boolean not null default false, can_view_billing boolean not null default false,
 revoked_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now(),
 primary key(organization_id,customer_id,user_id), foreign key(organization_id,customer_id) references public.customers(organization_id,id)
);
create index customer_access_user on public.customer_access(user_id,organization_id) where revoked_at is null;
create table public.properties (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), customer_id uuid not null,
 street text not null, city text not null, region text not null, postal_code text,
 revision integer not null default 1 check(revision>0), created_at timestamptz not null default now(),
 primary key(organization_id,id), foreign key(organization_id,customer_id) references public.customers(organization_id,id)
);
create index properties_customer on public.properties(organization_id,customer_id);
create table public.catalog_services (
 organization_id uuid not null references public.organizations(id), id uuid not null default gen_random_uuid(),
 name text not null, compliance text not null default 'review' check(compliance in ('review','approved','held')),
 pricing_mode text not null check(pricing_mode in ('hourly','starting','quote','review')),
 scope text not null, exclusions text not null, primary key(organization_id,id), unique(organization_id,name)
);
create table public.service_requests (
 organization_id uuid not null references public.organizations(id), id uuid not null default gen_random_uuid(),
 customer_id uuid, property_id uuid, service_id uuid not null, original_submission jsonb not null,
 form_version integer not null default 1 check(form_version=1), privacy_version text not null,
 status text not null default 'submitted' check(status in ('submitted','reviewing','declined','canceled','quoted')),
 revision integer not null default 1 check(revision>0), created_at timestamptz not null default now(),
 primary key(organization_id,id), foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 foreign key(organization_id,property_id) references public.properties(organization_id,id),
 foreign key(organization_id,service_id) references public.catalog_services(organization_id,id),
 check(jsonb_typeof(original_submission)='object')
);
create index requests_queue on public.service_requests(organization_id,status,created_at desc,id);
create index requests_customer on public.service_requests(organization_id,customer_id);
create index requests_property on public.service_requests(organization_id,property_id);
create index requests_service on public.service_requests(organization_id,service_id);
create table public.audit_events (
 organization_id uuid not null references public.organizations(id), id uuid not null default gen_random_uuid(),
 actor_id uuid references auth.users(id), action text not null, object_id uuid not null, object_revision integer not null,
 correlation_id uuid not null, occurred_at timestamptz not null default now(), primary key(organization_id,id)
);
create index audit_object on public.audit_events(organization_id,object_id,occurred_at);
create table public.outbox (
 organization_id uuid not null references public.organizations(id), id uuid not null default gen_random_uuid(),
 event_key text not null, kind text not null, object_id uuid not null, payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','leased','sending','accepted','failed','needs_reconciliation','suppressed','dead_letter')),
 attempts integer not null default 0 check(attempts between 0 and 10), lease_token uuid, lease_until timestamptz,
 next_attempt_at timestamptz not null default now(), created_at timestamptz not null default now(),
 primary key(organization_id,id), unique(organization_id,event_key), check(jsonb_typeof(payload)='object')
);
create index outbox_ready on public.outbox(status,next_attempt_at) where status in ('pending','failed');
create table private.command_receipts (
 organization_id uuid not null references public.organizations(id), command text not null, key text not null,
 fingerprint text not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key(organization_id,command,key)
);
create table private.intake_throttles (
 organization_id uuid not null references public.organizations(id), client_hash text not null,
 window_start timestamptz not null, count integer not null check(count>0), primary key(organization_id,client_hash,window_start)
);

-- RLS is defense in depth for private tables too. Only narrow definer commands write.
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.entitlements enable row level security;
alter table public.configuration_versions enable row level security;
alter table public.customers enable row level security;
alter table public.customer_access enable row level security;
alter table public.properties enable row level security;
alter table public.catalog_services enable row level security;
alter table public.service_requests enable row level security;
alter table public.audit_events enable row level security;
alter table public.outbox enable row level security;
alter table private.command_receipts enable row level security;
alter table private.intake_throttles enable row level security;

create function private.live_identity(require_mfa boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
 where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
 and (s.not_after is null or s.not_after>now()) and u.deleted_at is null and not u.is_anonymous
 and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
 and (not require_mfa or (s.aal='aal2' and auth.jwt()->>'aal'='aal2')))
$$;
create function private.staff(org uuid, roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.live_identity(true) and exists(select 1 from public.memberships m
 where m.organization_id=org and m.user_id=auth.uid() and m.revoked_at is null and m.role=any(roles))
$$;
create function private.customer_allowed(org uuid, customer uuid, billing boolean default false, approval boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.live_identity(false) and exists(select 1 from public.customer_access a
 where a.organization_id=org and a.customer_id=customer and a.user_id=auth.uid() and a.revoked_at is null
 and (a.expires_at is null or a.expires_at>now()) and (not billing or a.can_view_billing) and (not approval or a.can_approve))
$$;
revoke all on function private.live_identity(boolean),private.staff(uuid,text[]),private.customer_allowed(uuid,uuid,boolean,boolean) from public;
grant execute on function private.live_identity(boolean),private.staff(uuid,text[]),private.customer_allowed(uuid,uuid,boolean,boolean) to authenticated;

create policy organization_read on public.organizations for select to authenticated using (
 private.staff(id,array['owner','admin','dispatcher','technician','bookkeeper','support']) or exists(
 select 1 from public.customer_access a where a.organization_id=id and a.user_id=auth.uid()));
create policy own_membership on public.memberships for select to authenticated using(user_id=auth.uid() and revoked_at is null and private.live_identity(false));
create policy entitled_read on public.entitlements for select to authenticated using(private.staff(organization_id,array['owner','admin']));
-- Full setup may contain operational policy; customers receive approved document snapshots instead.
create policy configuration_read on public.configuration_versions for select to authenticated using(private.staff(organization_id,array['owner','admin']));
create policy customer_read on public.customers for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher','support']) or private.customer_allowed(organization_id,id));
create policy access_read on public.customer_access for select to authenticated using(user_id=auth.uid() and revoked_at is null and (expires_at is null or expires_at>now()) and private.live_identity(false));
create policy property_read on public.properties for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher','support']) or private.customer_allowed(organization_id,customer_id));
create policy catalog_read on public.catalog_services for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher','technician','support']));
create policy request_read on public.service_requests for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher']) or private.customer_allowed(organization_id,customer_id));
create policy audit_read on public.audit_events for select to authenticated using(private.staff(organization_id,array['owner','admin']));
create policy outbox_read on public.outbox for select to authenticated using(private.staff(organization_id,array['owner','admin']));

revoke all on public.organizations,public.memberships,public.entitlements,public.configuration_versions,public.customers,public.customer_access,public.properties,public.catalog_services,public.service_requests,public.audit_events,public.outbox from anon,authenticated;
grant select on public.organizations,public.memberships,public.entitlements,public.configuration_versions,public.customers,public.customer_access,public.properties,public.catalog_services,public.service_requests,public.audit_events,public.outbox to authenticated;
revoke all on private.command_receipts,private.intake_throttles from public,anon,authenticated;

create function public.submit_service_request(p_org uuid,p_key text,p_client_hash text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_fingerprint text; v_previous private.command_receipts; v_id uuid; v_service uuid; v_config jsonb; v_count integer; v_result jsonb;
begin
 -- Only trusted server service-role may bind the public site's organization and hashed IP.
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_key is null or length(p_key) not between 16 and 128 or p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$'
 or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>12000 then raise exception 'VALIDATION'; end if;
 if not exists(select 1 from public.organizations where id=p_org and status in ('setup','active'))
 or not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED'; end if;
 if exists(select 1 from jsonb_each(p_data) x where jsonb_typeof(x.value)<>'string')
 or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('service','task','name','phone','email','street','city','description','communityRate','preferredTime','website'))
 or length(coalesce(p_data->>'task',''))>120 or length(coalesce(p_data->>'preferredTime',''))>180
 or not (p_data ?& array['service','name','phone','email','street','city','description','communityRate'])
 or length(coalesce(p_data->>'name','')) not between 2 and 120
 or length(coalesce(p_data->>'phone','')) not between 7 and 35
 or length(coalesce(p_data->>'email','')) not between 3 and 254 or p_data->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or length(coalesce(p_data->>'street','')) not between 5 and 200
 or length(coalesce(p_data->>'description','')) not between 10 and 3000
 or p_data->>'communityRate' not in ('Yes','No') or coalesce(p_data->>'website','')<>''
 then raise exception 'VALIDATION'; end if;
 select settings into v_config from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 if v_config is null or not coalesce((v_config->>'intakeEnabled')::boolean,false) then raise exception 'SETUP_REQUIRED'; end if;
 if not exists(select 1 from jsonb_array_elements_text(v_config->'cities') city where city=p_data->>'city') then raise exception 'VALIDATION'; end if;
 select id into v_service from public.catalog_services where organization_id=p_org and name=p_data->>'service';
 if v_service is null then raise exception 'VALIDATION'; end if;
 v_fingerprint := encode(sha256(convert_to(p_data::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':intake:'||p_key,0));
 select * into v_previous from private.command_receipts where organization_id=p_org and command='SubmitRequest' and key=p_key;
 if found then
   if v_previous.fingerprint<>v_fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return v_previous.result;
 end if;
 insert into private.intake_throttles(organization_id,client_hash,window_start,count)
 values(p_org,p_client_hash,date_trunc('hour',now()),1)
 on conflict(organization_id,client_hash,window_start) do update set count=private.intake_throttles.count+1 returning count into v_count;
 if v_count>5 then raise exception 'RATE_LIMITED'; end if;
 insert into public.service_requests(organization_id,service_id,original_submission,privacy_version)
 values(p_org,v_service,p_data,v_config->>'privacyVersion') returning id into v_id;
 insert into public.audit_events(organization_id,action,object_id,object_revision,correlation_id)
 values(p_org,'request.submitted',v_id,1,v_id);
 insert into public.outbox(organization_id,event_key,kind,object_id,payload)
 values(p_org,'request:'||v_id||':owner','request.owner_notification',v_id,
 jsonb_build_object('schemaVersion',1,'subject','Your Neighborhood Service Guy New Request','recipient',v_config->>'notificationRecipient','configurationVersion',
 (select max(version) from public.configuration_versions where organization_id=p_org)));
 v_result:=jsonb_build_object('ok',true,'id',v_id,'notification','pending');
 insert into private.command_receipts values(p_org,'SubmitRequest',p_key,v_fingerprint,v_result,now());
 return v_result;
end $$;
revoke all on function public.submit_service_request(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_service_request(uuid,text,text,jsonb) to service_role;

create function public.review_service_request(p_org uuid,p_id uuid,p_revision integer,p_status text,p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.service_requests; previous private.command_receipts; fingerprint text; result jsonb;
begin
 if not private.staff(p_org,array['owner','admin','dispatcher']) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED'; end if;
 if p_status is null or p_status not in ('reviewing','declined','canceled') or p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION'; end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_revision,p_status,auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':review:'||p_key,0));
 select * into previous from private.command_receipts where organization_id=p_org and command='ReviewRequest' and key=p_key;
 if found then
  if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return previous.result;
 end if;
 select * into r from public.service_requests where organization_id=p_org and id=p_id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if r.revision is distinct from p_revision then raise exception 'STALE_REVISION'; end if;
 if r.status not in ('submitted','reviewing') then raise exception 'TRANSITION'; end if;
 update public.service_requests set status=p_status,revision=revision+1 where organization_id=p_org and id=p_id;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
 values(p_org,auth.uid(),'request.'||p_status,p_id,r.revision+1,gen_random_uuid());
 result:=jsonb_build_object('id',p_id,'status',p_status,'revision',r.revision+1);
 insert into private.command_receipts values(p_org,'ReviewRequest',p_key,fingerprint,result,now());
 return result;
end $$;
revoke all on function public.review_service_request(uuid,uuid,integer,text,text) from public,anon;
grant execute on function public.review_service_request(uuid,uuid,integer,text,text) to authenticated;
