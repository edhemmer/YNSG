-- Durable create intent: Google calendar insertion has no caller-defined idempotency key.
create table private.google_calendar_creations (
 organization_id uuid not null references public.organizations(id), subject text not null,
 operation_id uuid not null default gen_random_uuid(), connection_revision integer not null,
 summary text not null, timezone text not null,
 status text not null check(status in ('sending','created','unknown','failed')),
 calendar_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(organization_id,subject), check(status<>'created' or calendar_id is not null)
);
alter table private.google_calendar_creations enable row level security;
revoke all on private.google_calendar_creations from public,anon,authenticated;

create function private.google_calendar_creation(p_org uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a private.google_accounts; c private.google_calendar_creations; company public.organizations;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into a from private.google_accounts where organization_id=p_org for update;
 if p_action<>'finish' and (a.encrypted_tokens is null or a.subject is null) then raise exception 'GOOGLE_DISCONNECTED';end if;
 select * into c from private.google_calendar_creations where organization_id=p_org and subject=a.subject for update;
 if p_action='read' then return case when c.operation_id is null then null else jsonb_build_object('status',c.status,'calendarId',c.calendar_id,'summary',c.summary) end;end if;
 if p_action='begin' then
  if a.revision is distinct from (p_input->>'revision')::integer then raise exception 'STALE_CONNECTION';end if;
  if a.calendar_id is not null then raise exception 'BUSINESS_CALENDAR_ALREADY_SELECTED';end if;
  if not ('https://www.googleapis.com/auth/calendar.app.created'=any(a.scopes)) then raise exception 'CALENDAR_CREATION_PERMISSION_REQUIRED';end if;
  if c.operation_id is not null and c.status<>'failed' then
   return jsonb_build_object('create',false,'status',c.status,'calendarId',c.calendar_id,'summary',c.summary);
  end if;
  select * into company from public.organizations where id=p_org;
  if company.id is null then raise exception 'SETUP_REQUIRED';end if;
  insert into private.google_calendar_creations(organization_id,subject,connection_revision,summary,timezone,status)
  values(p_org,a.subject,a.revision,company.display_name||' — Appointments',company.timezone,'sending')
  on conflict(organization_id,subject) do update set operation_id=gen_random_uuid(),connection_revision=excluded.connection_revision,
   summary=excluded.summary,timezone=excluded.timezone,status='sending',calendar_id=null,updated_at=now() returning * into c;
  return jsonb_build_object('create',true,'operationId',c.operation_id,'subject',c.subject,'summary',c.summary,'timeZone',c.timezone);
 elsif p_action='finish' then
  -- Fence results by the original Google subject and operation even after reconnect/disconnect.
  select * into c from private.google_calendar_creations where organization_id=p_org and subject=p_input->>'subject' for update;
  if c.operation_id is distinct from (p_input->>'operationId')::uuid then raise exception 'STALE_OPERATION';end if;
  if c.status<>'sending' then return jsonb_build_object('status',c.status,'calendarId',c.calendar_id,'summary',c.summary);end if;
  if p_input->>'result' not in ('created','unknown','failed') then raise exception 'VALIDATION';end if;
  if p_input->>'result'='created' and coalesce(length(p_input->>'calendarId'),0) not between 1 and 1024 then raise exception 'VALIDATION';end if;
  update private.google_calendar_creations set status=p_input->>'result',calendar_id=case when p_input->>'result'='created' then p_input->>'calendarId' end,updated_at=now()
  where organization_id=p_org and subject=c.subject returning * into c;
  return jsonb_build_object('status',c.status,'calendarId',c.calendar_id,'summary',c.summary);
 end if;
 raise exception 'INVALID_ACTION';
end $$;
revoke all on function private.google_calendar_creation(uuid,text,jsonb) from public,anon,authenticated;
create function public.google_calendar_creation(p_org uuid,p_action text,p_input jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.google_calendar_creation(p_org,p_action,p_input)$$;
revoke all on function public.google_calendar_creation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.google_calendar_creation(uuid,text,jsonb),public.google_calendar_creation(uuid,text,jsonb) to service_role;
