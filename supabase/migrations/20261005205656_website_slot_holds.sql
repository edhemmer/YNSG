-- Website selections use canonical appointments and resource reservations.
-- This bridge is server-only. It never confirms a visit or trusts browser Google facts.
create table private.website_slot_holds (
 organization_id uuid not null, appointment_id uuid not null,
 selection_key uuid not null, client_hash text not null check(client_hash ~ '^[a-f0-9]{64}$'), browser_hash text not null check(browser_hash ~ '^[a-f0-9]{64}$'),
 token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'), fingerprint text not null,
 configuration_version integer not null,
 primary key(organization_id,appointment_id), unique(organization_id,selection_key), unique(organization_id,token_hash),
 foreign key(organization_id,appointment_id) references public.appointments(organization_id,id),
 foreign key(organization_id,configuration_version) references public.configuration_versions(organization_id,version)
);
create index website_slot_holds_browser on private.website_slot_holds(organization_id,browser_hash);
create index website_slot_holds_client on private.website_slot_holds(organization_id,client_hash);
create index website_slot_holds_configuration on private.website_slot_holds(organization_id,configuration_version);
alter table private.website_slot_holds enable row level security;
create policy website_slot_holds_deny on private.website_slot_holds to anon,authenticated using(false) with check(false);
revoke all on private.website_slot_holds from public,anon,authenticated,service_role;

-- Expired selections stop affecting availability immediately. The next booking
-- transaction clears their physical reservations under the tenant lock.
create function private.website_reserved_times(p_org uuid,p_resource uuid,p_begin timestamptz,p_finish timestamptz) returns table(during tstzrange)
language plpgsql stable security definer set search_path='' as $$begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_begin is null or p_finish is null or p_finish<=p_begin or p_finish>p_begin+interval '33 days' then raise exception 'VALIDATION';end if;
 return query select rr.during from public.resource_reservations rr join public.appointments a on a.organization_id=rr.organization_id and a.id=rr.appointment_id
 where rr.organization_id=p_org and rr.resource_id=p_resource and rr.active and rr.during && tstzrange(p_begin,p_finish,'[)')
 and (a.status not in('held','proposal') or a.expires_at>statement_timestamp()) order by lower(rr.during),rr.id limit 1001;
