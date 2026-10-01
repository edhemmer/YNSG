create table public.appointments (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), job_id uuid not null,
 start_at timestamptz not null, end_at timestamptz not null, timezone text not null,
 status text not null default 'held' check(status in ('held','reserved','canceled','needs_review')),
 revision integer not null default 1 check(revision>0), external_busy_snapshot jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), primary key(organization_id,id), unique(organization_id,job_id),
 foreign key(organization_id,job_id) references public.jobs(organization_id,id), check(end_at>start_at),
 check((extract(epoch from (end_at-start_at))/60)::integer >= 120)
);
create index appointments_window on public.appointments(organization_id,start_at,end_at) where status in ('held','reserved','needs_review');
create table public.schedule_holds (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), appointment_id uuid not null,
 expires_at timestamptz not null, owner_key text not null, created_at timestamptz not null default now(),
 primary key(organization_id,id), unique(organization_id,appointment_id),
 foreign key(organization_id,appointment_id) references public.appointments(organization_id,id)
);
create table public.route_segments (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), appointment_id uuid not null,
 sequence_no integer not null check(sequence_no>=0), kind text not null check(kind in ('travel','supplier_pickup','customer_work')),
 origin text, destination text, minutes integer check(minutes is null or minutes>=0), provider text, fact_at timestamptz,
 primary key(organization_id,id), unique(organization_id,appointment_id,sequence_no),
 foreign key(organization_id,appointment_id) references public.appointments(organization_id,id)
);
create table public.availability_exceptions (
 organization_id uuid not null references public.organizations(id), id uuid not null default gen_random_uuid(),
 starts_at timestamptz not null, ends_at timestamptz not null, reason text not null,
 primary key(organization_id,id), check(ends_at>starts_at)
);
create table public.integration_connections (
 organization_id uuid not null references public.organizations(id), id uuid not null default gen_random_uuid(),
 provider text not null check(provider in ('gmail','google_calendar','maps','auth_email','ai','accounting')),
 status text not null default 'disabled' check(status in ('disabled','configured','test','active','error')),
 secret_ref text, last_success_at timestamptz, last_error text, created_at timestamptz not null default now(),
 primary key(organization_id,id), unique(organization_id,provider)
);
create table public.external_mappings (
 organization_id uuid not null references public.organizations(id), id uuid not null default gen_random_uuid(),
 connection_id uuid not null, object_type text not null, object_id uuid not null, external_id text not null,
 external_etag text, sync_version integer not null default 1, primary key(organization_id,id),
 unique(organization_id,connection_id,object_type,object_id), unique(organization_id,connection_id,object_type,external_id),
 foreign key(organization_id,connection_id) references public.integration_connections(organization_id,id)
);
create table public.sync_runs (
 organization_id uuid not null references public.organizations(id), id uuid not null default gen_random_uuid(),
 connection_id uuid not null, direction text not null check(direction in ('push','pull','reconcile')),
 status text not null default 'running' check(status in ('running','succeeded','failed','needs_review')),
 cursor text, started_at timestamptz not null default now(), finished_at timestamptz, error text,
 primary key(organization_id,id), foreign key(organization_id,connection_id) references public.integration_connections(organization_id,id)
);
create table public.delivery_attempts (
 organization_id uuid not null references public.organizations(id), id uuid not null default gen_random_uuid(), outbox_id uuid not null,
 attempt_no integer not null check(attempt_no between 1 and 10), status text not null check(status in ('started','accepted','failed','unknown')),
 provider_id text, error text, started_at timestamptz not null default now(), finished_at timestamptz,
 primary key(organization_id,id), unique(organization_id,outbox_id,attempt_no),
 foreign key(organization_id,outbox_id) references public.outbox(organization_id,id)
);

alter table public.appointments enable row level security;
alter table public.schedule_holds enable row level security;
alter table public.route_segments enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.integration_connections enable row level security;
alter table public.external_mappings enable row level security;
alter table public.sync_runs enable row level security;
alter table public.delivery_attempts enable row level security;
revoke all on public.appointments,public.schedule_holds,public.route_segments,public.availability_exceptions,public.integration_connections,public.external_mappings,public.sync_runs,public.delivery_attempts from anon,authenticated;
grant select on public.appointments,public.route_segments,public.integration_connections,public.external_mappings,public.sync_runs,public.delivery_attempts to authenticated;
create policy appointment_read on public.appointments for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher','technician']) or exists(select 1 from public.jobs j where j.organization_id=appointments.organization_id and j.id=job_id and private.customer_allowed(j.organization_id,j.customer_id)));
create policy route_read on public.route_segments for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher','technician']));
create policy integration_read on public.integration_connections for select to authenticated using(private.staff(organization_id,array['owner','admin']));
create policy mapping_read on public.external_mappings for select to authenticated using(private.staff(organization_id,array['owner','admin']));
create policy sync_read on public.sync_runs for select to authenticated using(private.staff(organization_id,array['owner','admin']));
create policy delivery_read on public.delivery_attempts for select to authenticated using(private.staff(organization_id,array['owner','admin']));

