-- Owner-entered work is not constrained by public acquisition/booking policy.
-- Retained quotes and invoices are unchanged; public booking still uses its policy.
alter table public.quote_versions drop constraint quote_versions_duration_minutes_check;
alter table public.quote_versions add constraint quote_versions_duration_minutes_check check(duration_minutes between 1 and 1440);
do $migration$
declare constraint_name text; d text; old text; replacement text;
begin
 select conname into strict constraint_name from pg_constraint where conrelid='public.appointments'::regclass and contype='c' and pg_get_constraintdef(oid) like '%120%';
 execute format('alter table public.appointments drop constraint %I',constraint_name);
 alter table public.appointments add constraint owner_visit_duration check(extract(epoch from(end_at-start_at)) between 60 and 86400);
 d:=pg_get_functiondef('private.assert_schedule_evidence(uuid,uuid,uuid,timestamptz)'::regprocedure);
 old:=' if e.start_at<booking_clock+';
 if strpos(d,old)=0 then raise exception 'booking policy baseline changed';end if;
 d:=replace(d,old,' if e.provider_references->>''kind'' is distinct from ''owner_review'' then'||chr(10)||old);
 old:='then raise exception ''OUTSIDE_OPERATING_HOURS'';end if;';
 if strpos(d,old)=0 then raise exception 'operating policy baseline changed';end if;
 replacement:=old||E'\n else\n  if e.start_at<p_now-interval ''5 minutes'' or extract(second from e.start_at)<>0 or extract(epoch from(e.end_at-e.start_at)) not between 60 and 86400 or mod(extract(epoch from(e.end_at-e.start_at)),60)<>0 then raise exception ''INVALID_OWNER_VISIT_TIME'';end if;\n end if;';
 execute replace(d,old,replacement);
 -- A start-now owner booking must not expire while the atomic hold/approve runs.
 d:=pg_get_functiondef('private.scheduling_command(uuid,text,jsonb,text)'::regprocedure);
 old:='least(moment+make_interval(mins=>(cfg.settings->''scheduling''->>''selectionMinutes'')::integer),e.start_at)';
 if strpos(d,old)=0 then raise exception 'hold expiry baseline changed';end if;
 d:=replace(d,old,'case when e.provider_references->>''kind''=''owner_review'' then moment+interval ''10 minutes'' else '||old||' end');
 old:='least(moment+make_interval(mins=>(cfg.settings->''scheduling''->>''proposalMinutes'')::integer),start_at)';
 if strpos(d,old)=0 then raise exception 'proposal expiry baseline changed';end if;
 d:=replace(d,old,'greatest(moment+interval ''1 minute'','||old||')');
 execute d;
 -- New owner quotes use actual minutes, without mandatory minimums/rounding.
 d:=pg_get_functiondef('private.publish_hourly_crew_quote(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text,integer)'::regprocedure);
 d:=replace(d,'private.publish_hourly_crew_quote(','private.publish_flexible_quote(');
 d:=replace(d,'p_people integer)','p_people integer, p_rate integer, p_total integer)');
 d:=replace(d,'p_minutes<120 or p_minutes>1440 or p_minutes%30<>0','p_minutes<1 or p_minutes>1440');
 d:=replace(d,'auth.uid(),p_people)','auth.uid(),p_people,p_rate,p_total)');
 d:=replace(d,'''PublishCrewQuote''','''PublishFlexibleQuote''');
 d:=replace(d,'rate:=cents;','rate:=coalesce(p_rate,cents);if rate not between 0 and 999999999 or (p_total is not null and p_total not between 0 and 999999999) then raise exception ''VALIDATION'';end if;cents:=rate;');
 d:=replace(d,'cents:=(((cents::bigint*p_minutes+30)/60)*p_people)::integer;','cents:=coalesce(p_total,(((cents::bigint*p_minutes+30)/60)*p_people)::integer);');
 d:=replace(d,'''per_person_first_minimum''','''per_person_actual''');
 d:=replace(d,'''firstPersonMinimumMinutes'',120','''firstPersonMinimumMinutes'',0');
 d:=replace(d,'''partialExtension'',cfg.settings->''hourly''->''partialExtension''','''partialExtension'',''exact''');
 old:='The first person has a two-hour minimum for this combined visit; additional people are billed for their actual worked time with no separate minimum.';
 if strpos(d,old)=0 then raise exception 'quote terms baseline changed';end if;
 d:=replace(d,old,'This job uses actual minutes with no minimum.');
 d:=replace(d,'if r.status not in (''reviewing'',''quoted'')','if r.status not in (''submitted'',''reviewing'',''quoted'')');
 -- Owner quotes remain deliberate scope review; only held services stay blocked.
 d:=replace(d,'compliance=''approved'' and pricing_mode=''hourly''','compliance in (''approved'',''review'')');
 d:=replace(d,'(c.compliance<>''approved'' or c.pricing_mode<>''hourly'')','c.compliance=''held''');
 d:=replace(d,'cfg.settings->>''region'') returning id into prop','coalesce(nullif(r.original_submission->>''state'',''''),cfg.settings->>''region'')) returning id into prop');
 execute d;
 d:=pg_get_functiondef('private.validate_crew_labor(public.quote_versions,jsonb)'::regprocedure);
 d:=replace(d,'if terms->>''billingBasis''<>''per_person_first_minimum'' or (terms->>''firstPersonMinimumMinutes'')::integer<>120','if terms->>''billingBasis'' not in(''per_person_first_minimum'',''per_person_actual'') or (terms->>''firstPersonMinimumMinutes'')::integer<>(case when terms->>''billingBasis''=''per_person_actual'' then 0 else 120 end)');
 d:=replace(d,'expected:=case when p=1 then greatest(120,actual) else actual end;','expected:=case when p=1 and terms->>''billingBasis''=''per_person_first_minimum'' then greatest(120,actual) else actual end;');
 d:=replace(d,'if p=1 and actual>120','if terms->>''billingBasis''=''per_person_first_minimum'' and p=1 and actual>120');
 execute d;
end $migration$;
create function public.publish_flexible_quote(p_org uuid,p_request uuid,p_revision integer,p_scope text,p_minutes integer,p_community boolean,p_eligibility_reviewed boolean,p_customer uuid,p_key text,p_people integer,p_rate integer,p_total integer) returns jsonb language sql security invoker set search_path='' as $$select private.publish_flexible_quote(p_org,p_request,p_revision,p_scope,p_minutes,p_community,p_eligibility_reviewed,p_customer,p_key,p_people,p_rate,p_total)$$;
revoke all on function private.publish_flexible_quote(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text,integer,integer,integer),public.publish_flexible_quote(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text,integer,integer,integer) from public,anon,service_role;
grant execute on function private.publish_flexible_quote(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text,integer,integer,integer),public.publish_flexible_quote(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text,integer,integer,integer) to authenticated;

-- Completed work can be captured before price agreement. These are actual owner
-- records, not appointments, approvals, invoices, receipts, or sent messages.
create table private.owner_work_records(
 organization_id uuid not null,request_id uuid not null,started_at timestamptz not null,ended_at timestamptz not null,
 description text not null,charged_cents integer,agreement text,job_id uuid,actor_id uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 primary key(organization_id,request_id),foreign key(organization_id,request_id) references public.service_requests(organization_id,id),
 foreign key(organization_id,job_id) references public.jobs(organization_id,id),
 check(ended_at>started_at and ended_at<=started_at+interval '24 hours'),check(length(description) between 10 and 1000),check(charged_cents between 0 and 999999999)
);
alter table private.owner_work_records enable row level security;
revoke all on private.owner_work_records from public,anon,authenticated,service_role;
create index owner_work_actor on private.owner_work_records(actor_id);
create index owner_work_job on private.owner_work_records(organization_id,job_id);
create function private.owner_work_record(p_org uuid,p_request uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return (select to_jsonb(w)-'actor_id'-'organization_id' from private.owner_work_records w where organization_id=p_org and request_id=p_request);
end $$;
create function public.owner_work_record(p_org uuid,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select private.owner_work_record(p_org,p_request)$$;
create function private.record_owner_work(p_org uuid,p_request uuid,p_revision integer,p_start timestamptz,p_end timestamptz,p_description text,p_total integer,p_agreement text,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.service_requests;prior private.command_receipts;fingerprint text;result jsonb;q jsonb;j uuid;v integer;minutes integer;lines jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or length(p_key) not between 16 and 128 or p_revision is null or p_start is null or p_end is null or p_end<=p_start or p_end>clock_timestamp() or p_end>p_start+interval '24 hours' or mod(extract(epoch from(p_end-p_start)),60)<>0 or length(btrim(p_description)) not between 10 and 1000 or p_description is null or (p_total is not null and p_total not between 0 and 999999999) or (p_agreement is not null and (length(btrim(p_agreement)) not between 10 and 2000 or p_total is null)) then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_request,p_revision,p_start,p_end,p_description,p_total,p_agreement)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':record-work:'||p_key,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='RecordOwnerWork' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into r from public.service_requests where organization_id=p_org and id=p_request for update;
 if r.id is null then raise exception 'NOT_FOUND';end if;
 if r.revision<>p_revision then raise exception 'STALE_REVISION';end if;
 if r.status in('declined','canceled') or exists(select 1 from public.quotes q join public.jobs j on j.organization_id=q.organization_id and j.quote_id=q.id where q.organization_id=p_org and q.request_id=p_request) then raise exception 'TRANSITION';end if;
 if exists(select 1 from public.appointments where organization_id=p_org and request_id=p_request and status in('held','proposal','reserved')) then raise exception 'APPOINTMENT_DECISION_REQUIRED';end if;
 minutes:=(extract(epoch from(p_end-p_start))/60)::integer;
 insert into private.owner_work_records(organization_id,request_id,started_at,ended_at,description,charged_cents,agreement,actor_id)
 values(p_org,p_request,p_start,p_end,btrim(p_description),p_total,p_agreement,auth.uid()) on conflict(organization_id,request_id) do update set started_at=excluded.started_at,ended_at=excluded.ended_at,description=excluded.description,charged_cents=excluded.charged_cents,agreement=excluded.agreement,actor_id=excluded.actor_id,updated_at=now();
 if p_agreement is not null then
  q:=private.publish_flexible_quote(p_org,p_request,r.revision,p_description,minutes,false,false,null,md5(p_key||':quote'),1,null,p_total);
  result:=private.approve_quote(p_org,(q->>'id')::uuid,(q->>'version')::integer,p_agreement);j:=(result->>'id')::uuid;
  insert into public.work_sessions(organization_id,job_id,started_at,ended_at,actor_id,note) values(p_org,j,p_start,p_end,auth.uid(),'Actual completed work recorded by owner: '||p_description);
  update public.jobs set status='completed',revision=revision+1 where organization_id=p_org and id=j returning revision into v;
  lines:=jsonb_build_array(jsonb_build_object('description',p_description,'recordedMinutes',minutes,'chargedCents',p_total,'billingBasis','fixed','waiverReason','Owner-recorded agreed charge for actual completed work','crewPerson',1));
  perform private.save_invoice_labor(p_org,j,v,lines,md5(p_key||':labor'));
  update private.owner_work_records set job_id=j where organization_id=p_org and request_id=p_request;
 else
  update public.service_requests set status='reviewing',revision=revision+1 where organization_id=p_org and id=p_request;
 end if;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'work.owner_recorded',p_request,(select revision from public.service_requests where organization_id=p_org and id=p_request),gen_random_uuid());
 result:=jsonb_build_object('id',p_request,'jobId',j,'recorded',true,'requestRevision',(select revision from public.service_requests where organization_id=p_org and id=p_request));
 insert into private.command_receipts values(p_org,'RecordOwnerWork',p_key,fingerprint,result,now());return result;
end $$;
create function public.record_owner_work(p_org uuid,p_request uuid,p_revision integer,p_start timestamptz,p_end timestamptz,p_description text,p_total integer,p_agreement text,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.record_owner_work(p_org,p_request,p_revision,p_start,p_end,p_description,p_total,p_agreement,p_key)$$;
create function private.create_owner_request(p_org uuid,p_input jsonb,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg public.configuration_versions;s public.catalog_services;c uuid;prop uuid;r uuid;prior private.command_receipts;fingerprint text;result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or length(p_key) not between 16 and 128 or jsonb_typeof(p_input) is distinct from 'object' or coalesce(length(btrim(p_input->>'name')),0) not between 2 and 160 or coalesce(length(btrim(p_input->>'street')),0) not between 2 and 200 or coalesce(length(btrim(p_input->>'city')),0) not between 2 and 80 or coalesce(length(btrim(p_input->>'state')),0) not between 2 and 80 or coalesce(length(btrim(p_input->>'description')),0) not between 10 and 1000 or length(coalesce(p_input->>'phone',''))>35 or length(coalesce(p_input->>'email',''))>254 or length(coalesce(p_input->>'postalCode',''))>30 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_input)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':owner-request:'||p_key,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='CreateOwnerRequest' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 select * into s from public.catalog_services where organization_id=p_org and id=(p_input->>'serviceId')::uuid and compliance<>'held';
 if cfg.version is null then raise exception 'SETUP_REQUIRED';end if;if s.id is null then raise exception 'SERVICE_REVIEW_REQUIRED';end if;
 insert into public.customers(organization_id,display_name) values(p_org,btrim(p_input->>'name')) returning id into c;
 insert into public.contacts(organization_id,customer_id,name,email,phone,relationship) values(p_org,c,btrim(p_input->>'name'),nullif(p_input->>'email',''),nullif(p_input->>'phone',''),'owner-entered contact');
 insert into public.properties(organization_id,customer_id,street,city,region,postal_code) values(p_org,c,btrim(p_input->>'street'),btrim(p_input->>'city'),btrim(p_input->>'state'),nullif(p_input->>'postalCode','')) returning id into prop;
 insert into public.service_requests(organization_id,customer_id,property_id,service_id,original_submission,privacy_version,status)
 values(p_org,c,prop,s.id,(p_input-'serviceId')||jsonb_build_object('source','owner','service',s.name,'task',p_input->>'description','services',jsonb_build_array(jsonb_build_object('service',s.name,'task',p_input->>'description'))),coalesce(cfg.settings->>'privacyVersion',cfg.settings->>'policyVersion'),'reviewing') returning id into r;
 insert into public.service_request_items(organization_id,request_id,position,service_id,task) values(p_org,r,1,s.id,left(p_input->>'description',120));
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'request.owner_created',r,1,gen_random_uuid());
 result:=jsonb_build_object('id',r,'revision',1);insert into private.command_receipts values(p_org,'CreateOwnerRequest',p_key,fingerprint,result,now());return result;
end $$;
create function public.create_owner_request(p_org uuid,p_input jsonb,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.create_owner_request(p_org,p_input,p_key)$$;
revoke all on function private.owner_work_record(uuid,uuid),public.owner_work_record(uuid,uuid),private.record_owner_work(uuid,uuid,integer,timestamptz,timestamptz,text,integer,text,text),public.record_owner_work(uuid,uuid,integer,timestamptz,timestamptz,text,integer,text,text),private.create_owner_request(uuid,jsonb,text),public.create_owner_request(uuid,jsonb,text) from public,anon,service_role;
grant execute on function private.owner_work_record(uuid,uuid),public.owner_work_record(uuid,uuid),private.record_owner_work(uuid,uuid,integer,timestamptz,timestamptz,text,integer,text,text),public.record_owner_work(uuid,uuid,integer,timestamptz,timestamptz,text,integer,text,text),private.create_owner_request(uuid,jsonb,text),public.create_owner_request(uuid,jsonb,text) to authenticated;
-- Owner walk-up jobs may have a paper invoice without an email/phone. The
-- separate email-delivery command still requires a valid saved recipient.
do $migration$ declare d text;old text;begin
 d:=pg_get_functiondef('private.freeze_invoice_recipient()'::regprocedure);
 old:=E' or length(trim(coalesce(submission->>''email'','''')))=0\n or length(trim(coalesce(submission->>''phone'','''')))=0';
 if strpos(d,old)=0 then raise exception 'recipient snapshot baseline changed';end if;
 execute replace(d,old,E' or (submission->>''source'' is distinct from ''owner'' and (length(trim(coalesce(submission->>''email'','''')))=0 or length(trim(coalesce(submission->>''phone'','''')))=0))');
end $migration$;
