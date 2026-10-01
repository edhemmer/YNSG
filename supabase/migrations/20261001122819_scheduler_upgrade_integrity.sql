-- S01-S05. Additive, fail-closed upgrade. No provider or customer booking activation.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set search_path=public,extensions;
do $$begin
 if exists(select 1 from public.appointments) then raise exception 'MIGRATION_REVIEW_REQUIRED: map existing appointments to physical resources before upgrading';end if;
end$$;
-- The old entry point lacks provider/capacity approval guarantees. Keep signature but fail closed.
create or replace function private.reserve_appointment(p_org uuid,p_job uuid,p_start timestamptz,p_end timestamptz,p_timezone text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$begin raise exception 'SCHEDULER_UPGRADE_REQUIRED';end$$;

create table public.resources (
 organization_id uuid not null references public.organizations(id), id uuid not null default gen_random_uuid(),
 name text not null check(length(name) between 1 and 160), kind text not null check(kind in ('operator','equipment','trailer')),
 status text not null default 'available' check(status in ('available','out_of_service')), primary key(organization_id,id)
);
create table private.schedule_state (
 organization_id uuid primary key references public.organizations(id), revision bigint not null default 1 check(revision>0)
);
alter table public.appointments drop constraint appointments_organization_id_job_id_key;
alter table public.appointments alter column job_id drop not null;
alter table public.appointments drop constraint appointments_status_check;
alter table public.appointments add constraint appointments_status_check check(status in ('held','proposal','reserved','needs_review','expired','declined_time','declined_service','canceled','replaced'));
alter table public.appointments add column request_id uuid,
 add column replaces_id uuid, add column arrival_at timestamptz,
 add column expires_at timestamptz, add column created_by uuid references auth.users(id),
 add column customer_response text not null default 'awaiting' check(customer_response in ('awaiting','confirmed','reschedule_requested')),
 add column response_revision integer,
 add foreign key(organization_id,request_id) references public.service_requests(organization_id,id),
 add foreign key(organization_id,replaces_id) references public.appointments(organization_id,id),
 add check(arrival_at is not null and arrival_at>=start_at and arrival_at<end_at),
 add check((status in ('held','proposal') and expires_at is not null) or status not in ('held','proposal'));
create index appointments_request on public.appointments(organization_id,request_id);
create index appointments_replaces on public.appointments(organization_id,replaces_id);
create unique index appointments_one_confirmed_job on public.appointments(organization_id,job_id) where status='reserved';
create unique index appointments_one_alternative on public.appointments(organization_id,replaces_id) where status in ('held','proposal');
create table public.resource_reservations (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), appointment_id uuid not null, resource_id uuid not null,
 during tstzrange not null, active boolean not null,
 primary key(organization_id,id), unique(organization_id,appointment_id,resource_id),
 foreign key(organization_id,appointment_id) references public.appointments(organization_id,id),
 foreign key(organization_id,resource_id) references public.resources(organization_id,id),
 check(not isempty(during) and not lower_inf(during) and not upper_inf(during) and lower_inc(during) and not upper_inc(during)),
 exclude using gist (organization_id with =,resource_id with =,during with &&) where(active)
);
create index reservations_resource on public.resource_reservations(organization_id,resource_id);
create table private.schedule_evidence (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), request_id uuid not null,
 configuration_version integer not null, schedule_revision bigint not null,
 start_at timestamptz not null,end_at timestamptz not null,arrival_at timestamptz not null,
 resources uuid[] not null check(cardinality(resources)>0), valid_until timestamptz not null,
 scope_reviewed boolean not null, travel_verified boolean not null, pickup_verified boolean not null, google_busy_verified boolean not null,
 provider_references jsonb not null check(jsonb_typeof(provider_references)='object'),
 primary key(organization_id,id),foreign key(organization_id,request_id) references public.service_requests(organization_id,id),
 foreign key(organization_id,configuration_version) references public.configuration_versions(organization_id,version),
 check(end_at>start_at and arrival_at>=start_at and arrival_at<end_at)
);
create index evidence_request on private.schedule_evidence(organization_id,request_id);
create index evidence_config on private.schedule_evidence(organization_id,configuration_version);
create table public.appointment_tasks (
 organization_id uuid not null, id uuid not null default gen_random_uuid(),appointment_id uuid not null,
 appointment_revision integer not null,kind text not null check(kind in ('owner_approval','customer_followup','integration_review')),
 state text not null default 'pending' check(state in ('pending','done','superseded')),due_at timestamptz not null,
 primary key(organization_id,id),unique(organization_id,appointment_id,appointment_revision,kind),
 foreign key(organization_id,appointment_id) references public.appointments(organization_id,id)
);
alter table public.resources enable row level security;
alter table public.resource_reservations enable row level security;
alter table public.appointment_tasks enable row level security;
alter table private.schedule_state enable row level security;
alter table private.schedule_evidence enable row level security;
revoke all on public.resources,public.resource_reservations,public.appointment_tasks,private.schedule_state,private.schedule_evidence from public,anon,authenticated;
grant select on public.resources,public.resource_reservations,public.appointment_tasks to authenticated;
create policy resources_staff on public.resources for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher']));
create policy reservations_staff on public.resource_reservations for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher']));
create policy appointment_tasks_staff on public.appointment_tasks for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher']));
create policy schedule_state_deny on private.schedule_state to anon,authenticated using(false) with check(false);
create policy schedule_evidence_deny on private.schedule_evidence to anon,authenticated using(false) with check(false);
-- Technicians receive assigned job briefs in a later permission-scoped path, not every appointment/route.
drop policy appointment_read on public.appointments;
create policy appointment_read on public.appointments for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher']) or exists(select 1 from public.jobs j where j.organization_id=appointments.organization_id and j.id=job_id and private.customer_allowed(j.organization_id,j.customer_id)));
drop policy route_read on public.route_segments;
create policy route_read on public.route_segments for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher']));

