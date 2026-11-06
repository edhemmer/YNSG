-- Optional "How did you hear about us?" answer on public service requests.
-- Owner-facing marketing evidence only: it never affects pricing, eligibility or scheduling.
-- Patches the live intake function body with guarded replacements (same pattern as ZIP intake),
-- so every existing identity, security, rate-limit, service and audit check stays intact.
do $migration$
declare d text; old text; sig regprocedure := 'public.submit_service_request(uuid,text,text,jsonb)'::regprocedure;
begin
 d:=pg_get_functiondef(sig);
 old:='''preferredTime'',''website''))';
 if strpos(d,old)=0 then raise exception 'INTAKE_LEAD_SOURCE_KEYS_CHANGED';end if;
 d:=replace(d,old,'''preferredTime'',''website'',''leadSource''))');
 old:='v_description := coalesce(p_data->>''description'','''');';
 if strpos(d,old)=0 then raise exception 'INTAKE_LEAD_SOURCE_VALIDATION_CHANGED';end if;
 d:=replace(d,old,$guard$if p_data ? 'leadSource' and p_data->>'leadSource' not in ('Google search or Maps','Facebook','Nextdoor','Friend, family or neighbor','Realtor or property manager','Saw our truck, sign or uniform','Flyer, card or door hanger','Returning customer','Other') then raise exception 'VALIDATION';end if;
 v_description := coalesce(p_data->>'description','');$guard$);
 execute d;
end $migration$;
