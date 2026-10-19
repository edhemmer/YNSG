-- Add ZIP evidence without rewriting historical submissions or changing old retry fingerprints.
-- Optional at the canonical boundary for previously frozen legacy requests; new forms require it.
do $migration$
declare name text; d text; old text;
begin
 foreach name in array array['public.submit_service_request(uuid,text,text,jsonb)','private.submit_customer_request(uuid,uuid,uuid,text,jsonb)'] loop
  d:=pg_get_functiondef(name::regprocedure);
  old:='''email'',''street'',''city'',''description''';
  if strpos(d,old)=0 then raise exception 'INTAKE_POSTAL_BASELINE_CHANGED';end if;
  d:=replace(d,old,'''email'',''street'',''city'',''postalCode'',''description''');
  old:='v_description := coalesce(p_data->>''description'','''');';
  if strpos(d,old)=0 then raise exception 'INTAKE_POSTAL_VALIDATION_CHANGED';end if;
  d:=replace(d,old,$guard$if p_data ? 'postalCode' and (jsonb_typeof(p_data->'postalCode')<>'string' or p_data->>'postalCode' !~ '^[0-9]{5}$') then raise exception 'VALIDATION';end if;
 v_description := coalesce(p_data->>'description','');$guard$);
  if name like 'private.%' then
   old:='''services'',''description'',''preferredTime'',''communityRate''';
   if strpos(d,old)=0 then raise exception 'CUSTOMER_POSTAL_FIELDS_CHANGED';end if;
   d:=replace(d,old,'''services'',''description'',''preferredTime'',''communityRate'',''postalCode''');
   old:='''city'',saved_property.city,''website'','''');';
   if strpos(d,old)=0 then raise exception 'CUSTOMER_POSTAL_BASELINE_CHANGED';end if;
   d:=replace(d,old,$guard$'city',saved_property.city,'website','');
 if p_input ? 'postalCode' and (jsonb_typeof(p_input->'postalCode')<>'string' or p_input->>'postalCode' !~ '^[0-9]{5}$') then raise exception 'VALIDATION';end if;
 if coalesce(nullif(left(saved_property.postal_code,5),''),p_input->>'postalCode','')<>'' then p_data:=p_data||jsonb_build_object('postalCode',coalesce(nullif(left(saved_property.postal_code,5),''),p_input->>'postalCode'));end if;$guard$);
  end if;
  execute d;
 end loop;
end $migration$;