create function private.sync_reservation_state() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.resource_reservations set active=new.status in ('held','proposal','reserved','needs_review'),during=tstzrange(new.start_at,new.end_at,'[)') where organization_id=new.organization_id and appointment_id=new.id;
 return new;
end$$;
create trigger sync_reservations after update of status,start_at,end_at on public.appointments for each row execute function private.sync_reservation_state();
create function private.assert_reservation_matches() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.appointments a where a.organization_id=new.organization_id and a.id=new.appointment_id
 and new.active=(a.status in ('held','proposal','reserved','needs_review')) and new.during=tstzrange(a.start_at,a.end_at,'[)')) then raise exception 'RESERVATION_STATE_MISMATCH';end if;
 return new;
end$$;
create trigger reservation_matches before insert or update on public.resource_reservations for each row execute function private.assert_reservation_matches();
-- Deferred because the canonical command creates the appointment and its resources together.
create function private.assert_appointment_capacity() returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid; appointment uuid;
begin
 if tg_table_name='appointments' then org:=new.organization_id;appointment:=new.id;
 elsif tg_op='DELETE' then org:=old.organization_id;appointment:=old.appointment_id;
 else org:=new.organization_id;appointment:=new.appointment_id;end if;
 if exists(select 1 from public.appointments a where a.organization_id=org and a.id=appointment and a.status in ('held','proposal','reserved','needs_review'))
 and not exists(select 1 from public.resource_reservations r join public.resources s on s.organization_id=r.organization_id and s.id=r.resource_id
 where r.organization_id=org and r.appointment_id=appointment and r.active and s.kind='operator') then raise exception 'APPOINTMENT_CAPACITY_REQUIRED';end if;
 return null;
end$$;
create constraint trigger appointment_capacity after insert or update on public.appointments deferrable initially deferred for each row execute function private.assert_appointment_capacity();
create constraint trigger reservation_capacity after insert or update or delete on public.resource_reservations deferrable initially deferred for each row execute function private.assert_appointment_capacity();
revoke all on function private.assert_appointment_capacity() from public,anon,authenticated;

