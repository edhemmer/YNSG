-- Owner-confirmed weekly agreements; CRM remains capacity authority.
create table private.recurring_series(
 organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(),
 request_id uuid not null,first_appointment_id uuid not null,status text not null default 'active' check(status in('active','stopped')),
 revision integer not null default 1,timezone text not null,first_date date not null,end_exclusive date not null,
 scope text not null,labor_cents integer not null,duration_minutes integer not null,agreement text not null,
 actor_id uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),stop_reason text,
 primary key(organization_id,id),foreign key(organization_id,request_id) references public.service_requests(organization_id,id),
 foreign key(organization_id,first_appointment_id) references public.appointments(organization_id,id)
);
create unique index one_active_recurring_series on private.recurring_series(organization_id,first_appointment_id) where status='active';
alter table public.service_requests add column recurring_series_id uuid;
alter table public.service_requests add foreign key(organization_id,recurring_series_id) references private.recurring_series(organization_id,id);
create index requests_recurring_series on public.service_requests(organization_id,recurring_series_id) where recurring_series_id is not null;
create table private.recurring_occurrences(
 organization_id uuid not null,series_id uuid not null,request_id uuid not null,job_id uuid not null,appointment_id uuid not null,appointment_revision integer not null,planned_date date not null,before_minutes integer not null default 0,after_minutes integer not null default 0,
 primary key(organization_id,series_id,planned_date),unique(organization_id,series_id,job_id),
 foreign key(organization_id,series_id) references private.recurring_series(organization_id,id),
 foreign key(organization_id,request_id) references public.service_requests(organization_id,id),
 foreign key(organization_id,job_id) references public.jobs(organization_id,id),
 foreign key(organization_id,appointment_id) references public.appointments(organization_id,id)
);
create index recurring_occurrence_request on private.recurring_occurrences(organization_id,request_id);
create index recurring_occurrence_appointment on private.recurring_occurrences(organization_id,appointment_id);
create table private.recurring_reviews(
 organization_id uuid not null,id uuid not null default gen_random_uuid(),actor_id uuid not null,session_id uuid not null,
 input jsonb not null,context jsonb not null,facts jsonb not null,checked_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,id)
);
do $$declare t text;begin foreach t in array array['recurring_series','recurring_occurrences','recurring_reviews'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 execute format('create policy %I on private.%I to anon,authenticated using(false) with check(false)',t||'_deny',t);
end loop;end$$;

-- Reviewed extra travel persists through individual reschedules and applies to future bookings.
create function private.recurring_padded_window(p_org uuid,p_appointment uuid,p_window tstzrange) returns tstzrange language sql stable security definer set search_path='' as $$
 select tstzrange(lower(p_window)-make_interval(mins=>coalesce(max(m.before_minutes),0)),upper(p_window)+make_interval(mins=>coalesce(max(m.after_minutes),0)),'[)')
 from public.appointments a left join private.recurring_occurrences m on m.organization_id=a.organization_id and m.job_id=a.job_id where a.organization_id=p_org and a.id=p_appointment
$$;
revoke all on function private.recurring_padded_window(uuid,uuid,tstzrange) from public,anon,authenticated,service_role;
create function private.recurring_replacement_window(p_org uuid,p_appointment uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.appointments;w tstzrange;begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into a from public.appointments where organization_id=p_org and id=p_appointment and status='reserved';if not found then raise exception 'ORIGINAL_UNAVAILABLE';end if;
 w:=private.recurring_padded_window(p_org,a.id,tstzrange(a.start_at,a.end_at,'[)'));return jsonb_build_object('start',lower(w),'end',upper(w));
end$$;
create function public.recurring_replacement_window(p_org uuid,p_appointment uuid) returns jsonb language sql security invoker set search_path='' as $$select private.recurring_replacement_window(p_org,p_appointment)$$;
revoke all on function private.recurring_replacement_window(uuid,uuid),public.recurring_replacement_window(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.recurring_replacement_window(uuid,uuid),public.recurring_replacement_window(uuid,uuid) to authenticated;
create function private.recurring_capacity_snapshot(p_org uuid,p_resources uuid[],p_begin timestamptz,p_finish timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare n integer;begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_begin is null or p_finish is null or p_finish<=p_begin or p_finish>p_begin+interval '370 days' or cardinality(p_resources) not between 1 and 30 then raise exception 'VALIDATION';end if;
 select count(*) into n from public.resource_reservations r join public.appointments a on a.organization_id=r.organization_id and a.id=r.appointment_id where r.organization_id=p_org and r.resource_id=any(p_resources) and r.active and a.start_at<p_finish+interval '6 hours' and a.end_at>p_begin-interval '6 hours';if n>10000 then raise exception 'REVIEW_REQUIRED';end if;
 if (select count(*) from public.availability_exceptions where organization_id=p_org and starts_at<p_finish and ends_at>p_begin)>10000 then raise exception 'REVIEW_REQUIRED';end if;
 return jsonb_build_object('reservations',coalesce((select jsonb_agg(jsonb_build_object('resourceId',r.resource_id,'start',lower(private.recurring_padded_window(p_org,r.appointment_id,r.during)),'end',upper(private.recurring_padded_window(p_org,r.appointment_id,r.during)))) from public.resource_reservations r join public.appointments a on a.organization_id=r.organization_id and a.id=r.appointment_id where r.organization_id=p_org and r.resource_id=any(p_resources) and r.active and (a.status not in('held','proposal') or a.expires_at>clock_timestamp()) and a.start_at<p_finish+interval '6 hours' and a.end_at>p_begin-interval '6 hours'),'[]'::jsonb),
 'blocks',coalesce((select jsonb_agg(jsonb_build_object('start',starts_at,'end',ends_at)) from public.availability_exceptions where organization_id=p_org and starts_at<p_finish and ends_at>p_begin),'[]'::jsonb));
end$$;
create function public.recurring_capacity_snapshot(p_org uuid,p_resources uuid[],p_begin timestamptz,p_finish timestamptz) returns jsonb language sql security invoker set search_path='' as $$select private.recurring_capacity_snapshot(p_org,p_resources,p_begin,p_finish)$$;
revoke all on function private.recurring_capacity_snapshot(uuid,uuid[],timestamptz,timestamptz),public.recurring_capacity_snapshot(uuid,uuid[],timestamptz,timestamptz) from public,anon,authenticated,service_role;
grant execute on function private.recurring_capacity_snapshot(uuid,uuid[],timestamptz,timestamptz),public.recurring_capacity_snapshot(uuid,uuid[],timestamptz,timestamptz) to authenticated;

create function private.recurring_context(p_org uuid,p_first uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.appointments;r public.service_requests;j public.jobs;v public.quote_versions;cfg public.configuration_versions;resource_ids uuid[];begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not private.crm_calendar(p_org) or not exists(select 1 from public.entitlements where organization_id=p_org and module='scheduling' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 select * into a from public.appointments where organization_id=p_org and id=p_first;
 select * into r from public.service_requests where organization_id=p_org and id=a.request_id;
 select * into j from public.jobs where organization_id=p_org and id=a.job_id;
 select * into v from public.quote_versions where organization_id=p_org and quote_id=j.quote_id and version=j.approved_version;
 select * into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 if a.id is null or a.status<>'reserved' or a.start_at<=clock_timestamp() or a.start_at>clock_timestamp()+interval '30 days' or r.id is null or r.status in('declined','canceled') or r.recurring_series_id is not null
 or j.status not in('approved','scheduled','en_route','arrived') or v.quote_id is null or cfg.version is null
 or a.timezone is distinct from cfg.settings->>'timezone' or extract(epoch from(a.end_at-a.arrival_at))/60<v.duration_minutes
 or not exists(select 1 from public.quotes q where q.organization_id=p_org and q.id=j.quote_id and q.request_id=r.id and q.status='accepted') then raise exception 'FIRST_VISIT_REQUIRED';end if;
 if exists(select 1 from public.catalog_services c where c.organization_id=p_org and c.compliance='held' and (c.id=r.service_id or c.id in(select service_id from public.service_request_items where organization_id=p_org and request_id=r.id))) then raise exception 'SERVICE_REVIEW_REQUIRED';end if;
 if exists(select 1 from private.recurring_series where organization_id=p_org and first_appointment_id=a.id and status='active') then raise exception 'SERIES_EXISTS';end if;
 select array_agg(resource_id order by resource_id) into resource_ids from public.resource_reservations where organization_id=p_org and appointment_id=a.id and active;
 if cardinality(resource_ids) is null or not exists(select 1 from public.resources where organization_id=p_org and id=any(resource_ids) and kind='operator' and status='available') or exists(select 1 from public.resources where organization_id=p_org and id=any(resource_ids) and status<>'available') then raise exception 'RESOURCE_UNAVAILABLE';end if;
 return jsonb_build_object('first',jsonb_build_object('id',a.id,'revision',a.revision,'requestId',r.id,'requestRevision',r.revision,'jobId',j.id,'jobRevision',j.revision,'quoteId',j.quote_id,'quoteVersion',j.approved_version,'startAt',a.start_at,'endAt',a.end_at,'arrivalAt',a.arrival_at,'timezone',a.timezone,'scope',v.scope,'laborCents',v.labor_cents,'durationMinutes',v.duration_minutes),
 'configurationVersion',cfg.version,'scheduleRevision',(select revision from private.schedule_state where organization_id=p_org),'scopeFingerprint',private.request_scope_fingerprint(p_org,r.id),'resources',to_jsonb(resource_ids),'settings',cfg.settings);
end$$;
create function public.recurring_context(p_org uuid,p_first uuid) returns jsonb language sql security invoker set search_path='' as $$select private.recurring_context(p_org,p_first)$$;
revoke all on function private.recurring_context(uuid,uuid),public.recurring_context(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.recurring_context(uuid,uuid),public.recurring_context(uuid,uuid) to authenticated;

-- Provider facts originate only from the verified server; clients cannot mint them.
create function private.record_recurring_review(p_org uuid,p_actor uuid,p_session uuid,p_input jsonb,p_context jsonb,p_facts jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare id uuid;begin
 if auth.jwt()->>'role' is distinct from 'service_role' or not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id join public.memberships m on m.user_id=u.id and m.organization_id=p_org
 where s.id=p_session and s.user_id=p_actor and (s.not_after is null or s.not_after>clock_timestamp()) and u.deleted_at is null and not u.is_anonymous and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=clock_timestamp()) and m.revoked_at is null and m.role in('owner','admin')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_facts) is distinct from 'array' or jsonb_array_length(p_facts) not between 51 and 52 or p_input->>'reviewed' is distinct from 'true' or length(coalesce(p_input->>'agreement','')) not between 10 and 1500 then raise exception 'REVIEW_REQUIRED';end if;
 insert into private.recurring_reviews(organization_id,actor_id,session_id,input,context,facts) values(p_org,p_actor,p_session,p_input,p_context,p_facts) returning recurring_reviews.id into id;return id;
end$$;
create function public.record_recurring_review(p_org uuid,p_actor uuid,p_session uuid,p_input jsonb,p_context jsonb,p_facts jsonb) returns uuid language sql security invoker set search_path='' as $$select private.record_recurring_review(p_org,p_actor,p_session,p_input,p_context,p_facts)$$;
revoke all on function private.record_recurring_review(uuid,uuid,uuid,jsonb,jsonb,jsonb),public.record_recurring_review(uuid,uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.record_recurring_review(uuid,uuid,uuid,jsonb,jsonb,jsonb),public.record_recurring_review(uuid,uuid,uuid,jsonb,jsonb,jsonb) to service_role;

create function private.book_recurring_series(p_org uuid,p_input jsonb,p_review uuid,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare prior private.command_receipts;review private.recurring_reviews;ctx jsonb;fingerprint text;result jsonb;a public.appointments;r public.service_requests;j public.jobs;v public.quote_versions;
 series uuid;new_request uuid;new_quote uuid;new_job uuid;new_appointment uuid;resources uuid[];rid uuid;rules jsonb;day date;last_day date;local_start timestamp;local_end timestamp;
 start_time timestamptz;end_time timestamptz;arrival_time timestamptz;before_minutes integer;after_minutes integer;buffer integer;duration interval;offset_time interval;fact jsonb;index integer:=0;n integer:=1;scope_note text;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or length(p_key) not between 16 and 128 or p_input->>'reviewed' is distinct from 'true' or length(coalesce(p_input->>'agreement','')) not between 10 and 1500 then raise exception 'REVIEW_REQUIRED';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_input)::text,'UTF8')),'hex');
 perform 1 from private.schedule_state where organization_id=p_org for update;
 select * into prior from private.command_receipts where organization_id=p_org and command='BookRecurringSeries' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if p_review is null then return null;end if;
 select * into review from private.recurring_reviews where organization_id=p_org and id=p_review and actor_id=auth.uid() and session_id=(auth.jwt()->>'session_id')::uuid;
 if not found or review.input is distinct from p_input or review.checked_at<clock_timestamp()-interval '60 seconds' then raise exception 'REVIEW_REQUIRED';end if;
 perform 1 from public.appointments where organization_id=p_org and id=(p_input->>'firstAppointment')::uuid for update;
 ctx:=private.recurring_context(p_org,(p_input->>'firstAppointment')::uuid);
 if ctx is distinct from review.context then raise exception 'STALE_REVISION';end if;
 perform private.expire_appointments(p_org,clock_timestamp());
 select * into a from public.appointments where organization_id=p_org and id=(ctx->'first'->>'id')::uuid;
 select * into r from public.service_requests where organization_id=p_org and id=a.request_id for update;
 select * into j from public.jobs where organization_id=p_org and id=a.job_id for update;
 if private.recurring_context(p_org,a.id) is distinct from review.context then raise exception 'STALE_REVISION';end if;
 select * into v from public.quote_versions where organization_id=p_org and quote_id=j.quote_id and version=j.approved_version;
 select array_agg(x::uuid order by x::uuid) into resources from jsonb_array_elements_text(ctx->'resources') x;
 foreach rid in array resources loop perform 1 from public.resources where organization_id=p_org and id=rid and status='available' for update;if not found then raise exception 'RESOURCE_UNAVAILABLE';end if;end loop;
 rules:=ctx->'settings'->'scheduling';buffer:=(rules->>'bufferMinutes')::integer;
 if buffer is null or buffer<0 or buffer>180 then raise exception 'SETUP_REQUIRED';end if;
 day:=(a.start_at at time zone a.timezone)::date;last_day:=(day+interval '12 months')::date;duration:=a.end_at-a.start_at;offset_time:=a.arrival_at-a.start_at;
 series:=gen_random_uuid();
 insert into private.recurring_series(organization_id,id,request_id,first_appointment_id,timezone,first_date,end_exclusive,scope,labor_cents,duration_minutes,agreement,actor_id)
 values(p_org,series,r.id,a.id,a.timezone,day,last_day,v.scope,v.labor_cents,v.duration_minutes,p_input->>'agreement',auth.uid());
 insert into private.recurring_occurrences values(p_org,series,r.id,j.id,a.id,a.revision,day,0,0);
 day:=day+7;
 while day<last_day loop
  local_start:=day+(a.start_at at time zone a.timezone)::time;start_time:=local_start at time zone a.timezone;end_time:=start_time+duration;arrival_time:=start_time+offset_time;local_end:=end_time at time zone a.timezone;
  if start_time at time zone a.timezone is distinct from local_start then raise exception 'OUTSIDE_OPERATING_HOURS';end if;
  fact:=review.facts->index;
  if fact is null or (fact->>'start')::timestamptz is distinct from start_time or (fact->>'end')::timestamptz is distinct from end_time or fact->>'status' is distinct from 'verified' then raise exception 'REVIEW_REQUIRED';end if;
  before_minutes:=(fact->>'before')::integer;after_minutes:=(fact->>'after')::integer;
  if before_minutes is null or after_minutes is null or before_minutes not between 0 and 360 or after_minutes not between 0 and 360 then raise exception 'REVIEW_REQUIRED';end if;
  if not exists(select 1 from jsonb_array_elements_text(rules->'weekdays') d where d::int=extract(isodow from local_start)::int) or extract(hour from local_start)*60+extract(minute from local_start)<(rules->>'earliestStart')::int or extract(hour from local_start)*60+extract(minute from local_start)>(rules->>'latestStart')::int or local_end::date<>day or extract(hour from local_end)*60+extract(minute from local_end)>(rules->>'endOfDay')::int then raise exception 'OUTSIDE_OPERATING_HOURS';end if;
  if exists(select 1 from public.availability_exceptions where organization_id=p_org and starts_at<end_time+make_interval(mins=>buffer+after_minutes) and ends_at>start_time-make_interval(mins=>buffer+before_minutes)) then raise exception 'OWNER_BLOCK';end if;
  if exists(select 1 from public.resource_reservations rr join public.appointments other on other.organization_id=rr.organization_id and other.id=rr.appointment_id where rr.organization_id=p_org and rr.active and rr.resource_id=any(resources)
   and not(other.status in('held','proposal') and other.expires_at<=clock_timestamp()) and private.recurring_padded_window(p_org,rr.appointment_id,rr.during) && tstzrange(start_time-make_interval(mins=>buffer+before_minutes),end_time+make_interval(mins=>buffer+after_minutes),'[)')) then raise exception 'CAPACITY_CONFLICT';end if;
  new_request:=gen_random_uuid();new_quote:=gen_random_uuid();
  insert into public.service_requests(organization_id,id,customer_id,property_id,service_id,original_submission,form_version,privacy_version,status,recurring_series_id)
   values(p_org,new_request,r.customer_id,r.property_id,r.service_id,r.original_submission||jsonb_build_object('preferredTime',to_char(arrival_time at time zone a.timezone,'YYYY-MM-DD HH24:MI')||' '||a.timezone||' — confirmed weekly visit','recurringVisit',true),r.form_version,r.privacy_version,'quoted',series);
  insert into public.service_request_items(organization_id,request_id,position,service_id,task) select organization_id,new_request,position,service_id,task from public.service_request_items where organization_id=p_org and request_id=r.id;
  insert into public.quotes(organization_id,id,request_id,customer_id) values(p_org,new_quote,new_request,j.customer_id);
  insert into public.quote_versions(organization_id,quote_id,version,scope,labor_cents,duration_minutes,snapshot) values(p_org,new_quote,1,v.scope,v.labor_cents,v.duration_minutes,v.snapshot||jsonb_build_object('recurringAgreement',jsonb_build_object('series',series,'sourceQuote',v.quote_id,'sourceVersion',v.version,'plannedDate',day)));
  new_job:=(private.approve_quote(p_org,new_quote,1,'Weekly agreement recorded: '||(p_input->>'agreement'))->>'id')::uuid;
  insert into public.appointments(organization_id,job_id,request_id,start_at,end_at,arrival_at,timezone,status,created_by,customer_response,response_revision)
   values(p_org,new_job,new_request,start_time,end_time,arrival_time,a.timezone,'reserved',auth.uid(),'confirmed',1) returning id into new_appointment;
  foreach rid in array resources loop insert into public.resource_reservations(organization_id,appointment_id,resource_id,during,active) values(p_org,new_appointment,rid,tstzrange(start_time,end_time,'[)'),true);end loop;
  insert into private.recurring_occurrences values(p_org,series,new_request,new_job,new_appointment,1,day,before_minutes,after_minutes);
  -- Individual visits keep reminders and optional calendar projections, not 52 immediate confirmations.
  insert into public.outbox(organization_id,event_key,kind,object_id,payload,next_attempt_at) values
   (p_org,'appointment:'||new_appointment||':1:reminder','appointment.reminder',new_appointment,jsonb_build_object('appointmentRevision',1,'arrivalAt',arrival_time),arrival_time-interval '24 hours'),
   (p_org,'appointment:'||new_appointment||':1:owner-reminder','appointment.owner_reminder',new_appointment,jsonb_build_object('appointmentRevision',1,'arrivalAt',arrival_time),arrival_time-interval '24 hours'),
   (p_org,'appointment:'||new_appointment||':1:calendar','calendar.upsert',new_appointment,jsonb_build_object('appointmentRevision',1,'status','reserved'),clock_timestamp());
  index:=index+1;n:=n+1;day:=day+7;
 end loop;
 if index<>jsonb_array_length(review.facts) then raise exception 'REVIEW_REQUIRED';end if;
 update private.schedule_state set revision=revision+1 where organization_id=p_org;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'recurring.booked',series,1,gen_random_uuid());
 insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,'recurring:'||series||':1:confirmation','recurring.confirmation',series,jsonb_build_object('seriesRevision',1));
 result:=jsonb_build_object('id',series,'revision',1,'status','active','visits',n,'newVisits',n-1,'firstVisitRetained',true,'customerEmail','pending');
 insert into private.command_receipts values(p_org,'BookRecurringSeries',p_key,fingerprint,result,clock_timestamp());return result;
end$$;
create function public.book_recurring_series(p_org uuid,p_input jsonb,p_review uuid,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.book_recurring_series(p_org,p_input,p_review,p_key)$$;
revoke all on function private.book_recurring_series(uuid,jsonb,uuid,text),public.book_recurring_series(uuid,jsonb,uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.book_recurring_series(uuid,jsonb,uuid,text),public.book_recurring_series(uuid,jsonb,uuid,text) to authenticated;

create function private.stop_recurring_series(p_org uuid,p_id uuid,p_revision int,p_reason text,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.recurring_series;prior private.command_receipts;visit public.appointments;fingerprint text;result jsonb;n int:=0;begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if length(coalesce(p_reason,'')) not between 2 and 1000 or length(coalesce(p_key,'')) not between 16 and 128 then raise exception 'VALIDATION';end if;
 perform 1 from private.schedule_state where organization_id=p_org for update;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_id,p_revision,p_reason)::text,'UTF8')),'hex');
 select * into prior from private.command_receipts where organization_id=p_org and command='StopRecurringSeries' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into s from private.recurring_series where organization_id=p_org and id=p_id for update;
 if s.id is null or s.status<>'active' or s.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 for visit in select a.* from public.appointments a join private.recurring_occurrences m on m.organization_id=a.organization_id and m.job_id=a.job_id join public.jobs j on j.organization_id=a.organization_id and j.id=a.job_id
  where m.organization_id=p_org and m.series_id=p_id and m.appointment_id<>s.first_appointment_id and a.status in('reserved','needs_review') and a.end_at>clock_timestamp() and (a.start_at>clock_timestamp() or j.status not in('working','paused','completed')) order by a.start_at,a.id for update of a loop
  perform private.cancel_owner_appointment(p_org,visit.id,visit.revision,p_reason,encode(sha256(convert_to(p_key||visit.id::text,'UTF8')),'hex'));
  update public.outbox set status='suppressed' where organization_id=p_org and object_id=visit.id and kind='appointment.canceled' and status in('pending','failed','leased');
  update public.jobs set status='canceled',revision=revision+1 where organization_id=p_org and id=visit.job_id and status in('approved','scheduled','en_route','arrived');
  update public.service_requests set status='canceled',revision=revision+1 where organization_id=p_org and id=visit.request_id and recurring_series_id=p_id;
  n:=n+1;
 end loop;
 update public.outbox set status=case when status='sending' then 'needs_reconciliation' else 'suppressed' end where organization_id=p_org and object_id=p_id and kind='recurring.confirmation' and status in('pending','failed','leased','sending');
 update private.recurring_series set status='stopped',revision=revision+1,stop_reason=p_reason where organization_id=p_org and id=p_id returning * into s;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'recurring.stopped',p_id,s.revision,gen_random_uuid());
 if n>0 then insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,'recurring:'||p_id||':'||s.revision||':stopped','recurring.stopped',p_id,jsonb_build_object('seriesRevision',s.revision,'visitsCanceled',n));end if;
 result:=jsonb_build_object('id',p_id,'revision',s.revision,'status','stopped','visitsCanceled',n,'firstVisitRetained',true);
 insert into private.command_receipts values(p_org,'StopRecurringSeries',p_key,fingerprint,result,clock_timestamp());return result;
