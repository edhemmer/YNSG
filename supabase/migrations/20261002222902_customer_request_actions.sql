-- Limited customer appointment actions. Bearer secrets are hashed, never stored in plaintext.
alter table public.appointments add column response_version integer not null default 0 check(response_version>=0);
create table private.customer_request_links (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), request_id uuid not null, appointment_id uuid not null,
 appointment_revision integer not null, source_outbox_id uuid not null, token_hash text not null unique check(token_hash~'^[a-f0-9]{64}$'),
 recipient_hash text not null check(recipient_hash~'^[a-f0-9]{64}$'), created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,revoked_at timestamptz,
 primary key(organization_id,id),unique(organization_id,source_outbox_id),
 foreign key(organization_id,request_id) references public.service_requests(organization_id,id),
 foreign key(organization_id,appointment_id) references public.appointments(organization_id,id),
 foreign key(organization_id,source_outbox_id) references public.outbox(organization_id,id),check(expires_at>created_at)
);
create index customer_links_request on private.customer_request_links(organization_id,request_id);
create index customer_links_appointment on private.customer_request_links(organization_id,appointment_id);
create table private.customer_action_receipts (
 organization_id uuid not null,link_id uuid not null,key text not null,fingerprint text not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,link_id,key),foreign key(organization_id,link_id) references private.customer_request_links(organization_id,id)
);
create table private.customer_action_throttles (
 organization_id uuid not null,link_id uuid not null,window_start timestamptz not null,count integer not null,primary key(organization_id,link_id,window_start),foreign key(organization_id,link_id) references private.customer_request_links(organization_id,id)
);
create table public.customer_schedule_preferences (
 organization_id uuid not null,id uuid not null default gen_random_uuid(),request_id uuid not null,appointment_id uuid not null,
 appointment_revision integer not null,response_version integer not null,timezone text not null,preferred_local_start text,note text not null,
 status text not null default 'pending' check(status in('pending','reviewed','superseded')),
 created_at timestamptz not null default clock_timestamp(),primary key(organization_id,id),unique(organization_id,appointment_id,response_version),
 foreign key(organization_id,request_id) references public.service_requests(organization_id,id),foreign key(organization_id,appointment_id) references public.appointments(organization_id,id),
 check(length(note) between 10 and 2000),check(preferred_local_start is null or preferred_local_start~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$')
);
alter table private.customer_request_links enable row level security;
alter table private.customer_action_receipts enable row level security;
alter table private.customer_action_throttles enable row level security;
alter table public.customer_schedule_preferences enable row level security;
revoke all on private.customer_request_links,private.customer_action_receipts,private.customer_action_throttles,public.customer_schedule_preferences from public,anon,authenticated,service_role;
grant select on public.customer_schedule_preferences to authenticated;
create policy preferences_staff on public.customer_schedule_preferences for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher']));
create policy customer_links_deny on private.customer_request_links to anon,authenticated using(false) with check(false);
create policy customer_receipts_deny on private.customer_action_receipts to anon,authenticated using(false) with check(false);
create policy customer_throttles_deny on private.customer_action_throttles to anon,authenticated using(false) with check(false);

-- Called by the authenticated staff mail dispatcher for a current leased communication.
create function private.issue_customer_request_link(p_org uuid,p_outbox uuid,p_lease uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.outbox;a public.appointments;r public.service_requests;link private.customer_request_links;recipient text;expiry timestamptz;moment timestamptz:=clock_timestamp();
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if coalesce(p_hash,'')!~'^[a-f0-9]{64}$' then raise exception 'VALIDATION';end if;
 select * into o from public.outbox where organization_id=p_org and id=p_outbox and status='leased' and lease_token=p_lease and lease_until>moment for update;
 if not found or o.kind not in('appointment.confirmation','appointment.reminder','appointment.declined_time','appointment.declined_service') then raise exception 'STALE_LEASE';end if;
 select * into a from public.appointments where organization_id=p_org and id=o.object_id for share;
 if a.id is null or a.revision is distinct from (o.payload->>'appointmentRevision')::integer
  or (o.kind in('appointment.confirmation','appointment.reminder') and (a.status<>'reserved' or a.arrival_at<=moment))
  or (o.kind='appointment.declined_time' and a.status<>'declined_time') or (o.kind='appointment.declined_service' and a.status<>'declined_service') then raise exception 'STALE_REVISION';end if;
 select * into r from public.service_requests where organization_id=p_org and id=a.request_id for share;
 recipient:=lower(trim(r.original_submission->>'email'));
 if recipient is null or recipient!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'RECIPIENT_REQUIRED';end if;
 expiry:=case when a.status='reserved' then least(moment+interval '7 days',a.arrival_at) else moment+interval '7 days' end;
 select * into link from private.customer_request_links where organization_id=p_org and source_outbox_id=p_outbox;
 if found then
  if link.token_hash<>p_hash or link.recipient_hash<>encode(sha256(convert_to(recipient,'UTF8')),'hex') or link.revoked_at is not null or link.expires_at<=moment then raise exception 'LINK_REVIEW_REQUIRED';end if;
 else
  insert into private.customer_request_links(organization_id,request_id,appointment_id,appointment_revision,source_outbox_id,token_hash,recipient_hash,expires_at)
   values(p_org,r.id,a.id,a.revision,p_outbox,p_hash,encode(sha256(convert_to(recipient,'UTF8')),'hex'),expiry) returning * into link;
 end if;
 return jsonb_build_object('expiresAt',link.expires_at,'recipient',recipient,'appointmentRevision',a.revision);
end$$;
create function public.issue_customer_request_link(p_org uuid,p_outbox uuid,p_lease uuid,p_hash text) returns jsonb language sql security invoker set search_path='' as $$select private.issue_customer_request_link(p_org,p_outbox,p_lease,p_hash)$$;
revoke all on function private.issue_customer_request_link(uuid,uuid,uuid,text),public.issue_customer_request_link(uuid,uuid,uuid,text) from public,anon,service_role;
grant execute on function private.issue_customer_request_link(uuid,uuid,uuid,text),public.issue_customer_request_link(uuid,uuid,uuid,text) to authenticated;

-- Server role is necessary to validate the scoped bearer grant; clients have no table/API grants.
create function private.validate_customer_request_link(p_hash text,p_throttle boolean default true) returns private.customer_request_links
language plpgsql security definer set search_path='' as $$
declare link private.customer_request_links;recipient text;moment timestamptz:=clock_timestamp();attempts integer;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if coalesce(p_hash,'')!~'^[a-f0-9]{64}$' then raise exception 'LINK_UNAVAILABLE';end if;
 select * into link from private.customer_request_links where token_hash=p_hash;
 if link.id is null or link.revoked_at is not null or link.expires_at<=moment then raise exception 'LINK_UNAVAILABLE';end if;
 if not exists(select 1 from public.organizations where id=link.organization_id and status='active') or not exists(select 1 from public.entitlements where organization_id=link.organization_id and module='scheduling' and enabled) then raise exception 'LINK_UNAVAILABLE';end if;
 select lower(trim(r.original_submission->>'email')) into recipient from public.service_requests r join public.appointments a on a.organization_id=r.organization_id and a.request_id=r.id
  where r.organization_id=link.organization_id and r.id=link.request_id and a.id=link.appointment_id and a.revision=link.appointment_revision
   and a.status in('reserved','declined_time','declined_service') and r.status not in('declined','canceled')
   and (a.status='reserved' or not exists(select 1 from public.appointments b where b.organization_id=a.organization_id and b.request_id=a.request_id and b.id<>a.id and b.id is distinct from a.replaces_id and (b.status='reserved' or (b.status in('held','proposal') and b.expires_at>moment))));
 if recipient is null or link.recipient_hash<>encode(sha256(convert_to(recipient,'UTF8')),'hex') then raise exception 'LINK_UNAVAILABLE';end if;
 if p_throttle then
 insert into private.customer_action_throttles values(link.organization_id,link.id,date_trunc('minute',moment),1)
 on conflict(organization_id,link_id,window_start) do update set count=private.customer_action_throttles.count+1 returning count into attempts;
 if attempts>30 then raise exception 'TRY_LATER';end if;end if;
 return link;
end$$;
revoke all on function private.validate_customer_request_link(text,boolean) from public,anon,authenticated,service_role;

create function private.customer_request_context(p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link private.customer_request_links;a public.appointments;r public.service_requests;cfg public.configuration_versions;
begin
 link:=private.validate_customer_request_link(p_hash);
 select * into a from public.appointments where organization_id=link.organization_id and id=link.appointment_id;
 select * into r from public.service_requests where organization_id=link.organization_id and id=link.request_id;
 select * into cfg from public.configuration_versions where organization_id=link.organization_id order by version desc limit 1;
 return jsonb_build_object('company',cfg.settings->>'displayName','timezone',a.timezone,'configurationVersion',cfg.version,'name',r.original_submission->>'name',
  'address',concat_ws(', ',r.original_submission->>'street',r.original_submission->>'city'),'services',coalesce(r.original_submission->'services',jsonb_build_array(jsonb_build_object('service',r.original_submission->>'service','task',r.original_submission->>'task'))),
  'appointmentRevision',a.revision,'responseVersion',a.response_version,'status',a.status,'arrivalAt',a.arrival_at,'reservedStart',a.start_at,'endAt',a.end_at,'response',a.customer_response,
  'actions',case when a.status='reserved' and a.arrival_at>clock_timestamp() then jsonb_build_array('confirm','request_another_time') when a.status='declined_time' then jsonb_build_array('request_another_time') else '[]'::jsonb end,
  'expiresAt',link.expires_at,'pendingPreference',(select jsonb_build_object('preferredLocalStart',preferred_local_start,'note',note,'createdAt',created_at) from public.customer_schedule_preferences where organization_id=link.organization_id and appointment_id=a.id and status='pending' order by created_at desc limit 1),
  'decisionReason',(select payload->>'reason' from public.outbox where organization_id=link.organization_id and id=link.source_outbox_id));
end$$;
create function public.customer_request_context(p_hash text) returns jsonb language sql security invoker set search_path='' as $$select private.customer_request_context(p_hash)$$;
revoke all on function private.customer_request_context(text),public.customer_request_context(text) from public,anon,authenticated;
grant execute on function private.customer_request_context(text),public.customer_request_context(text) to service_role;

create function private.customer_request_action(p_hash text,p_input jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link private.customer_request_links;a public.appointments;cfg public.configuration_versions;prior private.customer_action_receipts;fingerprint text;result jsonb;action text;note text;preferred text;preference uuid;moment timestamptz:=clock_timestamp();
begin
 link:=private.validate_customer_request_link(p_hash);
 if p_key is null or length(p_key) not between 16 and 128 or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'VALIDATION';end if;
 action:=p_input->>'action';note:=trim(coalesce(p_input->>'note',''));preferred:=nullif(p_input->>'preferredLocalStart','');
 if action is null or action not in('confirm','request_another_time') or exists(select 1 from jsonb_object_keys(p_input) k where k not in('action','appointmentRevision','responseVersion','configurationVersion','preferredLocalStart','note')) then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
 insert into private.schedule_state(organization_id) values(link.organization_id) on conflict do nothing;
 perform 1 from private.schedule_state where organization_id=link.organization_id for update;
 link:=private.validate_customer_request_link(p_hash,false);
 select * into link from private.customer_request_links where organization_id=link.organization_id and id=link.id for share;
 moment:=clock_timestamp();
 -- Revalidate after the scheduling lock so concurrent replacement/cancellation cannot use an old link.
 if link.revoked_at is not null or link.expires_at<=moment then raise exception 'LINK_UNAVAILABLE';end if;
 select * into a from public.appointments where organization_id=link.organization_id and id=link.appointment_id for update;
 if a.revision<>link.appointment_revision or a.status not in('reserved','declined_time','declined_service') then raise exception 'LINK_UNAVAILABLE';end if;
 select * into prior from private.customer_action_receipts where organization_id=link.organization_id and link_id=link.id and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into cfg from public.configuration_versions where organization_id=link.organization_id order by version desc limit 1;
 if a.revision is distinct from (p_input->>'appointmentRevision')::integer or a.response_version is distinct from (p_input->>'responseVersion')::integer or cfg.version is distinct from (p_input->>'configurationVersion')::integer then raise exception 'STALE_REVISION';end if;
 if a.status='reserved' and a.arrival_at<=moment then raise exception 'TRANSITION';end if;
 if action='confirm' then
  if a.status<>'reserved' or preferred is not null or note<>'' then raise exception 'TRANSITION';end if;
  if a.customer_response='reschedule_requested' then raise exception 'RESCHEDULE_PENDING';end if;
  if a.customer_response<>'confirmed' then
   update public.appointments set customer_response='confirmed',response_revision=revision,response_version=response_version+1 where organization_id=link.organization_id and id=a.id returning * into a;
   update public.appointment_tasks set state='done' where organization_id=link.organization_id and appointment_id=a.id and appointment_revision=a.revision and kind='customer_followup' and state='pending';
   insert into public.audit_events(organization_id,action,object_id,object_revision,correlation_id) values(link.organization_id,'appointment.customer_confirmed',a.id,a.revision,gen_random_uuid());
  end if;
 else
  if a.status not in('reserved','declined_time') or length(note) not between 10 and 2000 or (preferred is not null and preferred!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$') then raise exception 'VALIDATION';end if;
  if preferred is not null then perform preferred::timestamp;end if;
  update public.appointments set customer_response='reschedule_requested',response_revision=revision,response_version=response_version+1 where organization_id=link.organization_id and id=a.id returning * into a;
  update public.customer_schedule_preferences set status='superseded' where organization_id=link.organization_id and appointment_id=a.id and status='pending';
  insert into public.customer_schedule_preferences(organization_id,request_id,appointment_id,appointment_revision,response_version,timezone,preferred_local_start,note)
   values(link.organization_id,link.request_id,a.id,a.revision,a.response_version,a.timezone,preferred,note) returning id into preference;
  insert into public.audit_events(organization_id,action,object_id,object_revision,correlation_id) values(link.organization_id,'appointment.customer_reschedule_requested',a.id,a.revision,gen_random_uuid());
  insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(link.organization_id,'appointment:'||a.id||':'||a.revision||':response:'||a.response_version,'appointment.reschedule_requested',a.id,
   jsonb_build_object('appointmentRevision',a.revision,'responseVersion',a.response_version,'requestId',link.request_id,'preferenceId',preference,'recipient',cfg.settings->>'notificationRecipient'));
 end if;
 result:=jsonb_build_object('response',a.customer_response,'responseVersion',a.response_version,'status',a.status,'appointmentRevision',a.revision,'originalRetained',a.status='reserved');
 insert into private.customer_action_receipts(organization_id,link_id,key,fingerprint,result) values(link.organization_id,link.id,p_key,fingerprint,result);
 return result;
end$$;
create function public.customer_request_action(p_hash text,p_input jsonb,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.customer_request_action(p_hash,p_input,p_key)$$;
revoke all on function private.customer_request_action(text,jsonb,text),public.customer_request_action(text,jsonb,text) from public,anon,authenticated;
grant execute on function private.customer_request_action(text,jsonb,text),public.customer_request_action(text,jsonb,text) to service_role;

create function private.revoke_changed_customer_links() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.revision<>old.revision or new.status<>old.status then
  update private.customer_request_links set revoked_at=clock_timestamp() where organization_id=new.organization_id and appointment_id=new.id and revoked_at is null;
  update public.customer_schedule_preferences set status='superseded' where organization_id=new.organization_id and appointment_id=new.id and status='pending';
 end if;return new;
end$$;
create trigger revoke_changed_customer_links after update of revision,status on public.appointments for each row execute function private.revoke_changed_customer_links();
revoke all on function private.revoke_changed_customer_links() from public,anon,authenticated,service_role;

-- Shared current-state predicate for claiming and beginning an appointment notice.
create function private.appointment_notice_current(p_org uuid,p_id uuid) returns boolean
language sql security invoker set search_path='' as $$
 select exists(select 1 from public.outbox o join public.appointments a on a.organization_id=o.organization_id and a.id=o.object_id
 where o.organization_id=p_org and o.id=p_id and a.revision=(o.payload->>'appointmentRevision')::integer and
 case o.kind
 when 'appointment.owner_approval' then a.status='proposal' and a.expires_at>clock_timestamp()
 when 'appointment.confirmation' then a.status='reserved' and a.arrival_at>clock_timestamp()
 when 'appointment.reminder' then a.status='reserved' and a.arrival_at>clock_timestamp()
 when 'appointment.declined_time' then a.status='declined_time' and not exists(select 1 from public.appointments b where b.organization_id=a.organization_id and b.request_id=a.request_id and b.id<>a.id and b.id is distinct from a.replaces_id and (b.status='reserved' or (b.status in('held','proposal') and b.expires_at>clock_timestamp())))
 when 'appointment.declined_service' then a.status='declined_service' and not exists(select 1 from public.appointments b where b.organization_id=a.organization_id and b.request_id=a.request_id and b.id<>a.id and b.id is distinct from a.replaces_id and (b.status='reserved' or (b.status in('held','proposal') and b.expires_at>clock_timestamp())))
 when 'appointment.reschedule_requested' then a.status in('reserved','declined_time') and a.customer_response='reschedule_requested' and a.response_version=(o.payload->>'responseVersion')::integer
  and exists(select 1 from public.customer_schedule_preferences p where p.organization_id=p_org and p.id=(o.payload->>'preferenceId')::uuid and p.status='pending')
 else false end)
$$;
revoke all on function private.appointment_notice_current(uuid,uuid) from public,anon,authenticated,service_role;

-- Include owner reschedule notices; never claim a reminder that is no longer due/current.
create or replace function private.claim_outbox(p_org uuid,p_limit integer default 10) returns setof public.outbox
language plpgsql security definer set search_path='' as $$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 update public.outbox set status='needs_reconciliation',lease_token=null,lease_until=null where organization_id=p_org and status='sending' and lease_until<=clock_timestamp();
 update public.delivery_attempts d set status='unknown',finished_at=clock_timestamp(),error='Lease expired after sending began; reconcile before resend' where d.organization_id=p_org and d.status='started' and exists(select 1 from public.outbox o where o.organization_id=d.organization_id and o.id=d.outbox_id and o.status='needs_reconciliation');
 update public.outbox set status=case when attempts>=10 then 'dead_letter' else 'pending' end,lease_token=null,lease_until=null where organization_id=p_org and status='leased' and lease_until<=clock_timestamp();
 update public.outbox set status='dead_letter' where organization_id=p_org and status in('pending','failed') and attempts>=10;
 update public.outbox o set status='suppressed',lease_token=null,lease_until=null where o.organization_id=p_org and o.kind like 'appointment.%' and o.status in('pending','failed','leased') and not private.appointment_notice_current(p_org,o.id);
 if not exists(select 1 from public.integration_connections where organization_id=p_org and provider='gmail' and status='active' and secret_ref is not null) then return;end if;
 return query update public.outbox o set status='leased',lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',attempts=o.attempts+1
 where o.organization_id=p_org and o.id in(select x.id from public.outbox x where x.organization_id=p_org and x.status in('pending','failed') and x.attempts<10 and x.next_attempt_at<=clock_timestamp()
 and x.kind in('request.owner_notification','appointment.owner_approval','appointment.confirmation','appointment.reminder','appointment.declined_time','appointment.declined_service','appointment.reschedule_requested')
 order by x.created_at,x.id for update skip locked limit greatest(1,least(coalesce(p_limit,10),25))) returning o.*;
end$$;

create or replace function private.begin_delivery(p_org uuid,p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.outbox; a public.appointments;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.integration_connections where organization_id=p_org and provider='gmail' and status='active' and secret_ref is not null) then raise exception 'PROVIDER_DISABLED';end if;
 select * into o from public.outbox where organization_id=p_org and id=p_id and lease_token=p_lease and lease_until>clock_timestamp() and status='leased' for update;
 if not found then raise exception 'STALE_LEASE';end if;
 if o.kind like 'appointment.%' and not private.appointment_notice_current(p_org,p_id) then update public.outbox set status='suppressed',lease_token=null,lease_until=null where organization_id=p_org and id=p_id;return jsonb_build_object('status','suppressed');end if;
 update public.outbox set status='sending' where organization_id=p_org and id=p_id;
 insert into public.delivery_attempts(organization_id,outbox_id,attempt_no,status) values(p_org,p_id,o.attempts,'started');
 return jsonb_build_object('status','sending','attempt',o.attempts);
end$$;
