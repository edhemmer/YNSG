-- Preserve current authorization/provider guards while extending canonical decisions.
create function private.request_notice_current(p_org uuid,p_id uuid) returns boolean
language sql security invoker set search_path='' as $$
 select exists(select 1 from public.outbox o join public.service_requests r on r.organization_id=o.organization_id and r.id=o.object_id
 where o.organization_id=p_org and o.id=p_id and o.kind='request.declined'
 and r.status='declined' and r.revision=(o.payload->>'requestRevision')::integer
 and r.original_submission->>'email'=o.payload->>'recipient')
$$;
revoke all on function private.request_notice_current(uuid,uuid) from public,anon,authenticated,service_role;

do $migration$
declare d text; old text; replacement text;
begin
 d:=pg_get_functiondef('private.review_service_request(uuid,uuid,integer,text,text)'::regprocedure);
 old:=' select * into r from public.service_requests where organization_id=p_org and id=p_id for update;';
 replacement:=' insert into private.schedule_state(organization_id) values(p_org) on conflict do nothing;
 perform 1 from private.schedule_state where organization_id=p_org for update;
'||old;
 if strpos(d,old)=0 then raise exception 'review lock baseline changed';end if;
 d:=replace(d,old,replacement);
 old:=' update public.service_requests set status=p_status,revision=revision+1 where organization_id=p_org and id=p_id;';
 replacement:=' if p_status in (''declined'',''canceled'') and exists(select 1 from public.appointments where organization_id=p_org and request_id=p_id and (status in (''reserved'',''needs_review'') or (status in (''held'',''proposal'') and expires_at>clock_timestamp()))) then raise exception ''APPOINTMENT_DECISION_REQUIRED'';end if;
'||old||'
 if p_status=''declined'' then
  insert into public.outbox(organization_id,event_key,kind,object_id,payload)
  values(p_org,''request:''||p_id||'':''||(r.revision+1)||'':declined'',''request.declined'',p_id,jsonb_build_object(''requestRevision'',r.revision+1,''recipient'',r.original_submission->>''email''));
 end if;';
 if strpos(d,old)=0 then raise exception 'review transition baseline changed';end if;
 execute replace(d,old,replacement);

 d:=pg_get_functiondef('private.scheduling_command(uuid,text,jsonb,text)'::regprocedure);
 old:='    insert into public.outbox(organization_id,event_key,kind,object_id,payload,next_attempt_at) values(p_org,''appointment:''||a.id||'':''||a.revision||'':reminder'',''appointment.reminder'',a.id,jsonb_build_object(''appointmentRevision'',a.revision,''arrivalAt'',a.arrival_at),a.arrival_at-interval ''24 hours'');';
 replacement:=old||'
    insert into public.outbox(organization_id,event_key,kind,object_id,payload,next_attempt_at) values(p_org,''appointment:''||a.id||'':''||a.revision||'':owner-reminder'',''appointment.owner_reminder'',a.id,jsonb_build_object(''appointmentRevision'',a.revision,''arrivalAt'',a.arrival_at),a.arrival_at-interval ''24 hours'');';
 if strpos(d,old)=0 then raise exception 'reminder timing baseline changed';end if;
 execute replace(d,old,replacement);

 d:=pg_get_functiondef('private.appointment_notice_current(uuid,uuid)'::regprocedure);
 old:='when ''appointment.reminder'' then';
 if strpos(d,old)=0 then raise exception 'notice predicate baseline changed';end if;
 execute replace(d,old,'when ''appointment.owner_reminder'' then a.status=''reserved'' and a.arrival_at>clock_timestamp()
 '||old);

 -- Both worker selection and leasing must recognize the additional intents.
 d:=pg_get_functiondef('private.claim_mail_company()'::regprocedure);
 if strpos(d,'''request.owner_notification''')=0 then raise exception 'company selector baseline changed';end if;
 execute replace(d,'''request.owner_notification''','''request.declined'',''appointment.owner_reminder'',''request.owner_notification''');
 d:=pg_get_functiondef('private.claim_outbox(uuid,integer)'::regprocedure);
 if strpos(d,'''request.owner_notification''')=0 or strpos(d,'o.kind like ''appointment.%'' and')=0 then raise exception 'lease baseline changed';end if;
 d:=replace(d,'''request.owner_notification''','''request.declined'',''appointment.owner_reminder'',''request.owner_notification''');
 d:=replace(d,'o.kind like ''appointment.%'' and o.status in(''pending'',''failed'',''leased'') and not private.appointment_notice_current(p_org,o.id)',
 'o.status in(''pending'',''failed'',''leased'') and ((o.kind like ''appointment.%'' and not private.appointment_notice_current(p_org,o.id)) or (o.kind=''request.declined'' and not private.request_notice_current(p_org,o.id)))');
 execute d;
 d:=pg_get_functiondef('private.begin_delivery(uuid,uuid,uuid)'::regprocedure);
 old:='o.kind like ''appointment.%'' and not private.appointment_notice_current(p_org,p_id)';
 if strpos(d,old)=0 then raise exception 'dispatch predicate baseline changed';end if;
 execute replace(d,old,'((o.kind like ''appointment.%'' and not private.appointment_notice_current(p_org,p_id)) or (o.kind=''request.declined'' and not private.request_notice_current(p_org,p_id)))');
end $migration$;

-- Future confirmed appointments get one owner reminder. No overdue retroactive sends.
insert into public.outbox(organization_id,event_key,kind,object_id,payload,next_attempt_at)
select a.organization_id,'appointment:'||a.id||':'||a.revision||':owner-reminder','appointment.owner_reminder',a.id,
 jsonb_build_object('appointmentRevision',a.revision,'arrivalAt',a.arrival_at),a.arrival_at-interval '24 hours'
from public.appointments a where a.status='reserved' and a.arrival_at-interval '24 hours'>clock_timestamp()
on conflict (organization_id,event_key) do nothing;
