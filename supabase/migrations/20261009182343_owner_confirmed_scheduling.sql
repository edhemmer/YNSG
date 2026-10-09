-- The owner's scheduling confirmation reviews this request, not every future job
-- in its service category. Held services remain blocked; global approvals are unchanged.
create function private.request_scope_fingerprint(p_org uuid,p_request uuid) returns text
language sql stable security definer set search_path='' as $$
 select encode(sha256(convert_to(jsonb_build_array(r.original_submission,
  (select jsonb_agg(jsonb_build_array(c.id,c.scope,c.exclusions,c.compliance) order by c.id)
   from public.catalog_services c where c.organization_id=p_org and (c.id=r.service_id or c.id in
    (select service_id from public.service_request_items where organization_id=p_org and request_id=p_request)))
 )::text,'UTF8')),'hex') from public.service_requests r where r.organization_id=p_org and r.id=p_request
$$;
create function private.request_scope_reviewed(p_org uuid,p_request uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.scheduling_reviews s where s.organization_id=p_org and s.request_id=p_request
  and s.input->>'scopeReviewed'='true' and s.input->>'scopeFingerprint'=private.request_scope_fingerprint(p_org,p_request))
$$;
revoke all on function private.request_scope_fingerprint(uuid,uuid),private.request_scope_reviewed(uuid,uuid) from public,anon,authenticated,service_role;

