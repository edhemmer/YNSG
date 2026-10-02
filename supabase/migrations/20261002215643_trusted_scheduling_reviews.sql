-- Owner review provenance plus a server-only Google fact bridge. No public booking activation.
create table private.scheduling_reviews (
 organization_id uuid not null, id uuid not null default gen_random_uuid(),request_id uuid not null,
 actor_id uuid not null references auth.users(id),session_id uuid not null,reviewed_at timestamptz not null default clock_timestamp(),
 input jsonb not null,provider jsonb not null,evidence_id uuid not null,
 primary key(organization_id,id),foreign key(organization_id,request_id) references public.service_requests(organization_id,id),
 foreign key(organization_id,evidence_id) references private.schedule_evidence(organization_id,id)
);
alter table private.scheduling_reviews enable row level security;
revoke all on private.scheduling_reviews from public,anon,authenticated,service_role;
create policy scheduling_reviews_deny on private.scheduling_reviews to anon,authenticated using(false) with check(false);

create function private.scheduling_review_context(p_org uuid,p_request uuid,p_appointment uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.service_requests;a public.appointments;result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into r from public.service_requests where organization_id=p_org and id=p_request and status in('reviewing','quoted');
 if not found then raise exception 'REQUEST_UNAVAILABLE';end if;
 result:=private.scheduling_snapshot(p_org)||jsonb_build_object('requestRevision',r.revision,'confirmedAppointments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'start',start_at,'end',end_at) order by start_at) from public.appointments where organization_id=p_org and request_id=p_request and status='reserved'),'[]'::jsonb));
 if p_appointment is not null then
  select * into a from public.appointments where organization_id=p_org and id=p_appointment and request_id=p_request and status='proposal' and expires_at>now();
  if not found then raise exception 'TRANSITION';end if;
  result:=result||jsonb_build_object('appointment',to_jsonb(a),'appointmentResources',(select jsonb_agg(resource_id order by resource_id) from public.resource_reservations where organization_id=p_org and appointment_id=a.id and active),
   'projection',(select jsonb_build_object('eventId',event_id,'etag',etag,'revision',revision,'calendarId',calendar_id,'state',state) from private.google_projections where organization_id=p_org and appointment_id=a.id));
 end if;
 return result;
end$$;
create function public.scheduling_review_context(p_org uuid,p_request uuid,p_appointment uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.scheduling_review_context(p_org,p_request,p_appointment)$$;
revoke all on function private.scheduling_review_context(uuid,uuid,uuid),public.scheduling_review_context(uuid,uuid,uuid) from public,anon,service_role;
grant execute on function private.scheduling_review_context(uuid,uuid,uuid),public.scheduling_review_context(uuid,uuid,uuid) to authenticated;

create function private.record_scheduling_review(p_org uuid,p_actor uuid,p_session uuid,p_key text,p_input jsonb,p_provider jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg public.configuration_versions;r public.service_requests;a public.appointments;g private.google_accounts;e private.schedule_evidence;
 prior private.command_receipts;fingerprint text;result jsonb;epoch bigint;resources uuid[];start_time timestamptz;end_time timestamptz;arrival_time timestamptz;
 booking_clock timestamptz;moment timestamptz:=clock_timestamp();buffer integer;before_minutes integer;after_minutes integer;rid uuid;item jsonb;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id join public.memberships m on m.user_id=u.id and m.organization_id=p_org
  where s.id=p_session and s.user_id=p_actor and s.aal='aal2' and (s.not_after is null or s.not_after>moment)
   and u.deleted_at is null and not u.is_anonymous and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=moment)
   and m.revoked_at is null and m.role in('owner','admin')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='scheduling' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_key is null or length(p_key) not between 16 and 128 or jsonb_typeof(p_input) is distinct from 'object' or jsonb_typeof(p_provider) is distinct from 'object'
  or p_input->>'scopeReviewed' is distinct from 'true' or p_input->>'equipmentReviewed' is distinct from 'true' or p_input->>'pickupReviewed' is distinct from 'true'
  or length(coalesce(p_input->>'reviewNote','')) not between 10 and 3000 then raise exception 'REVIEW_REQUIRED';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_actor,p_session,p_input)::text,'UTF8')),'hex');
 insert into private.schedule_state(organization_id) values(p_org) on conflict do nothing;
 select revision into epoch from private.schedule_state where organization_id=p_org for update;
 select * into prior from private.command_receipts where organization_id=p_org and command='SchedulingReview' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if epoch<>greatest(1,(p_input->>'scheduleRevision')::bigint) then raise exception 'STALE_REVISION';end if;
 select * into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 select * into r from public.service_requests where organization_id=p_org and id=(p_input->>'requestId')::uuid for update;
 if r.id is null or r.status not in('reviewing','quoted') then raise exception 'REQUEST_UNAVAILABLE';end if;
 if r.revision is distinct from (p_input->>'requestRevision')::integer or cfg.version is distinct from (p_input->>'configurationVersion')::integer then raise exception 'STALE_REVISION';end if;
 if not exists(select 1 from public.catalog_services where organization_id=p_org and id=r.service_id and compliance='approved') or exists(select 1 from public.service_request_items i join public.catalog_services c on c.organization_id=i.organization_id and c.id=i.service_id where i.organization_id=p_org and i.request_id=r.id and c.compliance<>'approved') then raise exception 'SERVICE_REVIEW_REQUIRED';end if;
 select * into g from private.google_accounts where organization_id=p_org for share;
 if g.encrypted_tokens is null or g.calendar_id is null or g.revision is distinct from (p_provider->>'connectionRevision')::integer or g.calendar_id is distinct from p_provider->>'calendarId'
  or p_provider->>'checkedAt' is null or p_provider->>'windowStart' is null or p_provider->>'windowEnd' is null
  or (p_provider->>'checkedAt')::timestamptz>moment+interval '5 seconds' or (p_provider->>'checkedAt')::timestamptz<=moment-interval '60 seconds'
  or jsonb_typeof(p_provider->'busy') is distinct from 'array' or jsonb_array_length(p_provider->'busy')>10000 then raise exception 'PROVIDER_FACTS_REQUIRED';end if;
 start_time:=(p_input->>'startAt')::timestamptz;end_time:=(p_input->>'endAt')::timestamptz;arrival_time:=(p_input->>'arrivalAt')::timestamptz;
 if start_time is null or end_time is null or arrival_time is null or end_time<=start_time or arrival_time<start_time or arrival_time>=end_time then raise exception 'VALIDATION';end if;
 booking_clock:=moment;
 if p_input->>'appointmentId' is not null then
  select * into a from public.appointments where organization_id=p_org and id=(p_input->>'appointmentId')::uuid and request_id=r.id for update;
  if a.id is null or a.status<>'proposal' or a.expires_at<=moment or a.revision is distinct from (p_input->>'appointmentRevision')::integer then raise exception 'STALE_REVISION';end if;
  if a.start_at<>start_time or a.end_at<>end_time or a.arrival_at<>arrival_time then raise exception 'EVIDENCE_MISMATCH';end if;
  booking_clock:=a.created_at;
 end if;
 select array_agg(x::uuid order by x::uuid) into resources from jsonb_array_elements_text(p_input->'resources') x;
 if resources is null or cardinality(resources) not between 1 and 30 or cardinality(resources)<>(select count(distinct x) from unnest(resources) x) or array_position(resources,null) is not null then raise exception 'INVALID_RESOURCES';end if;
 if a.id is not null and resources is distinct from (select array_agg(resource_id order by resource_id) from public.resource_reservations where organization_id=p_org and appointment_id=a.id and active) then raise exception 'EVIDENCE_MISMATCH';end if;
 buffer:=(cfg.settings->'scheduling'->>'bufferMinutes')::integer;before_minutes:=(p_input->>'travelBeforeMinutes')::integer;after_minutes:=(p_input->>'travelAfterMinutes')::integer;
 if (p_provider->>'windowStart')::timestamptz>start_time-make_interval(mins=>buffer+before_minutes) or (p_provider->>'windowEnd')::timestamptz<end_time+make_interval(mins=>buffer+after_minutes) then raise exception 'PROVIDER_FACTS_REQUIRED';end if;
 if buffer is null or buffer not between 0 and 180 or before_minutes is null or before_minutes not between 0 and 360 or after_minutes is null or after_minutes not between 0 and 360 then raise exception 'TRAVEL_REVIEW_REQUIRED';end if;
 if exists(select 1 from public.availability_exceptions where organization_id=p_org and starts_at<end_time+make_interval(mins=>buffer+after_minutes) and ends_at>start_time-make_interval(mins=>buffer+before_minutes)) then raise exception 'OWNER_BLOCK';end if;
 if exists(select 1 from public.quotes q join public.quote_versions v on v.organization_id=q.organization_id and v.quote_id=q.id and v.version=q.current_version where q.organization_id=p_org and q.request_id=r.id
  and (extract(epoch from(end_time-start_time))/60<v.duration_minutes or (q.status='accepted' and extract(epoch from(end_time-start_time))/60<>v.duration_minutes))) then raise exception 'DURATION_REVIEW_REQUIRED';end if;
 foreach rid in array resources loop
  perform 1 from public.resources where organization_id=p_org and id=rid and status='available' for update;if not found then raise exception 'RESOURCE_UNAVAILABLE';end if;
  if exists(select 1 from public.resource_reservations rr join public.appointments aa on aa.organization_id=rr.organization_id and aa.id=rr.appointment_id where rr.organization_id=p_org and rr.resource_id=rid and rr.active and (a.id is null or rr.appointment_id<>a.id)
   and (aa.status not in('held','proposal') or aa.expires_at>moment)
   and lower(rr.during)<end_time+make_interval(mins=>buffer+after_minutes) and upper(rr.during)>start_time-make_interval(mins=>buffer+before_minutes)) then raise exception 'CAPACITY_CONFLICT';end if;
 end loop;
 for item in select value from jsonb_array_elements(p_provider->'busy') loop
  if item->>'start' is null or item->>'end' is null or (item->>'end')::timestamptz<=(item->>'start')::timestamptz then raise exception 'PROVIDER_FACTS_REQUIRED';end if;
  if (item->>'start')::timestamptz<end_time+make_interval(mins=>buffer+after_minutes) and (item->>'end')::timestamptz>start_time-make_interval(mins=>buffer+before_minutes) then raise exception 'GOOGLE_BUSY_CONFLICT';end if;
 end loop;
 insert into private.schedule_evidence(organization_id,request_id,configuration_version,schedule_revision,start_at,end_at,arrival_at,resources,valid_until,scope_reviewed,travel_verified,pickup_verified,google_busy_verified,provider_references)
 values(p_org,r.id,cfg.version,epoch,start_time,end_time,arrival_time,resources,least(moment+interval '60 seconds',(p_provider->>'checkedAt')::timestamptz+interval '60 seconds'),true,true,true,true,
 jsonb_build_object('kind','owner_review','actor',p_actor,'session',p_session,'requestRevision',r.revision,'appointmentId',a.id,'appointmentRevision',a.revision,'connectionRevision',g.revision,'calendarId',g.calendar_id,'bookingClock',booking_clock,'reviewKey',p_key)) returning * into e;
 perform private.assert_schedule_evidence(p_org,r.id,e.id,moment);
 insert into private.scheduling_reviews(organization_id,request_id,actor_id,session_id,input,provider,evidence_id) values(p_org,r.id,p_actor,p_session,p_input,p_provider,e.id);
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,p_actor,'schedule.reviewed',r.id,r.revision,gen_random_uuid());
 result:=jsonb_build_object('evidenceId',e.id,'validUntil',e.valid_until);
 insert into private.command_receipts values(p_org,'SchedulingReview',p_key,fingerprint,result,moment);return result;