end$$;
create function public.stop_recurring_series(p_org uuid,p_id uuid,p_revision int,p_reason text,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.stop_recurring_series(p_org,p_id,p_revision,p_reason,p_key)$$;
revoke all on function private.stop_recurring_series(uuid,uuid,int,text,text),public.stop_recurring_series(uuid,uuid,int,text,text) from public,anon,authenticated,service_role;
grant execute on function private.stop_recurring_series(uuid,uuid,int,text,text),public.stop_recurring_series(uuid,uuid,int,text,text) to authenticated;

create function private.recurring_workspace(p_org uuid,p_request uuid default null,p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status,'requestId',s.request_id,'name',r.original_submission->>'name','timezone',s.timezone,'firstDate',s.first_date,'endExclusive',s.end_exclusive,'scope',s.scope,'laborCents',s.labor_cents,'durationMinutes',s.duration_minutes,'visits',
  (select jsonb_agg(jsonb_build_object('requestId',m.request_id,'plannedDate',m.planned_date,'startAt',coalesce(a.start_at,old.start_at),'endAt',coalesce(a.end_at,old.end_at),'status',coalesce(a.status,old.status),'jobStatus',j.status) order by m.planned_date) from private.recurring_occurrences m join public.jobs j on j.organization_id=m.organization_id and j.id=m.job_id join public.appointments old on old.organization_id=m.organization_id and old.id=m.appointment_id
   left join public.appointments a on a.organization_id=m.organization_id and a.job_id=m.job_id and a.status='reserved' where m.organization_id=p_org and m.series_id=s.id)) order by s.created_at desc)
 from (select s.* from private.recurring_series s where s.organization_id=p_org and (p_request is null or s.request_id=p_request or exists(select 1 from private.recurring_occurrences where organization_id=p_org and series_id=s.id and request_id=p_request)) order by s.created_at desc,s.id limit 21 offset greatest(0,least(p_page,100000))*20) s join public.service_requests r on r.organization_id=s.organization_id and r.id=s.request_id),'[]'::jsonb);
