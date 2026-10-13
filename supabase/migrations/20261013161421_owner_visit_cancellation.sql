-- Cancel one confirmed visit without deleting its request, work or money history.
create function private.cancel_owner_appointment(p_org uuid,p_id uuid,p_revision integer,p_reason text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.appointments;other public.appointments;prior private.command_receipts;fingerprint text;result jsonb;reason text:=trim(p_reason);
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='scheduling' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_key is null or length(p_key) not between 16 and 128 or p_revision is null or p_revision<1 or reason is null or length(reason) not between 2 and 1000 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_id,p_revision,reason)::text,'UTF8')),'hex');
 insert into private.schedule_state(organization_id) values(p_org) on conflict do nothing;
 perform 1 from private.schedule_state where organization_id=p_org for update;
 select * into prior from private.command_receipts where organization_id=p_org and command='CancelOwnerAppointment' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into a from public.appointments where organization_id=p_org and id=p_id for update;
 if not found or a.request_id is null then raise exception 'TRANSITION';end if;
 if a.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 if a.status not in ('reserved','needs_review') or a.end_at<=clock_timestamp() then raise exception 'TRANSITION';end if;
 perform 1 from public.service_requests where organization_id=p_org and id=a.request_id for update;
 perform j.id from public.jobs j join public.quotes q on q.organization_id=j.organization_id and q.id=j.quote_id where j.organization_id=p_org and q.request_id=a.request_id for update of j;
 if exists(select 1 from public.jobs j join public.quotes q on q.organization_id=j.organization_id and q.id=j.quote_id where j.organization_id=p_org and q.request_id=a.request_id and j.status in ('working','paused','completed')) then raise exception 'WORK_STARTED';end if;
 -- A pending replacement cannot later approve against the canceled original.
 for other in select * from public.appointments where organization_id=p_org and replaces_id=a.id and status in ('held','proposal') for update loop
  update public.appointments set status='canceled',expires_at=null,revision=revision+1 where organization_id=p_org and id=other.id;
  update public.outbox set status=case when status='sending' then 'needs_reconciliation' else 'suppressed' end where organization_id=p_org and object_id=other.id and status in ('pending','failed','leased','sending');
  update public.appointment_tasks set state='superseded' where organization_id=p_org and appointment_id=other.id and state='pending';
  insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,'appointment:'||other.id||':'||(other.revision+1)||':calendar','calendar.remove',other.id,jsonb_build_object('appointmentRevision',other.revision+1,'status','canceled'));
 end loop;
 update public.appointments set status='canceled',expires_at=null,revision=revision+1 where organization_id=p_org and id=a.id returning * into a;
 -- Existing triggers release reservations, revoke old links and supersede preferences.
 update public.outbox set status=case when status='sending' then 'needs_reconciliation' else 'suppressed' end where organization_id=p_org and object_id=a.id and status in ('pending','failed','leased','sending');
 update public.appointment_tasks set state='superseded' where organization_id=p_org and appointment_id=a.id and state='pending';
 update private.schedule_state set revision=revision+1 where organization_id=p_org;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'appointment.canceled',a.id,a.revision,gen_random_uuid());
 insert into public.outbox(organization_id,event_key,kind,object_id,payload) values
  (p_org,'appointment:'||a.id||':'||a.revision||':canceled','appointment.canceled',a.id,jsonb_build_object('appointmentRevision',a.revision,'reason',reason)),
  (p_org,'appointment:'||a.id||':'||a.revision||':calendar','calendar.remove',a.id,jsonb_build_object('appointmentRevision',a.revision,'status','canceled'));
 result:=jsonb_build_object('id',a.id,'revision',a.revision,'status',a.status,'requestRetained',true,'customerEmail','pending');
 insert into private.command_receipts values(p_org,'CancelOwnerAppointment',p_key,fingerprint,result,clock_timestamp());return result;
end$$;
create function public.cancel_owner_appointment(p_org uuid,p_id uuid,p_revision integer,p_reason text,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.cancel_owner_appointment(p_org,p_id,p_revision,p_reason,p_key)$$;
revoke all on function private.cancel_owner_appointment(uuid,uuid,integer,text,text),public.cancel_owner_appointment(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function private.cancel_owner_appointment(uuid,uuid,integer,text,text),public.cancel_owner_appointment(uuid,uuid,integer,text,text) to authenticated;

-- Reuse current dispatch guards and leases; a canceled visit has no active action link.
do $migration$
declare d text;sig text;old text;
begin
 d:=pg_get_functiondef('private.appointment_notice_current(uuid,uuid)'::regprocedure);
 old:='when ''appointment.reschedule_requested'' then';
 if strpos(d,old)=0 then raise exception 'appointment notice baseline changed';end if;
 execute replace(d,old,'when ''appointment.canceled'' then a.status=''canceled'' '||old);
 foreach sig in array array['private.claim_mail_company()','private.claim_outbox(uuid,integer)'] loop
  d:=pg_get_functiondef(sig::regprocedure);old:='''appointment.declined_service''';
  if strpos(d,old)=0 then raise exception 'mail claim baseline changed';end if;
  execute replace(d,old,old||',''appointment.canceled''');
 end loop;
end $migration$;
