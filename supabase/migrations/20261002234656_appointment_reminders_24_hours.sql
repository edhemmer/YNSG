-- Latest owner instruction supersedes the previous reminder timing.
do $$declare definition text;signature regprocedure;changed integer:=0;begin
 for signature in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='scheduling_command' loop
  definition:=pg_get_functiondef(signature);
  if strpos(definition,'48 hours')>0 then execute replace(definition,'48 hours','24 hours');changed:=changed+1;end if;
 end loop;
 if changed<>1 then raise exception 'REMINDER_IMPLEMENTATION_NOT_FOUND';end if;
end$$;
-- Re-time unsent reminders only; never edit accepted notices or resurrect canceled visits.
update public.outbox o set next_attempt_at=a.arrival_at-interval '24 hours'
from public.appointments a where o.organization_id=a.organization_id and o.object_id=a.id
and o.kind='appointment.reminder' and o.status in ('pending','failed') and a.status='reserved'
and a.arrival_at>now() and (o.payload->>'appointmentRevision')::integer=a.revision;