end$$;
create function public.website_reserved_times(p_org uuid,p_resource uuid,p_begin timestamptz,p_finish timestamptz) returns table(during tstzrange)
language sql stable security invoker set search_path='' as $$select * from private.website_reserved_times(p_org,p_resource,p_begin,p_finish)$$;
revoke all on function private.website_reserved_times(uuid,uuid,timestamptz,timestamptz),public.website_reserved_times(uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function private.website_reserved_times(uuid,uuid,timestamptz,timestamptz),public.website_reserved_times(uuid,uuid,timestamptz,timestamptz) to service_role;

create function private.website_provider_clear(p_org uuid,p_start timestamptz,p_end timestamptz,p_buffer integer,p_provider jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare g private.google_accounts; item jsonb; moment timestamptz:=clock_timestamp();
begin
 select * into g from private.google_accounts where organization_id=p_org for share;
 if p_buffer is null or p_buffer not between 0 and 180 or jsonb_typeof(p_provider) is distinct from 'object'
 or g.encrypted_tokens is null or g.calendar_id is null
 or g.revision is distinct from (p_provider->>'connectionRevision')::integer or g.calendar_id is distinct from p_provider->>'calendarId'
 or p_provider->>'checkedAt' is null or p_provider->>'windowStart' is null or p_provider->>'windowEnd' is null
 or (p_provider->>'checkedAt')::timestamptz>moment+interval '5 seconds' or (p_provider->>'checkedAt')::timestamptz<=moment-interval '60 seconds'
 or (p_provider->>'windowStart')::timestamptz>p_start-make_interval(mins=>p_buffer)
 or (p_provider->>'windowEnd')::timestamptz<p_end+make_interval(mins=>p_buffer)
 or jsonb_typeof(p_provider->'busy') is distinct from 'array' or jsonb_array_length(p_provider->'busy')>10000 then raise exception 'PROVIDER_FACTS_REQUIRED';end if;
 for item in select value from jsonb_array_elements(p_provider->'busy') loop
  if item->>'start' is null or item->>'end' is null or (item->>'end')::timestamptz<=(item->>'start')::timestamptz then raise exception 'PROVIDER_FACTS_REQUIRED';end if;
  if (item->>'start')::timestamptz<p_end+make_interval(mins=>p_buffer) and (item->>'end')::timestamptz>p_start-make_interval(mins=>p_buffer) then raise exception 'GOOGLE_BUSY_CONFLICT';end if;
 end loop;
end$$;
revoke all on function private.website_provider_clear(uuid,timestamptz,timestamptz,integer,jsonb) from public,anon,authenticated,service_role;

create function private.website_slot_hold(p_org uuid,p_action text,p_key uuid,p_client text,p_browser text,p_token text,p_start timestamptz,p_provider jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg public.configuration_versions; h private.website_slot_holds; a public.appointments; rules jsonb;
 moment timestamptz; operator_id uuid; buffer integer; local_start timestamp; local_end timestamp; fingerprint text; expired integer;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_action is null or p_action not in ('select','release') or p_client is null or p_client !~ '^[a-f0-9]{64}$' or p_key is null or p_browser is null or p_browser !~ '^[a-f0-9]{64}$' or p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'VALIDATION';end if;
 insert into private.schedule_state(organization_id) values(p_org) on conflict do nothing;
 perform 1 from private.schedule_state where organization_id=p_org for update;
 moment:=clock_timestamp();
 if p_action='release' then
  select * into h from private.website_slot_holds where organization_id=p_org and token_hash=p_token and browser_hash=p_browser for update;
  if h.appointment_id is not null then
   update public.appointments set status='canceled',revision=revision+1 where organization_id=p_org and id=h.appointment_id and request_id is null and status='held';
   if found then update private.schedule_state set revision=revision+1 where organization_id=p_org;end if;
  end if;
  -- A cancellation arriving before selection also prevents that late selection.
  insert into private.command_receipts values(p_org,'WebsiteHoldRelease',p_key::text,encode(sha256(convert_to(p_browser||p_token,'UTF8')),'hex'),jsonb_build_object('ok',true),moment) on conflict do nothing;
  return jsonb_build_object('ok',true);
 end if;
 if exists(select 1 from private.command_receipts where organization_id=p_org and command='WebsiteHoldRelease' and key=p_key::text) then raise exception 'HOLD_EXPIRED';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_browser,p_token,p_start)::text,'UTF8')),'hex');
 select * into h from private.website_slot_holds where organization_id=p_org and selection_key=p_key;
 if found then
  if h.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  select * into a from public.appointments where organization_id=p_org and id=h.appointment_id;
  if a.status<>'held' or a.request_id is not null or a.expires_at<=moment then raise exception 'HOLD_EXPIRED';end if;
  return jsonb_build_object('ok',true,'start',a.start_at,'end',a.end_at,'expiresAt',a.expires_at);
 end if;
 if not exists(select 1 from public.organizations where id=p_org and status in('setup','active'))
 or not exists(select 1 from public.entitlements where organization_id=p_org and module='scheduling' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 select * into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 rules:=cfg.settings->'scheduling';buffer:=(rules->>'bufferMinutes')::integer;
 if cfg.version is null or cfg.settings->>'timezone'<>'America/Chicago' or cfg.settings->>'intakeEnabled' is distinct from 'true'
 or jsonb_typeof(rules->'weekdays') is distinct from 'array' or buffer is null or buffer not between 0 and 180
 or (rules->>'selectionMinutes')::integer is null or (rules->>'selectionMinutes')::integer not between 1 and 30
 or (rules->>'proposalMinutes')::integer is null or (rules->>'proposalMinutes')::integer<=0
 or (rules->>'leadMinutes')::integer is null or (rules->>'leadMinutes')::integer<0
 or coalesce((rules->>'horizonMinutes')::integer,(rules->>'horizonDays')::integer*1440) is null then raise exception 'SETUP_REQUIRED';end if;
 if p_start is null or p_start<=moment or p_start<moment+make_interval(mins=>(rules->>'leadMinutes')::integer)
 or p_start>moment+make_interval(mins=>coalesce((rules->>'horizonMinutes')::integer,(rules->>'horizonDays')::integer*1440))
 or (p_start at time zone 'America/Chicago')::date>(moment at time zone 'America/Chicago')::date+30 then raise exception 'OUTSIDE_BOOKING_WINDOW';end if;
 local_start:=p_start at time zone 'America/Chicago';local_end:=(p_start+interval '2 hours') at time zone 'America/Chicago';
 if rules->>'earliestStart' is null or rules->>'latestStart' is null or rules->>'endOfDay' is null
 or not exists(select 1 from jsonb_array_elements_text(rules->'weekdays') d where d::integer=extract(isodow from local_start)::integer)
 or extract(hour from local_start)*60+extract(minute from local_start)<(rules->>'earliestStart')::integer
 or extract(hour from local_start)*60+extract(minute from local_start)>(rules->>'latestStart')::integer
 or local_start::date<>local_end::date or extract(hour from local_end)*60+extract(minute from local_end)>(rules->>'endOfDay')::integer
 or extract(second from local_start)<>0 or extract(minute from local_start)::integer%30<>0 then raise exception 'OUTSIDE_OPERATING_HOURS';end if;
 perform private.website_provider_clear(p_org,p_start,p_start+interval '2 hours',buffer,p_provider);
 if (select count(*) from private.website_slot_holds wh join public.appointments aa on aa.organization_id=wh.organization_id and aa.id=wh.appointment_id where wh.organization_id=p_org and aa.status='held' and aa.request_id is null and aa.expires_at>moment and wh.browser_hash<>p_browser and wh.client_hash=p_client)>=3 then raise exception 'RATE_LIMITED';end if;
 select id into operator_id from public.resources where organization_id=p_org and kind='operator' and status='available';
 if operator_id is null or (select count(*) from public.resources where organization_id=p_org and kind='operator' and status='available')<>1 then raise exception 'SETUP_REQUIRED';end if;
 perform 1 from public.resources where organization_id=p_org and id=operator_id for update;
 if exists(select 1 from public.availability_exceptions where organization_id=p_org and starts_at<p_start+interval '2 hours'+make_interval(mins=>buffer) and ends_at>p_start-make_interval(mins=>buffer)) then raise exception 'OWNER_BLOCK';end if;
 if exists(select 1 from public.resource_reservations rr join public.appointments aa on aa.organization_id=rr.organization_id and aa.id=rr.appointment_id
 where rr.organization_id=p_org and rr.resource_id=operator_id and rr.active and (aa.status not in('held','proposal') or aa.expires_at>moment)
 and lower(rr.during)<p_start+interval '2 hours'+make_interval(mins=>buffer) and upper(rr.during)>p_start-make_interval(mins=>buffer)
 and not exists(select 1 from private.website_slot_holds wh where wh.organization_id=p_org and wh.appointment_id=aa.id and wh.browser_hash=p_browser and aa.request_id is null and aa.status='held')) then raise exception 'CAPACITY_CONFLICT';end if;
 expired:=private.expire_appointments(p_org,moment);
 -- Replacement and cancellation are in the same transaction as the new reservation.
 update public.appointments aa set status='canceled',revision=revision+1 where aa.organization_id=p_org and aa.status='held' and aa.request_id is null
 and exists(select 1 from private.website_slot_holds wh where wh.organization_id=p_org and wh.appointment_id=aa.id and wh.browser_hash=p_browser);
 insert into public.appointments(organization_id,start_at,end_at,arrival_at,timezone,status,expires_at)
 values(p_org,p_start,p_start+interval '2 hours',p_start,'America/Chicago','held',least(moment+make_interval(mins=>(rules->>'selectionMinutes')::integer),p_start)) returning * into a;
 insert into public.resource_reservations(organization_id,appointment_id,resource_id,during,active) values(p_org,a.id,operator_id,tstzrange(a.start_at,a.end_at,'[)'),true);
 insert into private.website_slot_holds values(p_org,a.id,p_key,p_client,p_browser,p_token,fingerprint,cfg.version);
 update private.schedule_state set revision=revision+1 where organization_id=p_org;
 return jsonb_build_object('ok',true,'start',a.start_at,'end',a.end_at,'expiresAt',a.expires_at);
end$$;
create function public.website_slot_hold(p_org uuid,p_action text,p_key uuid,p_client text,p_browser text,p_token text,p_start timestamptz,p_provider jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.website_slot_hold(p_org,p_action,p_key,p_client,p_browser,p_token,p_start,p_provider)$$;
revoke all on function private.website_slot_hold(uuid,text,uuid,text,text,text,timestamptz,jsonb),public.website_slot_hold(uuid,text,uuid,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function private.website_slot_hold(uuid,text,uuid,text,text,text,timestamptz,jsonb),public.website_slot_hold(uuid,text,uuid,text,text,text,timestamptz,jsonb) to service_role;

create function private.submit_website_request(p_org uuid,p_key text,p_client_hash text,p_data jsonb,p_selection jsonb,p_provider jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior private.command_receipts; fingerprint text; result jsonb; h private.website_slot_holds; a public.appointments; cfg public.configuration_versions; moment timestamptz;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or length(p_key) not between 16 and 128 or p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'VALIDATION';end if;
 if p_selection is not null and (jsonb_typeof(p_selection) is distinct from 'object'
 or p_selection->>'mode' is null or p_selection->>'mode' not in('once','weekly') or p_selection->>'start' is null
 or p_selection->>'tokenHash' is null or p_selection->>'tokenHash' !~ '^[a-f0-9]{64}$'
 or p_selection->>'browserHash' is null or p_selection->>'browserHash' !~ '^[a-f0-9]{64}$'
 or exists(select 1 from jsonb_object_keys(p_selection) k where k not in('mode','start','tokenHash','browserHash'))) then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_data,p_selection)::text,'UTF8')),'hex');
 insert into private.schedule_state(organization_id) values(p_org) on conflict do nothing;
 perform 1 from private.schedule_state where organization_id=p_org for update;
 moment:=clock_timestamp();
 select * into prior from private.command_receipts where organization_id=p_org and command='WebsiteRequest' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if p_selection is not null then
  select * into h from private.website_slot_holds where organization_id=p_org and token_hash=p_selection->>'tokenHash' and browser_hash=p_selection->>'browserHash' for update;
  select * into a from public.appointments where organization_id=p_org and id=h.appointment_id for update;
  if a.id is null or a.status<>'held' or a.request_id is not null or a.expires_at<=moment or a.start_at is distinct from (p_selection->>'start')::timestamptz then raise exception 'HOLD_EXPIRED';end if;
  select * into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
  if cfg.version is distinct from h.configuration_version or cfg.settings->>'intakeEnabled' is distinct from 'true'
  or not exists(select 1 from public.entitlements where organization_id=p_org and module='scheduling' and enabled)
  or exists(select 1 from public.resources r join public.resource_reservations rr on rr.organization_id=r.organization_id and rr.resource_id=r.id where rr.organization_id=p_org and rr.appointment_id=a.id and rr.active and r.status<>'available') then raise exception 'HOLD_EXPIRED';end if;
  if p_provider is null then return null;end if;
  perform private.website_provider_clear(p_org,a.start_at,a.end_at,(cfg.settings->'scheduling'->>'bufferMinutes')::integer,p_provider);
 end if;
 result:=public.submit_service_request(p_org,p_key,p_client_hash,p_data);
 if result->>'ok' is distinct from 'true' then raise exception 'REQUEST_UNAVAILABLE';end if;
 if p_selection is not null then
  update public.appointments set request_id=(result->>'id')::uuid,status='proposal',revision=revision+1,
   expires_at=least(moment+make_interval(mins=>(cfg.settings->'scheduling'->>'proposalMinutes')::integer),start_at)
  where organization_id=p_org and id=a.id returning * into a;
  insert into public.appointment_tasks(organization_id,appointment_id,appointment_revision,kind,due_at) values(p_org,a.id,a.revision,'owner_approval',a.expires_at);
  -- The normal owner request notice already contains the selected date and request link.
  -- Do not send a duplicate owner email or write a Google event before approval.
  insert into public.audit_events(organization_id,action,object_id,object_revision,correlation_id) values(p_org,'appointment.website_proposal',a.id,a.revision,gen_random_uuid());
  update private.schedule_state set revision=revision+1 where organization_id=p_org;
 end if;
 insert into private.command_receipts values(p_org,'WebsiteRequest',p_key,fingerprint,result,moment);
 return result;
