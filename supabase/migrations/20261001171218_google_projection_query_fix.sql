do $$declare definition text;begin
 definition:=pg_get_functiondef('private.google_store(uuid,text,jsonb)'::regprocedure);
 definition:=replace(definition,'select appointment_id,state,reason,checked_at from private.google_projections where organization_id=p_org order by checked_at desc nulls last limit 50','select g.appointment_id,g.state,g.reason,g.checked_at from private.google_projections g where g.organization_id=p_org order by g.checked_at desc nulls last limit 50');
 execute definition;
end$$;
