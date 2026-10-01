create table private.google_projections (
 organization_id uuid not null,appointment_id uuid not null,calendar_id text not null,event_id text,etag text,
 revision integer not null default 0,state text not null default 'pending',reason text,checked_at timestamptz,
 primary key(organization_id,appointment_id),foreign key(organization_id,appointment_id) references public.appointments(organization_id,id)
);
alter table private.google_projections enable row level security;
revoke all on private.google_projections from public,anon,authenticated;
create policy google_projections_deny on private.google_projections to anon,authenticated using(false) with check(false);
create table private.google_accounts (
 organization_id uuid primary key references public.organizations(id), revision integer not null default 0,
 encrypted_tokens text, email text, subject text, scopes text[] not null default '{}', calendar_id text,
 health text not null default 'disconnected', checked_at timestamptz, gmail_test text not null default 'not_tested',
 test_key uuid, test_started_at timestamptz, updated_at timestamptz not null default now()
);
create table private.google_oauth_states (
 hash text primary key check(length(hash)=64), organization_id uuid not null references public.organizations(id),
 ciphertext text not null, expires_at timestamptz not null
);
alter table private.google_accounts enable row level security;
alter table private.google_oauth_states enable row level security;
revoke all on private.google_accounts,private.google_oauth_states from public,anon,authenticated;
create policy google_accounts_deny on private.google_accounts to anon,authenticated using(false) with check(false);
create policy google_states_deny on private.google_oauth_states to anon,authenticated using(false) with check(false);

create function public.google_access(p_org uuid) returns boolean language sql security invoker set search_path='' as $$
 select private.staff(p_org,array['owner','admin'])
$$;
revoke all on function public.google_access(uuid) from public,anon;
grant execute on function public.google_access(uuid) to authenticated;

