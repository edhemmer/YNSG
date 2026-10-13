-- Owner day selection checks the whole 30-day booking window, plus two
-- extra days for visit duration and buffers. Permissions stay unchanged.
do $$declare definition text;begin
 definition:=pg_get_functiondef('private.scheduling_snapshot(uuid)'::regprocedure);
 if strpos(definition,'''9 days''')=0 then raise exception 'Scheduling snapshot baseline changed';end if;
 execute replace(definition,'''9 days''','''32 days''');
end$$;