end$$;
create function public.recurring_workspace(p_org uuid,p_request uuid default null,p_page integer default 0) returns jsonb language sql security invoker set search_path='' as $$select private.recurring_workspace(p_org,p_request,p_page)$$;
revoke all on function private.recurring_workspace(uuid,uuid,integer),public.recurring_workspace(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function private.recurring_workspace(uuid,uuid,integer),public.recurring_workspace(uuid,uuid,integer) to authenticated;

create function private.recurring_notice_current(p_org uuid,p_outbox uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outbox o join private.recurring_series s on s.organization_id=o.organization_id and s.id=o.object_id
 where o.organization_id=p_org and o.id=p_outbox and (o.payload->>'seriesRevision')::int=s.revision and ((o.kind='recurring.confirmation' and s.status='active' and not exists(select 1 from private.recurring_occurrences m join public.appointments a on a.organization_id=m.organization_id and a.id=m.appointment_id where m.organization_id=s.organization_id and m.series_id=s.id and (a.status<>'reserved' or a.revision<>m.appointment_revision))) or(o.kind='recurring.stopped' and s.status='stopped')))
$$;
revoke all on function private.recurring_notice_current(uuid,uuid) from public,anon,authenticated,service_role;
create function private.recurring_notice_data(p_org uuid,p_outbox uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.mail_dispatch_actor(p_org) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not private.recurring_notice_current(p_org,p_outbox) then return null;end if;
 return (select jsonb_build_object('status',s.status,'name',r.original_submission->>'name','recipient',r.original_submission->>'email','timezone',s.timezone,'firstAt',a.arrival_at,'lastAt',(select max(old.arrival_at) from private.recurring_occurrences m join public.appointments old on old.organization_id=m.organization_id and old.id=m.appointment_id where m.organization_id=p_org and m.series_id=s.id),'visits',(select count(*) from private.recurring_occurrences where organization_id=p_org and series_id=s.id),'scope',s.scope,'laborCents',s.labor_cents,'reason',s.stop_reason,'visitsCanceled',o.payload->'visitsCanceled') from public.outbox o join private.recurring_series s on s.organization_id=o.organization_id and s.id=o.object_id join public.service_requests r on r.organization_id=s.organization_id and r.id=s.request_id join public.appointments a on a.organization_id=s.organization_id and a.id=s.first_appointment_id where o.organization_id=p_org and o.id=p_outbox);
end$$;
create function public.recurring_notice_data(p_org uuid,p_outbox uuid) returns jsonb language sql security invoker set search_path='' as $$select private.recurring_notice_data(p_org,p_outbox)$$;
revoke all on function private.recurring_notice_data(uuid,uuid),public.recurring_notice_data(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.recurring_notice_data(uuid,uuid),public.recurring_notice_data(uuid,uuid) to authenticated,service_role;

do $$declare d text;old text;begin
 d:=pg_get_functiondef('private.claim_outbox(uuid,integer)'::regprocedure);
 old:='x.kind in(';if strpos(d,old)=0 then raise exception 'mail selector baseline changed';end if;
 d:=replace(d,old,'x.kind in(''recurring.confirmation'',''recurring.stopped'',');
 old:='o.kind like ''appointment.%'' and not private.appointment_notice_current(p_org,o.id)';if strpos(d,old)=0 then raise exception 'mail suppression baseline changed';end if;
 execute replace(d,old,'(o.kind like ''recurring.%'' and not private.recurring_notice_current(p_org,o.id)) or ('||old||')');
 d:=pg_get_functiondef('private.claim_mail_company()'::regprocedure);old:='o.kind in(';if strpos(d,old)=0 then raise exception 'worker selector baseline changed';end if;execute replace(d,old,'o.kind in(''recurring.confirmation'',''recurring.stopped'',');
 d:=pg_get_functiondef('private.begin_delivery(uuid,uuid,uuid)'::regprocedure);old:='o.kind like ''appointment.%'' and not private.appointment_notice_current(p_org,p_id)';if strpos(d,old)=0 then raise exception 'mail begin baseline changed';end if;execute replace(d,old,'(o.kind like ''recurring.%'' and not private.recurring_notice_current(p_org,p_id)) or ('||old||')');
end$$;

-- A year of reserved repeats is not a year of actionable work today.
do $$declare d text;old text;begin
 d:=pg_get_functiondef('private.job_schedule_readiness(uuid)'::regprocedure);
 old:='from public.jobs j where j.organization_id=p_org';
 if strpos(d,old)=0 then raise exception 'work readiness baseline changed';end if;
 execute replace(d,old,'from public.jobs j join public.quotes q on q.organization_id=j.organization_id and q.id=j.quote_id join public.service_requests r on r.organization_id=q.organization_id and r.id=q.request_id where (r.recurring_series_id is null or not exists(select 1 from public.appointments a where a.organization_id=j.organization_id and a.job_id=j.id and a.status=''reserved'') or exists(select 1 from public.appointments a where a.organization_id=j.organization_id and a.job_id=j.id and a.status=''reserved'' and a.start_at<clock_timestamp()+interval ''7 days'')) and j.organization_id=p_org');
end$$;

-- All reservation previews and mutation checks use the persisted repeat buffers.
do $$declare d text;sig regprocedure;begin
 foreach sig in array array['private.record_scheduling_review(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure,'private.website_slot_hold(uuid,text,uuid,text,text,text,timestamptz,jsonb)'::regprocedure] loop
  d:=pg_get_functiondef(sig);if strpos(d,'lower(rr.during)')=0 or strpos(d,'upper(rr.during)')=0 then raise exception 'capacity baseline changed: %',sig;end if;
  d:=replace(d,'lower(rr.during)','lower(private.recurring_padded_window(p_org,rr.appointment_id,rr.during))');d:=replace(d,'upper(rr.during)','upper(private.recurring_padded_window(p_org,rr.appointment_id,rr.during))');execute d;
 end loop;
 d:=pg_get_functiondef('private.website_reserved_times(uuid,uuid,timestamptz,timestamptz)'::regprocedure);
 if strpos(d,'select rr.during from')=0 or strpos(d,'rr.during &&')=0 then raise exception 'website preview baseline changed';end if;
 d:=replace(d,'select rr.during from','select private.recurring_padded_window(p_org,rr.appointment_id,rr.during) from');execute replace(d,'rr.during &&','private.recurring_padded_window(p_org,rr.appointment_id,rr.during) &&');
 d:=pg_get_functiondef('private.scheduling_snapshot(uuid)'::regprocedure);if strpos(d,'lower(r.during)')=0 or strpos(d,'r.during &&')=0 then raise exception 'owner preview baseline changed';end if;
 d:=replace(d,'lower(r.during)','lower(private.recurring_padded_window(p_org,r.appointment_id,r.during))');d:=replace(d,'upper(r.during)','upper(private.recurring_padded_window(p_org,r.appointment_id,r.during))');execute replace(d,'r.during &&','private.recurring_padded_window(p_org,r.appointment_id,r.during) &&');
end$$;
