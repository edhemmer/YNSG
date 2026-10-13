-- Booking is already confirmed in the owner workspace. Keep the customer
-- confirmation and both visit reminders; stop the extra owner booking email.
do $$
declare definition text; redundant text;
begin
 definition:=pg_get_functiondef('private.scheduling_command(uuid,text,jsonb,text)'::regprocedure);
 redundant:='   insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,''appointment:''||a.id||'':''||a.revision||'':owner-confirmation'',''appointment.owner_confirmation'',a.id,jsonb_build_object(''appointmentRevision'',a.revision,''arrivalAt'',a.arrival_at));';
 if strpos(definition,redundant)=0 then raise exception 'Owner confirmation baseline changed';end if;
 execute replace(definition,redundant,'');
end$$;

-- Preserve delivery history and uncertain/in-flight sends. Only messages that
-- have not been sent are retired; never create a replacement notification.
update public.outbox
set status='suppressed',lease_token=null,lease_until=null,
 payload=payload||jsonb_build_object('suppressionReason','owner_booking_shown_in_workspace')
where kind='appointment.owner_confirmation' and status in('pending','failed');