create function private.expire_appointments(p_org uuid,p_now timestamptz) returns integer language plpgsql security definer set search_path='' as $$
declare a public.appointments; n integer:=0;
begin
 for a in select * from public.appointments where organization_id=p_org and status in ('held','proposal') and expires_at<=p_now order by id for update loop
  update public.appointments set status='expired',revision=revision+1 where organization_id=p_org and id=a.id;
  update public.appointment_tasks set state='superseded' where organization_id=p_org and appointment_id=a.id and state='pending';
  update public.outbox set status='suppressed' where organization_id=p_org and object_id=a.id and status in ('pending','failed','leased');
  insert into public.audit_events(organization_id,action,object_id,object_revision,correlation_id) values(p_org,'appointment.expired',a.id,a.revision+1,gen_random_uuid());
  insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,'appointment:'||a.id||':'||(a.revision+1)||':calendar','calendar.remove',a.id,jsonb_build_object('appointmentRevision',a.revision+1));
  n:=n+1;
 end loop;
 -- Caller owns the tenant lock and increments the epoch when its transaction commits.
 return n;
end$$;

create function private.assert_schedule_evidence(p_org uuid,p_request uuid,p_evidence uuid,p_now timestamptz) returns private.schedule_evidence language plpgsql security definer set search_path='' as $$
declare e private.schedule_evidence; cfg public.configuration_versions; rules jsonb; local_start timestamp; local_end timestamp; rid uuid; count_resources integer;
begin
 select * into e from private.schedule_evidence where organization_id=p_org and id=p_evidence and request_id=p_request;
 select * into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 if e.id is null or cfg.version is null or e.valid_until<=p_now or e.configuration_version<>cfg.version or e.schedule_revision is distinct from (select revision from private.schedule_state where organization_id=p_org)
 or not e.scope_reviewed or not e.travel_verified or not e.pickup_verified or not e.google_busy_verified then raise exception 'FEASIBILITY_REVIEW_REQUIRED';end if;
 rules:=cfg.settings->'scheduling';
 if rules is null or rules->>'bufferMinutes' is null or rules->>'leadMinutes' is null or rules->>'horizonDays' is null
 or rules->>'selectionMinutes' is null or rules->>'proposalMinutes' is null or rules->>'pendingLimit' is null
 or rules->>'earliestStart' is null or rules->>'latestStart' is null or rules->>'endOfDay' is null
 or jsonb_typeof(rules->'weekdays') is distinct from 'array' or cfg.settings->>'timezone' is null then raise exception 'SETUP_REQUIRED';end if;
 if (rules->>'selectionMinutes')::integer<=0 or (rules->>'proposalMinutes')::integer<=0 or (rules->>'pendingLimit')::integer<=0
 or (rules->>'bufferMinutes')::integer<0 or (rules->>'leadMinutes')::integer<0 or (rules->>'horizonDays')::integer<=0
 or (rules->>'earliestStart')::integer<0 or (rules->>'latestStart')::integer<(rules->>'earliestStart')::integer
 or (rules->>'endOfDay')::integer>(24*60) or (rules->>'endOfDay')::integer<=(rules->>'latestStart')::integer
 or jsonb_array_length(rules->'weekdays')=0 then raise exception 'SETUP_REQUIRED';end if;
 if e.start_at<p_now+make_interval(mins=>(rules->>'leadMinutes')::integer) or e.start_at>p_now+make_interval(days=>(rules->>'horizonDays')::integer) then raise exception 'OUTSIDE_BOOKING_WINDOW';end if;
 local_start:=e.start_at at time zone (cfg.settings->>'timezone');local_end:=e.end_at at time zone (cfg.settings->>'timezone');
 if not exists(select 1 from jsonb_array_elements_text(rules->'weekdays') d where d::integer=extract(isodow from local_start)::integer)
 or extract(hour from local_start)*60+extract(minute from local_start)<(rules->>'earliestStart')::integer
 or extract(hour from local_start)*60+extract(minute from local_start)>(rules->>'latestStart')::integer
 or local_start::date<>local_end::date or extract(hour from local_end)*60+extract(minute from local_end)>(rules->>'endOfDay')::integer
 or extract(second from local_start)<>0 or extract(minute from local_start)::integer%30<>0
 or extract(epoch from(e.end_at-e.start_at))<7200 or mod(extract(epoch from(e.end_at-e.start_at)),1800)<>0 then raise exception 'OUTSIDE_OPERATING_HOURS';end if;
 if exists(select 1 from public.availability_exceptions where organization_id=p_org and starts_at<e.end_at and ends_at>e.start_at) then raise exception 'OWNER_BLOCK';end if;
 select count(distinct x) into count_resources from unnest(e.resources) x;
 if count_resources<>cardinality(e.resources) or array_position(e.resources,null) is not null then raise exception 'INVALID_RESOURCES';end if;
 for rid in select x from unnest(e.resources) x order by x loop
  perform 1 from public.resources where organization_id=p_org and id=rid and status='available' for update;
  if not found then raise exception 'RESOURCE_UNAVAILABLE';end if;
 end loop;
 if not exists(select 1 from public.resources where organization_id=p_org and id=any(e.resources) and kind='operator') then raise exception 'OPERATOR_REQUIRED';end if;
 select array_agg(x order by x) into e.resources from unnest(e.resources) x;
 return e;