end$$;
create function public.record_scheduling_review(p_org uuid,p_actor uuid,p_session uuid,p_key text,p_input jsonb,p_provider jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.record_scheduling_review(p_org,p_actor,p_session,p_key,p_input,p_provider)$$;
revoke all on function private.record_scheduling_review(uuid,uuid,uuid,text,jsonb,jsonb),public.record_scheduling_review(uuid,uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.record_scheduling_review(uuid,uuid,uuid,text,jsonb,jsonb),public.record_scheduling_review(uuid,uuid,uuid,text,jsonb,jsonb) to service_role;

-- Canonical minutes; legacy published configurations remain readable.
create or replace function private.assert_schedule_evidence(p_org uuid,p_request uuid,p_evidence uuid,p_now timestamptz) returns private.schedule_evidence language plpgsql security definer set search_path='' as $$
declare e private.schedule_evidence; cfg public.configuration_versions; rules jsonb; local_start timestamp; local_end timestamp; rid uuid; count_resources integer; booking_clock timestamptz:=p_now;
begin
 select * into e from private.schedule_evidence where organization_id=p_org and id=p_evidence and request_id=p_request;
 select * into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 if e.id is null or cfg.version is null or e.valid_until<=p_now or e.configuration_version<>cfg.version or e.schedule_revision is distinct from (select revision from private.schedule_state where organization_id=p_org)
 or not e.scope_reviewed or not e.travel_verified or not e.pickup_verified or not e.google_busy_verified then raise exception 'FEASIBILITY_REVIEW_REQUIRED';end if;
 if e.provider_references->>'kind'='owner_review' then
  if (e.provider_references->>'requestRevision')::integer is distinct from (select revision from public.service_requests where organization_id=p_org and id=p_request)
   or (e.provider_references->>'connectionRevision')::integer is distinct from (select revision from private.google_accounts where organization_id=p_org)
   or not exists(select 1 from auth.sessions s join public.memberships m on m.user_id=s.user_id and m.organization_id=p_org where s.id=(e.provider_references->>'session')::uuid and s.user_id=(e.provider_references->>'actor')::uuid and s.aal='aal2' and (s.not_after is null or s.not_after>p_now) and m.revoked_at is null and m.role in('owner','admin')) then raise exception 'STALE_REVISION';end if;
  if e.provider_references->>'appointmentId' is not null then
   select created_at into booking_clock from public.appointments where organization_id=p_org and id=(e.provider_references->>'appointmentId')::uuid and request_id=p_request and status='proposal' and revision=(e.provider_references->>'appointmentRevision')::integer and expires_at>p_now;
   if not found then raise exception 'STALE_REVISION';end if;
  end if;
 end if;
 rules:=cfg.settings->'scheduling';
 if rules is null or rules->>'bufferMinutes' is null or rules->>'leadMinutes' is null or (rules->>'horizonMinutes' is null and rules->>'horizonDays' is null)
 or rules->>'selectionMinutes' is null or rules->>'proposalMinutes' is null or rules->>'pendingLimit' is null
 or rules->>'earliestStart' is null or rules->>'latestStart' is null or rules->>'endOfDay' is null
 or jsonb_typeof(rules->'weekdays') is distinct from 'array' or cfg.settings->>'timezone' is null then raise exception 'SETUP_REQUIRED';end if;
 if (rules->>'selectionMinutes')::integer<=0 or (rules->>'proposalMinutes')::integer<=0 or (rules->>'pendingLimit')::integer<=0
 or (rules->>'bufferMinutes')::integer<0 or (rules->>'leadMinutes')::integer<0 or coalesce((rules->>'horizonMinutes')::integer,(rules->>'horizonDays')::integer*1440)<=(rules->>'leadMinutes')::integer
 or (rules->>'earliestStart')::integer<0 or (rules->>'latestStart')::integer<(rules->>'earliestStart')::integer
 or (rules->>'endOfDay')::integer>(24*60) or (rules->>'endOfDay')::integer<=(rules->>'latestStart')::integer
 or jsonb_array_length(rules->'weekdays')=0 then raise exception 'SETUP_REQUIRED';end if;
 if e.start_at<booking_clock+make_interval(mins=>(rules->>'leadMinutes')::integer) or e.start_at>booking_clock+make_interval(mins=>coalesce((rules->>'horizonMinutes')::integer,(rules->>'horizonDays')::integer*1440)) then raise exception 'OUTSIDE_BOOKING_WINDOW';end if;
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

-- One canonical transaction takes a reviewed selection through hold + submitted proposal,
-- or confirms the existing proposal. The receipt resolves a commit followed by an HTTP timeout.
create function private.commit_reviewed_schedule(p_org uuid,p_input jsonb,p_key text,p_evidence uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior private.command_receipts;fingerprint text;review private.scheduling_reviews;result jsonb;held jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or length(p_key) not between 16 and 128 or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_input,auth.uid())::text,'UTF8')),'hex');
 insert into private.schedule_state(organization_id) values(p_org) on conflict do nothing;
 perform 1 from private.schedule_state where organization_id=p_org for update;
 select * into prior from private.command_receipts where organization_id=p_org and command='ReviewedSchedule' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if p_evidence is null then return null;end if;
 select * into review from private.scheduling_reviews where organization_id=p_org and evidence_id=p_evidence and actor_id=auth.uid();
 if not found or review.input->'commandInput' is distinct from p_input then raise exception 'REVIEW_REQUIRED';end if;
 if p_input->>'appointmentId' is null then
  held:=private.scheduling_command(p_org,'hold',jsonb_build_object('requestId',p_input->>'requestId','evidenceId',p_evidence,'replacesId',p_input->>'replacesId'),encode(sha256(convert_to(p_key||':hold','UTF8')),'hex'));
  result:=private.scheduling_command(p_org,'submit',jsonb_build_object('id',held->>'id','revision',(held->>'revision')::integer),encode(sha256(convert_to(p_key||':submit','UTF8')),'hex'));
 else
  result:=private.scheduling_command(p_org,'approve',jsonb_build_object('id',p_input->>'appointmentId','revision',(p_input->>'appointmentRevision')::integer,'evidenceId',p_evidence),encode(sha256(convert_to(p_key||':approve','UTF8')),'hex'));
 end if;
 insert into private.command_receipts values(p_org,'ReviewedSchedule',p_key,fingerprint,result,clock_timestamp());
 return result;
