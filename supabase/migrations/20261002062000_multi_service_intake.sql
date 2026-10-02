-- Preserve multiple selected services under one authoritative request.
create table public.service_request_items (
  organization_id uuid not null,
  request_id uuid not null,
  position integer not null check (position between 1 and 15),
  service_id uuid not null,
  task text not null default '' check (length(task) <= 120),
  primary key (organization_id, request_id, position),
  foreign key (organization_id, request_id) references public.service_requests(organization_id, id) on delete cascade,
  foreign key (organization_id, service_id) references public.catalog_services(organization_id, id)
);
create index service_request_items_service on public.service_request_items(organization_id, service_id);
insert into public.service_request_items (organization_id, request_id, position, service_id, task)
select organization_id, id, 1, service_id, coalesce(original_submission->>'task','')
from public.service_requests;
alter table public.service_request_items enable row level security;
create policy service_request_items_read on public.service_request_items for select to authenticated
using (exists (select 1 from public.service_requests r where r.organization_id=service_request_items.organization_id and r.id=service_request_items.request_id));
revoke all on public.service_request_items from public, anon, authenticated;
grant select on public.service_request_items to authenticated;

create or replace function public.submit_service_request(p_org uuid,p_key text,p_client_hash text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 v_fingerprint text; v_previous private.command_receipts; v_id uuid; v_service uuid;
 v_config jsonb; v_count integer; v_result jsonb; v_items jsonb; v_item jsonb; v_index integer;
 v_description text; v_primary text; v_seen text[] := array[]::text[];
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_key is null or length(p_key) not between 16 and 128 or p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$'
 or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>12000 then raise exception 'VALIDATION'; end if;
 if not exists(select 1 from public.organizations where id=p_org and status in ('setup','active'))
 or not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED'; end if;
 if exists(select 1 from jsonb_each(p_data) x where x.key<>'services' and jsonb_typeof(x.value)<>'string')
 or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('services','service','task','name','phone','email','street','city','description','communityRate','preferredTime','website'))
 or length(coalesce(p_data->>'task',''))>120 or length(coalesce(p_data->>'preferredTime',''))>180
 or not (p_data ?& array['name','phone','email','street','city','communityRate'])
 or length(coalesce(p_data->>'name','')) not between 2 and 120
 or length(coalesce(p_data->>'phone','')) not between 7 and 35
 or length(coalesce(p_data->>'email','')) not between 3 and 254 or p_data->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or length(coalesce(p_data->>'street','')) not between 5 and 200
 or length(coalesce(p_data->>'description',''))>3000
 or p_data->>'communityRate' not in ('Yes','No') or coalesce(p_data->>'website','')<>''
 then raise exception 'VALIDATION'; end if;
 v_description := coalesce(p_data->>'description','');
 if p_data ? 'services' then
   if jsonb_typeof(p_data->'services') <> 'array' or jsonb_array_length(p_data->'services') not between 1 and 15 then raise exception 'VALIDATION'; end if;
   v_items := p_data->'services';
 else
   if coalesce(p_data->>'service','')='' then raise exception 'VALIDATION'; end if;
   v_items := jsonb_build_array(jsonb_build_object('service',p_data->>'service','task',coalesce(p_data->>'task','')));
 end if;
 select settings into v_config from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 if v_config is null or not coalesce((v_config->>'intakeEnabled')::boolean,false) then raise exception 'SETUP_REQUIRED'; end if;
 if not exists(select 1 from jsonb_array_elements_text(v_config->'cities') city where city=p_data->>'city') then raise exception 'VALIDATION'; end if;
 for v_item, v_index in select value, ordinality::integer from jsonb_array_elements(v_items) with ordinality loop
   if jsonb_typeof(v_item)<>'object' or not (v_item ?& array['service','task'])
   or (select count(*) from jsonb_object_keys(v_item))<>2
   or jsonb_typeof(v_item->'service')<>'string' or jsonb_typeof(v_item->'task')<>'string'
   or length(coalesce(v_item->>'task',''))>120 then raise exception 'VALIDATION'; end if;
   v_primary := v_item->>'service';
   if length(v_primary) not between 2 and 80 or (v_primary='Something else' and length(v_description)<10)
   or (v_primary||':'||(v_item->>'task')) = any(v_seen) then raise exception 'VALIDATION'; end if;
   v_seen := array_append(v_seen,v_primary||':'||(v_item->>'task'));
   select id into v_service from public.catalog_services where organization_id=p_org and name=v_primary;
   if v_service is null then raise exception 'VALIDATION'; end if;
 end loop;
 v_fingerprint := encode(sha256(convert_to(p_data::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':intake:'||p_key,0));
 select * into v_previous from private.command_receipts where organization_id=p_org and command='SubmitRequest' and key=p_key;
 if found then
   if v_previous.fingerprint<>v_fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return v_previous.result;
 end if;
 insert into private.intake_throttles(organization_id,client_hash,window_start,count)
 values(p_org,p_client_hash,date_trunc('hour',now()),1)
 on conflict(organization_id,client_hash,window_start) do update set count=private.intake_throttles.count+1 returning count into v_count;
 if v_count>5 then raise exception 'RATE_LIMITED'; end if;
 select id into v_service from public.catalog_services where organization_id=p_org and name=v_items->0->>'service';
 insert into public.service_requests(organization_id,service_id,original_submission,privacy_version)
 values(p_org,v_service,p_data,v_config->>'privacyVersion') returning id into v_id;
 for v_item, v_index in select value, ordinality::integer from jsonb_array_elements(v_items) with ordinality loop
   select id into v_service from public.catalog_services where organization_id=p_org and name=v_item->>'service';
   insert into public.service_request_items(organization_id,request_id,position,service_id,task)
   values(p_org,v_id,v_index,v_service,v_item->>'task');
 end loop;
 insert into public.audit_events(organization_id,action,object_id,object_revision,correlation_id)
 values(p_org,'request.submitted',v_id,1,v_id);
 insert into public.outbox(organization_id,event_key,kind,object_id,payload)
 values(p_org,'request:'||v_id||':owner','request.owner_notification',v_id,
 jsonb_build_object('schemaVersion',1,'subject','Your Neighborhood Service Guy New Request','recipient',v_config->>'notificationRecipient','configurationVersion',
 (select max(version) from public.configuration_versions where organization_id=p_org)));
 v_result:=jsonb_build_object('ok',true,'id',v_id,'notification','pending');
 insert into private.command_receipts values(p_org,'SubmitRequest',p_key,v_fingerprint,v_result,now());
 return v_result;
end $$;
revoke all on function public.submit_service_request(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_service_request(uuid,text,text,jsonb) to service_role;
