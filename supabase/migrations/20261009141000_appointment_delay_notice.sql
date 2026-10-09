-- Owner-triggered transactional update; recipient comes exclusively from the order.
create function private.request_delay_notice(p_org uuid,p_appointment uuid,p_revision integer,p_minutes integer,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.appointments; r public.service_requests; prior private.command_receipts; fingerprint text; result jsonb; notice public.outbox; eta timestamptz;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_minutes not between 5 and 60 or p_minutes is null or p_key is null or length(p_key) not between 16 and 128 then raise exception 'INVALID_DELAY';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_appointment,p_revision,p_minutes)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':delay:'||p_appointment::text,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='NotifyDelay' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into a from public.appointments where organization_id=p_org and id=p_appointment for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if a.revision<>p_revision or a.status<>'reserved' then raise exception 'STALE_REVISION';end if;
 if (a.arrival_at at time zone a.timezone)::date<>(clock_timestamp() at time zone a.timezone)::date or a.end_at<=clock_timestamp() then raise exception 'TODAY_ONLY';end if;
 eta:=greatest(a.arrival_at,clock_timestamp())+make_interval(mins=>p_minutes);
 if not private.gmail_delivery_enabled(p_org) then raise exception 'GMAIL_RECEIPT_REQUIRED';end if;
 select * into r from public.service_requests where organization_id=p_org and id=a.request_id;
 if coalesce(r.original_submission->>'email','') !~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$' then raise exception 'CUSTOMER_EMAIL_REQUIRED';end if;
 -- Cooldown also covers separate tabs/keys; a transport retry uses its receipt above.
 if exists(select 1 from public.outbox where organization_id=p_org and object_id=a.id and kind='appointment.delay_notice' and created_at>clock_timestamp()-interval '5 minutes' and status<>'suppressed') then raise exception 'DELAY_ALREADY_QUEUED';end if;
 insert into public.outbox(organization_id,event_key,kind,object_id,payload)
 values(p_org,'appointment:'||a.id||':delay:'||p_key,'appointment.delay_notice',a.id,jsonb_build_object('schemaVersion',1,'appointmentRevision',a.revision,'recipient',r.original_submission->>'email','eta',eta,'minutes',p_minutes)) returning * into notice;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'appointment.delay_notice_requested',a.id,a.revision,gen_random_uuid());
 result:=jsonb_build_object('id',notice.id,'status',notice.status,'eta',eta);
 insert into private.command_receipts values(p_org,'NotifyDelay',p_key,fingerprint,result,now());return result;
end$$;
create function public.request_delay_notice(p_org uuid,p_appointment uuid,p_revision integer,p_minutes integer,p_key text) returns jsonb
language sql security invoker set search_path='' as $$select private.request_delay_notice(p_org,p_appointment,p_revision,p_minutes,p_key)$$;
revoke all on function private.request_delay_notice(uuid,uuid,integer,integer,text),public.request_delay_notice(uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function private.request_delay_notice(uuid,uuid,integer,integer,text),public.request_delay_notice(uuid,uuid,integer,integer,text) to authenticated;
do $$declare d text;name text;old text:=$kind$'request.owner_notification'$kind$;begin
 d:=pg_get_functiondef('private.appointment_notice_current(uuid,uuid)'::regprocedure);
 if strpos(d,'else false end')=0 then raise exception 'notice predicate baseline changed';end if;
 execute replace(d,'else false end',$kind$when 'appointment.delay_notice' then a.status='reserved' and a.end_at>clock_timestamp() and (o.payload->>'eta')::timestamptz>clock_timestamp() and o.created_at>clock_timestamp()-interval '30 minutes' else false end$kind$);
 foreach name in array array['private.claim_mail_company()','private.claim_outbox(uuid,integer)'] loop
  d:=pg_get_functiondef(name::regprocedure);if strpos(d,old)=0 then raise exception 'mail selector baseline changed';end if;
  execute replace(d,old,old||$kind$,'appointment.delay_notice'$kind$);
 end loop;
end$$;