end$$;
create function public.commit_reviewed_schedule(p_org uuid,p_input jsonb,p_key text,p_evidence uuid) returns jsonb language sql security invoker set search_path='' as $$select private.commit_reviewed_schedule(p_org,p_input,p_key,p_evidence)$$;
revoke all on function private.commit_reviewed_schedule(uuid,jsonb,text,uuid),public.commit_reviewed_schedule(uuid,jsonb,text,uuid) from public,anon,service_role;
grant execute on function private.commit_reviewed_schedule(uuid,jsonb,text,uuid),public.commit_reviewed_schedule(uuid,jsonb,text,uuid) to authenticated;

create function private.attach_approved_job() returns trigger language plpgsql security definer set search_path='' as $$
declare job public.jobs;request uuid;
begin
 if tg_table_name='jobs' then
  select request_id into request from public.quotes where organization_id=new.organization_id and id=new.quote_id;
  update public.appointments set job_id=new.id where organization_id=new.organization_id and request_id=request and status in('held','proposal','reserved','needs_review') and job_id is null;
 else
  if new.job_id is null then
   select j.* into job from public.jobs j join public.quotes q on q.organization_id=j.organization_id and q.id=j.quote_id where j.organization_id=new.organization_id and q.request_id=new.request_id and q.status='accepted';
   new.job_id:=job.id;
  end if;
 end if;
 return new;
end$$;
create trigger attach_job_to_appointment before insert or update of status on public.appointments for each row execute function private.attach_approved_job();
create trigger attach_appointments_to_job after insert on public.jobs for each row execute function private.attach_approved_job();
revoke all on function private.attach_approved_job() from public,anon,authenticated,service_role;