end$$;

create function private.scheduling_command(p_org uuid,p_action text,p_input jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.appointments; original public.appointments; e private.schedule_evidence; cfg public.configuration_versions; previous private.command_receipts;
 fingerprint text; result jsonb; moment timestamptz:=clock_timestamp(); rid uuid; request_uuid uuid; newstatus text; expire_count integer; reason text;
begin
 if not private.staff(p_org,array['owner','admin','dispatcher']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='scheduling' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_action is null or p_action not in ('hold','submit','approve','decline_time','decline_service','reconfirm') or p_key is null or length(p_key) not between 16 and 128 or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'VALIDATION';end if;
 if p_action in ('approve','decline_time','decline_service') and not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_action,p_input,auth.uid())::text,'UTF8')),'hex');
 insert into private.schedule_state(organization_id) values(p_org) on conflict do nothing;
 perform 1 from private.schedule_state where organization_id=p_org for update;
 select * into previous from private.command_receipts where organization_id=p_org and command='Scheduling' and key=p_key;
 if found then if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return previous.result;end if;
 expire_count:=private.expire_appointments(p_org,moment);
 select * into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 if p_action='hold' then
  request_uuid:=(p_input->>'requestId')::uuid;
  perform 1 from public.service_requests where organization_id=p_org and id=request_uuid and status not in ('declined','canceled') for update;
  if not found then raise exception 'REQUEST_UNAVAILABLE';end if;
  if (select count(*) from public.appointments where organization_id=p_org and request_id=request_uuid and status in ('held','proposal'))>=coalesce((cfg.settings->'scheduling'->>'pendingLimit')::integer,0) then raise exception 'PENDING_LIMIT';end if;
  e:=private.assert_schedule_evidence(p_org,request_uuid,(p_input->>'evidenceId')::uuid,moment);
  if p_input->>'replacesId' is not null then
   select * into original from public.appointments where organization_id=p_org and id=(p_input->>'replacesId')::uuid and request_id=request_uuid and status='reserved' for update;
   if not found then raise exception 'ORIGINAL_UNAVAILABLE';end if;
  elsif exists(select 1 from public.appointments where organization_id=p_org and request_id=request_uuid and status='reserved') then raise exception 'REPLACEMENT_REQUIRED';end if;
  insert into public.appointments(organization_id,request_id,job_id,start_at,end_at,arrival_at,timezone,status,expires_at,created_by,replaces_id)
   values(p_org,request_uuid,original.job_id,e.start_at,e.end_at,e.arrival_at,cfg.settings->>'timezone','held',least(moment+make_interval(mins=>(cfg.settings->'scheduling'->>'selectionMinutes')::integer),e.start_at),auth.uid(),original.id) returning * into a;
  foreach rid in array e.resources loop insert into public.resource_reservations(organization_id,appointment_id,resource_id,during,active) values(p_org,a.id,rid,tstzrange(a.start_at,a.end_at,'[)'),true);end loop;
 else
  select * into a from public.appointments where organization_id=p_org and id=(p_input->>'id')::uuid for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if a.revision is distinct from (p_input->>'revision')::integer then raise exception 'STALE_REVISION';end if;
  if p_action='submit' then
   if a.status<>'held' then raise exception 'TRANSITION';end if;
   update public.appointments set status='proposal',revision=revision+1,expires_at=least(moment+make_interval(mins=>(cfg.settings->'scheduling'->>'proposalMinutes')::integer),start_at) where organization_id=p_org and id=a.id returning * into a;
   insert into public.appointment_tasks(organization_id,appointment_id,appointment_revision,kind,due_at) values(p_org,a.id,a.revision,'owner_approval',a.expires_at);
   insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,'appointment:'||a.id||':'||a.revision||':owner','appointment.owner_approval',a.id,jsonb_build_object('appointmentRevision',a.revision,'subject','Your Neighborhood Service Guy New Request','recipient',cfg.settings->>'notificationRecipient'));
  elsif p_action='approve' then
   if a.status<>'proposal' then raise exception 'TRANSITION';end if;
   e:=private.assert_schedule_evidence(p_org,a.request_id,(p_input->>'evidenceId')::uuid,moment);
   if e.start_at<>a.start_at or e.end_at<>a.end_at or e.arrival_at<>a.arrival_at or e.resources<>(select array_agg(resource_id order by resource_id) from public.resource_reservations where organization_id=p_org and appointment_id=a.id and active) then raise exception 'EVIDENCE_MISMATCH';end if;
   if a.replaces_id is not null then
    select * into original from public.appointments where organization_id=p_org and id=a.replaces_id and status='reserved' for update;
    if not found then raise exception 'ORIGINAL_UNAVAILABLE';end if;
    update public.appointments set status='replaced',revision=revision+1 where organization_id=p_org and id=original.id;
    update public.outbox set status='suppressed' where organization_id=p_org and object_id=original.id and status in ('pending','failed','leased');
    update public.appointment_tasks set state='superseded' where organization_id=p_org and appointment_id=original.id and state='pending';
    insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'appointment.replaced',original.id,original.revision+1,gen_random_uuid());
    insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,'appointment:'||original.id||':'||(original.revision+1)||':calendar','calendar.replace',original.id,jsonb_build_object('replacementId',a.id,'appointmentRevision',original.revision+1));
   end if;
   update public.appointments set status='reserved',expires_at=null,revision=revision+1 where organization_id=p_org and id=a.id returning * into a;
   update public.appointment_tasks set state='done' where organization_id=p_org and appointment_id=a.id and kind='owner_approval' and state='pending';
   insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,'appointment:'||a.id||':'||a.revision||':confirmation','appointment.confirmation',a.id,jsonb_build_object('appointmentRevision',a.revision,'arrivalAt',a.arrival_at));
   if a.arrival_at-interval '48 hours'>moment then
    insert into public.outbox(organization_id,event_key,kind,object_id,payload,next_attempt_at) values(p_org,'appointment:'||a.id||':'||a.revision||':reminder','appointment.reminder',a.id,jsonb_build_object('appointmentRevision',a.revision,'arrivalAt',a.arrival_at),a.arrival_at-interval '48 hours');
   end if;
  elsif p_action in ('decline_time','decline_service') then
   if a.status not in ('held','proposal') then raise exception 'TRANSITION';end if;
   reason:=p_input->>'reason';if reason is null or length(reason) not between 2 and 1000 then raise exception 'REASON_REQUIRED';end if;
   newstatus:=case when p_action='decline_time' then 'declined_time' else 'declined_service' end;
   update public.appointments set status=newstatus,revision=revision+1 where organization_id=p_org and id=a.id returning * into a;
   update public.appointment_tasks set state='done' where organization_id=p_org and appointment_id=a.id and state='pending';
   update public.outbox set status='suppressed' where organization_id=p_org and object_id=a.id and status in ('pending','failed','leased');
   -- Never cancel a confirmed original as a side effect of declining an alternative.
   insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,'appointment:'||a.id||':'||a.revision||':decision','appointment.'||newstatus,a.id,jsonb_build_object('appointmentRevision',a.revision,'requestId',a.request_id,'chooseAnotherTime',p_action='decline_time','reason',reason));
  elsif p_action='reconfirm' then
   if a.status<>'reserved' or a.arrival_at<=moment then raise exception 'TRANSITION';end if;
   -- Staff recording only at this stage; guest capability path is not exposed yet.
   if length(coalesce(p_input->>'evidence',''))<10 then raise exception 'RESPONSE_EVIDENCE_REQUIRED';end if;
   update public.appointments set customer_response='confirmed',response_revision=revision where organization_id=p_org and id=a.id returning * into a;
  end if;
 end if;
 update private.schedule_state set revision=revision+1 where organization_id=p_org;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'appointment.'||p_action,a.id,a.revision,gen_random_uuid());
 if p_action<>'reconfirm' then insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,'appointment:'||a.id||':'||a.revision||':calendar',case when a.status in ('declined_time','declined_service') then 'calendar.remove' else 'calendar.upsert' end,a.id,jsonb_build_object('appointmentRevision',a.revision,'status',a.status));end if;
 result:=jsonb_build_object('id',a.id,'revision',a.revision,'status',a.status,'startAt',a.start_at,'arrivalAt',a.arrival_at,'expiresAt',a.expires_at);
 insert into private.command_receipts values(p_org,'Scheduling',p_key,fingerprint,result,moment);return result;
