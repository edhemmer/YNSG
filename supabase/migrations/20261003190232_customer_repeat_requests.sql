-- Verified customer repeat intake reuses the validated atomic guest intake implementation.
create function private.customer_intake_context(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.live_identity(false) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.customer_access a where a.organization_id=p_org and a.user_id=auth.uid() and private.customer_allowed(p_org,a.customer_id,false,true)) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return jsonb_build_object(
 'contacts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'customer_id',c.customer_id,'name',c.name,'email',c.email,'phone',c.phone) order by c.name,c.id) from public.contacts c join auth.users u on u.id=auth.uid() where c.organization_id=p_org and private.customer_allowed(p_org,c.customer_id,false,true) and lower(trim(c.email))=lower(trim(u.email))),'[]'),
 'properties',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'customer_id',p.customer_id,'street',p.street,'city',p.city,'region',p.region) order by p.street,p.id) from public.properties p where p.organization_id=p_org and private.customer_allowed(p_org,p.customer_id,false,true)),'[]'),
 'services',coalesce((select jsonb_agg(jsonb_build_object('name',name,'scope',scope) order by name) from public.catalog_services where organization_id=p_org and compliance<>'held'),'[]'));
end$$;
create function public.customer_intake_context(p_org uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.customer_intake_context(p_org)$$;
revoke all on function private.customer_intake_context(uuid),public.customer_intake_context(uuid) from public,anon,authenticated,service_role;
grant execute on function private.customer_intake_context(uuid),public.customer_intake_context(uuid) to authenticated;

do $migration$declare d text;old_guard text:=$guard$if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;$guard$;begin
 d:=pg_get_functiondef('public.submit_service_request(uuid,text,text,jsonb)'::regprocedure);
 if strpos(d,old_guard)=0 or strpos(d,'organization_id,service_id,original_submission,privacy_version')=0 then raise exception 'INTAKE_BASELINE_CHANGED';end if;
 d:=replace(d,'public.submit_service_request(p_org uuid, p_key text, p_client_hash text, p_data jsonb)','private.submit_customer_request(p_org uuid, p_contact uuid, p_property uuid, p_key text, p_input jsonb)');
 d:=replace(d,'v_fingerprint text;', 'p_data jsonb; p_client_hash text; saved_contact public.contacts; saved_property public.properties; v_fingerprint text;');
 d:=replace(d,old_guard,$guard$
 if not private.live_identity(false) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into saved_property from public.properties where organization_id=p_org and id=p_property;
 if not found or not private.customer_allowed(p_org,saved_property.customer_id,false,true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select c.* into saved_contact from public.contacts c join auth.users u on u.id=auth.uid() where c.organization_id=p_org and c.id=p_contact and c.customer_id=saved_property.customer_id and lower(trim(c.email))=lower(trim(u.email));
 if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('services','description','preferredTime','communityRate')) then raise exception 'VALIDATION';end if;
 p_data:=p_input||jsonb_build_object('name',saved_contact.name,'email',saved_contact.email,'phone',saved_contact.phone,'street',saved_property.street,'city',saved_property.city,'website','');
 p_client_hash:=encode(sha256(convert_to(auth.uid()::text,'UTF8')),'hex');
 $guard$);
 d:=replace(d,$find$encode(sha256(convert_to(p_data::text,'UTF8')),'hex')$find$,$replacement$encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_contact,p_property,p_input)::text,'UTF8')),'hex')$replacement$);
 d:=replace(d,':intake:',':customer-intake:');
 d:=replace(d,'name=v_primary;', 'name=v_primary and compliance<>''held'';');
 d:=replace(d,'name=v_items->0->>''service'';', 'name=v_items->0->>''service'' and compliance<>''held'';');
 d:=replace(d,'''SubmitRequest''','''SubmitCustomerRequest''');
 d:=replace(d,'organization_id,service_id,original_submission,privacy_version','organization_id,customer_id,property_id,service_id,original_submission,privacy_version');
 d:=replace(d,'values(p_org,v_service,p_data,v_config','values(p_org,saved_property.customer_id,p_property,v_service,p_data,v_config');
 d:=replace(d,'organization_id,action,object_id,object_revision,correlation_id','organization_id,actor_id,action,object_id,object_revision,correlation_id');
 d:=replace(d,'values(p_org,''request.submitted''','values(p_org,auth.uid(),''request.submitted''');
 if strpos(d,'CREATE OR REPLACE FUNCTION private.submit_customer_request')=0 then raise exception 'INTAKE_SIGNATURE_CHANGED';end if;
 execute d;
end $migration$;
create function public.submit_customer_request(p_org uuid,p_contact uuid,p_property uuid,p_key text,p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.submit_customer_request(p_org,p_contact,p_property,p_key,p_input)$$;
revoke all on function private.submit_customer_request(uuid,uuid,uuid,text,jsonb),public.submit_customer_request(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.submit_customer_request(uuid,uuid,uuid,text,jsonb),public.submit_customer_request(uuid,uuid,uuid,text,jsonb) to authenticated;