do $$declare d text;old text;new text;begin
 d:=pg_get_functiondef('private.record_scheduling_review(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure);
 old:=' if not exists(select 1 from public.catalog_services where organization_id=p_org and id=r.service_id and compliance=''approved'') or exists(select 1 from public.service_request_items i join public.catalog_services c on c.organization_id=i.organization_id and c.id=i.service_id where i.organization_id=p_org and i.request_id=r.id and c.compliance<>''approved'') then raise exception ''SERVICE_REVIEW_REQUIRED'';end if;';
 new:=' if not exists(select 1 from public.catalog_services where organization_id=p_org and id=r.service_id and compliance in (''approved'',''review'')) or exists(select 1 from public.service_request_items i join public.catalog_services c on c.organization_id=i.organization_id and c.id=i.service_id where i.organization_id=p_org and i.request_id=r.id and c.compliance=''held'') then raise exception ''SERVICE_REVIEW_REQUIRED'';end if;';
 if strpos(d,old)=0 then raise exception 'scope review baseline changed';end if;
 d:=replace(d,old,new);
 old:='insert into private.scheduling_reviews(organization_id,request_id,actor_id,session_id,input,provider,evidence_id) values(p_org,r.id,p_actor,p_session,p_input,p_provider,e.id);';
 new:='insert into private.scheduling_reviews(organization_id,request_id,actor_id,session_id,input,provider,evidence_id) values(p_org,r.id,p_actor,p_session,p_input||jsonb_build_object(''scopeFingerprint'',private.request_scope_fingerprint(p_org,r.id)),p_provider,e.id);';
 if strpos(d,old)=0 then raise exception 'scope provenance baseline changed';end if;execute replace(d,old,new);

 -- Explicit hourly quote publication can use this request's saved scope review.
 -- A starting/quote category does not silently commit a price: owner still supplies
 -- the written scope, duration and rate-program review to PublishQuote.
 d:=pg_get_functiondef('private.publish_hourly_quote(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text)'::regprocedure);
 old:=' if not exists(select 1 from public.catalog_services where organization_id=p_org and id=r.service_id and compliance=''approved'' and pricing_mode=''hourly'') or exists(select 1 from public.service_request_items i join public.catalog_services c on c.organization_id=i.organization_id and c.id=i.service_id where i.organization_id=p_org and i.request_id=r.id and (c.compliance<>''approved'' or c.pricing_mode<>''hourly'')) then raise exception ''SERVICE_REVIEW_REQUIRED'';end if;';
 new:=' if not private.request_scope_reviewed(p_org,r.id) and (not exists(select 1 from public.catalog_services where organization_id=p_org and id=r.service_id and compliance=''approved'' and pricing_mode=''hourly'') or exists(select 1 from public.service_request_items i join public.catalog_services c on c.organization_id=i.organization_id and c.id=i.service_id where i.organization_id=p_org and i.request_id=r.id and (c.compliance<>''approved'' or c.pricing_mode<>''hourly''))) then raise exception ''SERVICE_REVIEW_REQUIRED'';end if;';
 if strpos(d,old)=0 then raise exception 'quote scope baseline changed';end if;execute replace(d,old,new);
end$$;

-- One transaction, one provider check, one replayable command. No abandoned
-- owner-created proposal and no second HTTP approval request.
create function private.commit_confirmed_schedule(p_org uuid,p_input jsonb,p_key text,p_evidence uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior private.command_receipts;fingerprint text;review private.scheduling_reviews;e private.schedule_evidence;
 held jsonb;proposal jsonb;result jsonb;confirmation_evidence uuid;epoch bigint;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or length(p_key) not between 16 and 128 or jsonb_typeof(p_input) is distinct from 'object' or p_input->>'confirmImmediately' is distinct from 'true' or p_input->>'appointmentId' is not null then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_input,auth.uid())::text,'UTF8')),'hex');
 insert into private.schedule_state(organization_id) values(p_org) on conflict do nothing;
 perform 1 from private.schedule_state where organization_id=p_org for update;
 select * into prior from private.command_receipts where organization_id=p_org and command='ConfirmedSchedule' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if p_evidence is null then return null;end if;
 select * into review from private.scheduling_reviews where organization_id=p_org and evidence_id=p_evidence and actor_id=auth.uid();
 if not found or review.input->'commandInput' is distinct from p_input then raise exception 'REVIEW_REQUIRED';end if;
 e:=private.assert_schedule_evidence(p_org,(p_input->>'requestId')::uuid,p_evidence,clock_timestamp());
 held:=private.scheduling_command(p_org,'hold',jsonb_build_object('requestId',p_input->>'requestId','evidenceId',p_evidence,'replacesId',p_input->>'replacesId'),encode(sha256(convert_to(p_key||':hold','UTF8')),'hex'));
 proposal:=private.scheduling_command(p_org,'submit',jsonb_build_object('id',held->>'id','revision',(held->>'revision')::integer),encode(sha256(convert_to(p_key||':submit','UTF8')),'hex'));
 select revision into epoch from private.schedule_state where organization_id=p_org;
 -- Carry the same unexpired, server-verified facts into approval of the exact
 -- visit created above. This row is private and cannot be minted by the browser.
 insert into private.schedule_evidence(organization_id,request_id,configuration_version,schedule_revision,start_at,end_at,arrival_at,resources,valid_until,scope_reviewed,travel_verified,pickup_verified,google_busy_verified,provider_references)
 values(p_org,e.request_id,e.configuration_version,epoch,e.start_at,e.end_at,e.arrival_at,e.resources,e.valid_until,e.scope_reviewed,e.travel_verified,e.pickup_verified,e.google_busy_verified,
 e.provider_references||jsonb_build_object('appointmentId',proposal->>'id','appointmentRevision',(proposal->>'revision')::integer,'sourceEvidenceId',e.id)) returning id into confirmation_evidence;
 result:=private.scheduling_command(p_org,'approve',jsonb_build_object('id',proposal->>'id','revision',(proposal->>'revision')::integer,'evidenceId',confirmation_evidence),encode(sha256(convert_to(p_key||':approve','UTF8')),'hex'));
 update public.outbox set status='suppressed',lease_token=null,lease_until=null where organization_id=p_org and object_id=(result->>'id')::uuid and status in('pending','failed') and (payload->>'appointmentRevision')::integer<(result->>'revision')::integer;
 insert into private.command_receipts values(p_org,'ConfirmedSchedule',p_key,fingerprint,result,clock_timestamp());
 return result;