create function private.reserve_appointment(p_org uuid,p_job uuid,p_start timestamptz,p_end timestamptz,p_timezone text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.jobs; a public.appointments; result jsonb; prior private.command_receipts; fingerprint text;
begin
 if not private.staff(p_org,array['owner','admin','dispatcher']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='scheduling' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_start is null or p_end is null or p_end<=p_start or extract(epoch from (p_end-p_start))/60<120 or extract(epoch from (p_end-p_start))/60%30<>0 or p_timezone is null or p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_job,p_start,p_end,p_timezone,auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':appointment:'||p_key,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='ReserveAppointment' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into j from public.jobs where organization_id=p_org and id=p_job for update;if not found then raise exception 'NOT_FOUND';end if;
 if j.status not in ('approved','scheduled') then raise exception 'TRANSITION';end if;
 if exists(select 1 from public.appointments where organization_id=p_org and status in ('held','reserved','needs_review') and start_at<p_end and end_at>p_start) then raise exception 'CAPACITY_CONFLICT';end if;
 if exists(select 1 from public.availability_exceptions where organization_id=p_org and starts_at<p_end and ends_at>p_start) then raise exception 'CAPACITY_CONFLICT';end if;
 insert into public.appointments(organization_id,job_id,start_at,end_at,timezone,status) values(p_org,p_job,p_start,p_end,p_timezone,'reserved') on conflict(organization_id,job_id) do update set start_at=excluded.start_at,end_at=excluded.end_at,timezone=excluded.timezone,status='reserved',revision=appointments.revision+1 returning * into a;
 update public.jobs set status='scheduled',revision=revision+1 where organization_id=p_org and id=p_job;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'appointment.reserved',a.id,a.revision,gen_random_uuid());
 result:=jsonb_build_object('id',a.id,'startAt',a.start_at,'endAt',a.end_at,'revision',a.revision);insert into private.command_receipts values(p_org,'ReserveAppointment',p_key,fingerprint,result,now());return result;
end$$;
create function public.reserve_appointment(p_org uuid,p_job uuid,p_start timestamptz,p_end timestamptz,p_timezone text,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.reserve_appointment(p_org,p_job,p_start,p_end,p_timezone,p_key)$$;

create function private.claim_outbox(p_org uuid,p_limit integer default 10) returns setof public.outbox
language plpgsql security definer set search_path='' as $$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query update public.outbox o set status='leased',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1
 where o.organization_id=p_org and o.id in (select x.id from public.outbox x where x.organization_id=p_org and x.status in ('pending','failed') and x.next_attempt_at<=now() order by x.created_at for update skip locked limit greatest(1,least(p_limit,25))) returning o.*;
end$$;
create function public.claim_outbox(p_org uuid,p_limit integer default 10) returns setof public.outbox language sql security invoker set search_path='' as $$select * from private.claim_outbox(p_org,p_limit)$$;
create function private.finish_delivery(p_org uuid,p_id uuid,p_lease uuid,p_status text,p_provider_id text,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.outbox;attempt_no integer;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_status not in ('accepted','failed','needs_reconciliation') then raise exception 'VALIDATION';end if;
 update public.outbox set status=p_status,lease_token=null,lease_until=null,next_attempt_at=case when p_status='failed' then now()+least(interval '1 hour',interval '1 minute'*power(2,attempts-1)) else now() end where organization_id=p_org and id=p_id and lease_token=p_lease returning * into o;
 if not found then raise exception 'STALE_LEASE';end if;
 select attempts into attempt_no from public.outbox where organization_id=p_org and id=p_id;
 insert into public.delivery_attempts(organization_id,outbox_id,attempt_no,status,provider_id,error,finished_at) values(p_org,p_id,attempt_no,case when p_status='accepted' then 'accepted' when p_status='needs_reconciliation' then 'unknown' else 'failed' end,p_provider_id,p_error,now());
 return jsonb_build_object('id',p_id,'status',p_status,'attempt',attempt_no);
end$$;
create function public.finish_delivery(p_org uuid,p_id uuid,p_lease uuid,p_status text,p_provider_id text,p_error text) returns jsonb language sql security invoker set search_path='' as $$select private.finish_delivery(p_org,p_id,p_lease,p_status,p_provider_id,p_error)$$;
do $$declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname in ('reserve_appointment','claim_outbox','finish_delivery') loop execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);end loop;end$$;