end$$;
create function public.scheduling_command(p_org uuid,p_action text,p_input jsonb,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.scheduling_command(p_org,p_action,p_input,p_key)$$;
revoke all on function private.sync_reservation_state(),private.assert_reservation_matches(),private.expire_appointments(uuid,timestamptz),private.assert_schedule_evidence(uuid,uuid,uuid,timestamptz),private.scheduling_command(uuid,text,jsonb,text),public.scheduling_command(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function private.scheduling_command(uuid,text,jsonb,text),public.scheduling_command(uuid,text,jsonb,text) to authenticated;
-- Leases do not prove a provider accepted a message. A sending crash is ambiguous.
create or replace function private.claim_outbox(p_org uuid,p_limit integer default 10) returns setof public.outbox
language plpgsql security definer set search_path='' as $$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 update public.outbox set status='needs_reconciliation',lease_token=null,lease_until=null where organization_id=p_org and status='sending' and lease_until<=clock_timestamp();
 update public.delivery_attempts d set status='unknown',finished_at=clock_timestamp(),error='Lease expired after sending began; reconcile before resend'
 where d.organization_id=p_org and d.status='started' and exists(select 1 from public.outbox o where o.organization_id=d.organization_id and o.id=d.outbox_id and o.status='needs_reconciliation');
 update public.outbox set status=case when attempts>=10 then 'dead_letter' else 'pending' end,lease_token=null,lease_until=null where organization_id=p_org and status='leased' and lease_until<=clock_timestamp();
 update public.outbox set status='dead_letter' where organization_id=p_org and status in ('pending','failed') and attempts>=10;
 if not exists(select 1 from public.integration_connections where organization_id=p_org and provider='gmail' and status='active' and secret_ref is not null) then return;end if;
 -- Calendar dispatch remains separate until its adapter is connected and verified.
 return query update public.outbox o set status='leased',lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',attempts=o.attempts+1
 where o.organization_id=p_org and o.id in(select x.id from public.outbox x where x.organization_id=p_org and x.status in ('pending','failed') and x.attempts<10 and x.next_attempt_at<=clock_timestamp()
 and x.kind in ('request.owner_notification','appointment.owner_approval','appointment.confirmation','appointment.reminder','appointment.declined_time','appointment.declined_service')
 order by x.created_at,x.id for update skip locked limit greatest(1,least(coalesce(p_limit,10),25))) returning o.*;
end$$;
create function private.begin_delivery(p_org uuid,p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.outbox; a public.appointments;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.integration_connections where organization_id=p_org and provider='gmail' and status='active' and secret_ref is not null) then raise exception 'PROVIDER_DISABLED';end if;
 select * into o from public.outbox where organization_id=p_org and id=p_id and lease_token=p_lease and lease_until>clock_timestamp() and status='leased' for update;
 if not found then raise exception 'STALE_LEASE';end if;
 if o.kind like 'appointment.%' then
  select * into a from public.appointments where organization_id=p_org and id=o.object_id;
  if a.id is null or a.revision is distinct from (o.payload->>'appointmentRevision')::integer
   or (o.kind in ('appointment.reminder','appointment.confirmation') and (a.status<>'reserved' or a.arrival_at<=clock_timestamp()))
   or (o.kind='appointment.owner_approval' and (a.status<>'proposal' or a.expires_at<=clock_timestamp()))
  then update public.outbox set status='suppressed',lease_token=null,lease_until=null where organization_id=p_org and id=p_id;return jsonb_build_object('status','suppressed');end if;
 end if;
 update public.outbox set status='sending' where organization_id=p_org and id=p_id;
 insert into public.delivery_attempts(organization_id,outbox_id,attempt_no,status) values(p_org,p_id,o.attempts,'started');
 return jsonb_build_object('status','sending','attempt',o.attempts);
end$$;
create function public.begin_delivery(p_org uuid,p_id uuid,p_lease uuid) returns jsonb language sql security invoker set search_path='' as $$select private.begin_delivery(p_org,p_id,p_lease)$$;
create or replace function private.finish_delivery(p_org uuid,p_id uuid,p_lease uuid,p_status text,p_provider_id text,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.outbox;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_status is null or p_status not in ('accepted','failed','needs_reconciliation') or (p_status='accepted' and length(coalesce(p_provider_id,''))=0) then raise exception 'VALIDATION';end if;
 select * into o from public.outbox where organization_id=p_org and id=p_id and lease_token=p_lease and lease_until>clock_timestamp() and status='sending' for update;
 if not found then raise exception 'STALE_LEASE';end if;
 update public.outbox set status=case when p_status='failed' and attempts>=10 then 'dead_letter' else p_status end,lease_token=null,lease_until=null,
 next_attempt_at=clock_timestamp()+least(interval '1 hour',interval '1 minute'*power(2,attempts-1)) where organization_id=p_org and id=p_id;
 update public.delivery_attempts set status=case when p_status='accepted' then 'accepted' when p_status='failed' then 'failed' else 'unknown' end,
 provider_id=left(p_provider_id,300),error=case when p_error is null then null else 'Provider failure; review safe integration diagnostics' end,finished_at=clock_timestamp()
 where organization_id=p_org and outbox_id=p_id and attempt_no=o.attempts and status='started';
 return jsonb_build_object('id',p_id,'status',p_status,'attempt',o.attempts);
end$$;
revoke all on function private.begin_delivery(uuid,uuid,uuid),public.begin_delivery(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.begin_delivery(uuid,uuid,uuid),public.begin_delivery(uuid,uuid,uuid) to authenticated;
reset search_path;