end$$;
create function public.submit_website_request(p_org uuid,p_key text,p_client_hash text,p_data jsonb,p_selection jsonb,p_provider jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.submit_website_request(p_org,p_key,p_client_hash,p_data,p_selection,p_provider)$$;
revoke all on function private.submit_website_request(uuid,text,text,jsonb,jsonb,jsonb),public.submit_website_request(uuid,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.submit_website_request(uuid,text,text,jsonb,jsonb,jsonb),public.submit_website_request(uuid,text,text,jsonb,jsonb,jsonb) to service_role;

-- Owners may add equipment to a website proposal only after the normal trusted review.
-- Its originally reserved operator cannot be dropped; all added capacity is checked atomically.
do $$declare d text;old text;replacement text;begin
 d:=pg_get_functiondef('private.expire_appointments(uuid,timestamptz)'::regprocedure);
 old:='  insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,''appointment:''||a.id||'':''||(a.revision+1)||'':calendar'',''calendar.remove'',a.id,jsonb_build_object(''appointmentRevision'',a.revision+1));';
 if strpos(d,old)=0 then raise exception 'website expiry baseline changed';end if;
 execute replace(d,old,'  if a.request_id is not null then'||chr(10)||old||chr(10)||'  end if;');
 d:=pg_get_functiondef('private.record_scheduling_review(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure);
 old:=' if a.id is not null and resources is distinct from (select array_agg(resource_id order by resource_id) from public.resource_reservations where organization_id=p_org and appointment_id=a.id and active) then raise exception ''EVIDENCE_MISMATCH'';end if;';
 replacement:=' if a.id is not null then
  if exists(select 1 from private.website_slot_holds where organization_id=p_org and appointment_id=a.id) then
   if not coalesce((select array_agg(resource_id order by resource_id) from public.resource_reservations where organization_id=p_org and appointment_id=a.id and active) <@ resources,false) then raise exception ''EVIDENCE_MISMATCH'';end if;
  elsif resources is distinct from (select array_agg(resource_id order by resource_id) from public.resource_reservations where organization_id=p_org and appointment_id=a.id and active) then raise exception ''EVIDENCE_MISMATCH'';end if;
 end if;';
 if strpos(d,old)=0 then raise exception 'website review baseline changed';end if;execute replace(d,old,replacement);
 d:=pg_get_functiondef('private.scheduling_command(uuid,text,jsonb,text)'::regprocedure);
 old:='   if e.start_at<>a.start_at or e.end_at<>a.end_at or e.arrival_at<>a.arrival_at or e.resources<>';
 replacement:='   if exists(select 1 from private.website_slot_holds where organization_id=p_org and appointment_id=a.id) then
    if not coalesce((select array_agg(resource_id order by resource_id) from public.resource_reservations where organization_id=p_org and appointment_id=a.id and active) <@ e.resources,false) then raise exception ''EVIDENCE_MISMATCH'';end if;
    foreach rid in array e.resources loop
     insert into public.resource_reservations(organization_id,appointment_id,resource_id,during,active) values(p_org,a.id,rid,tstzrange(a.start_at,a.end_at,''[)''),true) on conflict(organization_id,appointment_id,resource_id) do nothing;
    end loop;
   end if;
'||old;
 if strpos(d,old)=0 then raise exception 'website approval baseline changed';end if;execute replace(d,old,replacement);
 d:=pg_get_functiondef('private.scheduling_review_context(uuid,uuid,uuid)'::regprocedure);
 old:='  result:=result||jsonb_build_object(''appointment'',to_jsonb(a),';
 replacement:='  result:=result||jsonb_build_object(''allowAdditionalResources'',exists(select 1 from private.website_slot_holds where organization_id=p_org and appointment_id=a.id))||jsonb_build_object(''appointment'',to_jsonb(a),';
 if strpos(d,old)=0 then raise exception 'website context baseline changed';end if;execute replace(d,old,replacement);
end$$;