-- Server-only bridge. Ciphertext never becomes available through tenant SELECT/RPC access.
create function private.google_store(p_org uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a private.google_accounts; state private.google_oauth_states; item public.outbox; appointment public.appointments; projection private.google_projections; result jsonb;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_action='state_put' then
  delete from private.google_oauth_states where expires_at<now();
  insert into private.google_oauth_states values(p_input->>'hash',p_org,p_input->>'ciphertext',now()+interval '10 minutes');
  return '{}'::jsonb;
 elsif p_action='state_take' then
  delete from private.google_oauth_states where hash=p_input->>'hash' and expires_at>now() returning * into state;
  return case when state.hash is null then null else to_jsonb(state) end;
 end if;
 insert into private.google_accounts(organization_id) values(p_org) on conflict do nothing;
 select * into a from private.google_accounts where organization_id=p_org for update;
 if p_action='read' then return to_jsonb(a);end if;
 if p_action='sync_status' then return coalesce((select jsonb_agg(to_jsonb(p)) from (select appointment_id,state,reason,checked_at from private.google_projections where organization_id=p_org order by checked_at desc nulls last limit 50) p),'[]'::jsonb);end if;
 if p_action='projection_claim' then
  if a.encrypted_tokens is null or a.calendar_id is null then raise exception 'CALENDAR_REQUIRED';end if;
  update public.outbox set status='pending',lease_token=null,lease_until=null where organization_id=p_org and kind like 'calendar.%' and status='leased' and lease_until<now();
  select * into item from public.outbox where organization_id=p_org and kind like 'calendar.%' and status in ('pending','failed') and next_attempt_at<=now() and attempts<10 order by created_at,id for update skip locked limit 1;
  if not found then return null;end if;
  select * into appointment from public.appointments where organization_id=p_org and id=item.object_id;
  if appointment.id is null or appointment.revision is distinct from (item.payload->>'appointmentRevision')::integer then
   update public.outbox set status='suppressed' where organization_id=p_org and id=item.id;return '{"suppressed":true}'::jsonb;
  end if;
  update public.outbox set status='leased',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1 where organization_id=p_org and id=item.id returning * into item;
  select * into projection from private.google_projections where organization_id=p_org and appointment_id=appointment.id;
  if projection.calendar_id is not null and projection.calendar_id<>a.calendar_id then raise exception 'CALENDAR_MIGRATION_REQUIRED';end if;
  return jsonb_build_object('item',to_jsonb(item),'appointment',to_jsonb(appointment),'projection',to_jsonb(projection),'calendar',a.calendar_id,'connectionRevision',a.revision);
 elsif p_action='projection_finish' then
  select * into item from public.outbox where organization_id=p_org and id=(p_input->>'id')::uuid and lease_token=(p_input->>'lease')::uuid and status='leased' and lease_until>now() for update;
  if not found then raise exception 'STALE_LEASE';end if;
  if a.revision is distinct from (p_input->>'connectionRevision')::integer or a.encrypted_tokens is null then raise exception 'STALE_CONNECTION';end if;
  if p_input->>'result' not in ('synced','needs_review','failed') then raise exception 'VALIDATION';end if;
  update public.outbox set status=case p_input->>'result' when 'synced' then 'accepted' when 'needs_review' then 'needs_reconciliation' else case when attempts>=10 then 'dead_letter' else 'failed' end end,
   lease_token=null,lease_until=null,next_attempt_at=now()+interval '5 minutes' where organization_id=p_org and id=item.id;
  if p_input->>'result'<>'failed' then
   insert into private.google_projections values(p_org,item.object_id,a.calendar_id,p_input->>'eventId',p_input->>'etag',(item.payload->>'appointmentRevision')::integer,p_input->>'result',left(p_input->>'reason',300),now())
   on conflict(organization_id,appointment_id) do update set event_id=excluded.event_id,etag=case when excluded.state='synced' then excluded.etag else private.google_projections.etag end,revision=excluded.revision,state=excluded.state,reason=excluded.reason,checked_at=now();
  end if;
  return '{}'::jsonb;
 elsif p_action='reconcile_queue' then
  if a.encrypted_tokens is null or a.calendar_id is null then raise exception 'CALENDAR_REQUIRED';end if;
  insert into public.outbox(organization_id,event_key,kind,object_id,payload)
  select p_org,'google-reconcile:'||p.appointment_id||':'||floor(extract(epoch from now())/300)::text,'calendar.reconcile',p.appointment_id,jsonb_build_object('appointmentRevision',a2.revision)
  from private.google_projections p join public.appointments a2 on a2.organization_id=p.organization_id and a2.id=p.appointment_id
  where p.organization_id=p_org and a2.end_at>now()-interval '1 day' order by a2.start_at limit 100
  on conflict(organization_id,event_key) do nothing;return '{}'::jsonb;
 end if;
 if a.revision is distinct from (p_input->>'revision')::integer then raise exception 'STALE_CONNECTION';end if;
 if p_action='connect' then
  update private.google_accounts set encrypted_tokens=p_input->>'ciphertext',email=p_input->>'email',subject=p_input->>'subject',
   scopes=array(select jsonb_array_elements_text(p_input->'scopes')),calendar_id=null,health='connected',gmail_test='not_tested',test_key=null,checked_at=now()
   where organization_id=p_org;
 elsif p_action='tokens' then
  if a.encrypted_tokens is null then raise exception 'DISCONNECTED';end if;
  update private.google_accounts set encrypted_tokens=p_input->>'ciphertext' where organization_id=p_org;
 elsif p_action='calendar' then
  if a.encrypted_tokens is null then raise exception 'DISCONNECTED';end if;
  if a.calendar_id is not null and a.calendar_id<>p_input->>'calendarId' and exists(select 1 from private.google_projections where organization_id=p_org) then raise exception 'CALENDAR_MIGRATION_REQUIRED';end if;
  update private.google_accounts set calendar_id=p_input->>'calendarId',health='connected',checked_at=now() where organization_id=p_org;
 elsif p_action='health' then
  update private.google_accounts set health=p_input->>'health',checked_at=now() where organization_id=p_org;
 elsif p_action='test_begin' then
  if a.encrypted_tokens is null then raise exception 'DISCONNECTED';end if;
  if a.test_key=(p_input->>'key')::uuid then return to_jsonb(a)||'{"replay":true}'::jsonb;end if;
  if a.gmail_test in ('sending','unknown') then raise exception 'DELIVERY_REVIEW_REQUIRED';end if;
  if a.test_started_at>now()-interval '1 minute' then raise exception 'TRY_LATER';end if;
  update private.google_accounts set gmail_test='sending',test_key=(p_input->>'key')::uuid,test_started_at=now() where organization_id=p_org;
 elsif p_action='test_finish' then
  if a.test_key is distinct from (p_input->>'key')::uuid or a.gmail_test<>'sending' then raise exception 'STALE_TEST';end if;
  if p_input->>'result' not in ('accepted','failed','unknown') then raise exception 'VALIDATION';end if;
  update private.google_accounts set gmail_test=p_input->>'result' where organization_id=p_org;
 elsif p_action='disconnect' then
  update private.google_accounts set encrypted_tokens=null,email=null,subject=null,scopes='{}',health='disconnected',gmail_test='not_tested',test_key=null where organization_id=p_org;
  delete from private.google_oauth_states where organization_id=p_org;
 else raise exception 'VALIDATION';end if;
 update private.google_accounts set revision=revision+1,updated_at=now() where organization_id=p_org returning * into a;
 if p_action in ('connect','calendar','disconnect') then
  insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
   values(p_org,(p_input->>'actor')::uuid,'google.'||p_action,p_org,a.revision,gen_random_uuid());
 end if;
 -- Deliberately never activate the email dispatcher here. Legacy website email stays authoritative.
 insert into public.integration_connections(organization_id,provider,status,last_success_at,last_error)
 values(p_org,'gmail',case when a.encrypted_tokens is null then 'disabled' else 'test' end,a.checked_at,null),
 (p_org,'google_calendar',case when a.encrypted_tokens is null then 'disabled' when a.calendar_id is null then 'configured' else 'test' end,a.checked_at,null)
 on conflict(organization_id,provider) do update set status=excluded.status,last_success_at=excluded.last_success_at,secret_ref=null;
 return to_jsonb(a);
end$$;
create function public.google_store(p_org uuid,p_action text,p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.google_store(p_org,p_action,p_input)$$;
revoke all on function private.google_store(uuid,text,jsonb),public.google_store(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.google_store(uuid,text,jsonb),public.google_store(uuid,text,jsonb) to service_role;
grant usage on schema private to service_role;
