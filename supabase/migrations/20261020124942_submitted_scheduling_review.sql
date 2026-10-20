-- Opening scheduling is read-only. Review a newly submitted lead using the same
-- verified facts, permissions and exact revision as any other scheduling review.
do $migration$
declare definition text;signature regprocedure;needle text;
begin
 foreach signature in array array[
  'private.scheduling_review_context(uuid,uuid,uuid)'::regprocedure,
  'private.record_scheduling_review(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure
 ] loop
  definition:=pg_get_functiondef(signature);
  needle:='(''reviewing'',''quoted'')';
  if strpos(definition,needle)=0 then raise exception 'scheduling status baseline changed';end if;
  execute replace(definition,needle,'(''submitted'',''reviewing'',''quoted'')');
 end loop;
 definition:=pg_get_functiondef('private.scheduling_command(uuid,text,jsonb,text)'::regprocedure);
 needle:='   update public.appointments set status=''reserved'',expires_at=null,revision=revision+1 where organization_id=p_org and id=a.id returning * into a;';
 if strpos(definition,needle)=0 then raise exception 'appointment approval baseline changed';end if;
 execute replace(definition,needle,needle||$replacement$
   -- This transition rolls back with booking on any failure and occurs once on replay.
   update public.service_requests set status='reviewing',revision=revision+1 where organization_id=p_org and id=a.request_id and status='submitted';
$replacement$);
end $migration$;
