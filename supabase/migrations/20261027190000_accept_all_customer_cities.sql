-- City and travel distance never determine whether a genuine request can be saved.
-- Keep all existing identity, security, rate-limit, service and audit checks intact.
do $$
declare body text; sig regprocedure := 'public.submit_service_request(uuid,text,text,jsonb)'::regprocedure;
old_guard text := 'if not exists(select 1 from jsonb_array_elements_text(v_config->''cities'') city where city=p_data->>''city'') then raise exception ''VALIDATION''; end if;';
begin
 body:=pg_get_functiondef(sig);
 if strpos(body,old_guard)=0 then raise exception 'OPEN_CITY_INTAKE_BASELINE_CHANGED'; end if;
 body:=replace(body,old_guard,'-- Any supplied city is eligible for intake; service radius is advisory to the owner.');
 execute body;
end $$;