end$$;
create function public.commit_confirmed_schedule(p_org uuid,p_input jsonb,p_key text,p_evidence uuid) returns jsonb language sql security invoker set search_path='' as $$select private.commit_confirmed_schedule(p_org,p_input,p_key,p_evidence)$$;
revoke all on function private.commit_confirmed_schedule(uuid,jsonb,text,uuid),public.commit_confirmed_schedule(uuid,jsonb,text,uuid) from public,anon,service_role;
grant execute on function private.commit_confirmed_schedule(uuid,jsonb,text,uuid),public.commit_confirmed_schedule(uuid,jsonb,text,uuid) to authenticated;

-- Owner receives the actual booked time, not another approval request.
do $$declare d text;old text;begin
 d:=pg_get_functiondef('private.scheduling_command(uuid,text,jsonb,text)'::regprocedure);
 old:='   insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,''appointment:''||a.id||'':''||a.revision||'':confirmation'',''appointment.confirmation'',a.id,jsonb_build_object(''appointmentRevision'',a.revision,''arrivalAt'',a.arrival_at));';
 if strpos(d,old)=0 then raise exception 'confirmation notice baseline changed';end if;
 execute replace(d,old,old||chr(10)||'   insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,''appointment:''||a.id||'':''||a.revision||'':owner-confirmation'',''appointment.owner_confirmation'',a.id,jsonb_build_object(''appointmentRevision'',a.revision,''arrivalAt'',a.arrival_at));');
 d:=pg_get_functiondef('private.appointment_notice_current(uuid,uuid)'::regprocedure);
 old:='when ''appointment.owner_reminder'' then';
 if strpos(d,old)=0 then raise exception 'notice baseline changed';end if;
 execute replace(d,old,'when ''appointment.owner_confirmation'' then a.status=''reserved'' and a.arrival_at>clock_timestamp()'||chr(10)||' '||old);
 d:=pg_get_functiondef('private.claim_mail_company()'::regprocedure);
 if strpos(d,'''appointment.owner_reminder''')=0 then raise exception 'selector baseline changed';end if;
 execute replace(d,'''appointment.owner_reminder''','''appointment.owner_confirmation'',''appointment.owner_reminder''');
 d:=pg_get_functiondef('private.claim_outbox(uuid,integer)'::regprocedure);
 if strpos(d,'''appointment.owner_reminder''')=0 then raise exception 'mail lease baseline changed';end if;
 execute replace(d,'''appointment.owner_reminder''','''appointment.owner_confirmation'',''appointment.owner_reminder''');
end$$;

create function private.appointment_delivery_status(p_org uuid,p_appointment uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.appointments;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into a from public.appointments where organization_id=p_org and id=p_appointment;
 if not found then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('appointmentStatus',a.status,'revision',a.revision,
 'calendar',coalesce((select case when revision=a.revision then state else 'pending' end from private.google_projections where organization_id=p_org and appointment_id=a.id),'pending'),
 'customerEmail',coalesce((select status from public.outbox where organization_id=p_org and object_id=a.id and kind='appointment.confirmation' and (payload->>'appointmentRevision')::integer=a.revision),'not_queued'),
 'ownerEmail',coalesce((select status from public.outbox where organization_id=p_org and object_id=a.id and kind='appointment.owner_confirmation' and (payload->>'appointmentRevision')::integer=a.revision),'not_queued'));
end$$;
create function public.appointment_delivery_status(p_org uuid,p_appointment uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.appointment_delivery_status(p_org,p_appointment)$$;
revoke all on function private.appointment_delivery_status(uuid,uuid),public.appointment_delivery_status(uuid,uuid) from public,anon,service_role;
grant execute on function private.appointment_delivery_status(uuid,uuid),public.appointment_delivery_status(uuid,uuid) to authenticated;
