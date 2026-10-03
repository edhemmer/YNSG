-- Owner-approved equipment only. Exact task matching; no customer or platform grants.
create table private.packing_rules (
 organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(),service_name text not null check(length(service_name) between 2 and 80),
 task_name text not null check(length(task_name)<=120),revision integer not null check(revision>0),items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=40),
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,service_name,task_name),unique(organization_id,id)
);
create table private.packing_rule_versions (
 organization_id uuid not null,service_name text not null,task_name text not null,revision integer not null,items jsonb not null,
 approved_by uuid not null references auth.users(id),approved_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,service_name,task_name,revision),
 foreign key(organization_id,service_name,task_name) references private.packing_rules(organization_id,service_name,task_name)
);
create index packing_rules_actor on private.packing_rules(updated_by);
create index packing_versions_actor on private.packing_rule_versions(approved_by);
alter table private.packing_rules enable row level security;
alter table private.packing_rule_versions enable row level security;
revoke all on private.packing_rules,private.packing_rule_versions from public,anon,authenticated,service_role;
create policy packing_rules_deny on private.packing_rules to anon,authenticated using(false) with check(false);
create policy packing_versions_deny on private.packing_rule_versions to anon,authenticated using(false) with check(false);

create function private.read_packing_rules(p_org uuid,p_work jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_work is not null then
  if jsonb_typeof(p_work)<>'array' then raise exception 'VALIDATION';end if;
  if jsonb_array_length(p_work)>15000 then raise exception 'VALIDATION';end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('service',r.service_name,'task',r.task_name,'revision',r.revision,'items',r.items) order by r.service_name,r.task_name),'[]'::jsonb) into result
 from (select * from private.packing_rules where organization_id=p_org and (p_work is null or exists(select 1 from jsonb_array_elements(p_work) w where service_name=w->>'service' and task_name=w->>'task')) order by service_name,task_name limit 1001) r;
 return jsonb_build_object('rules',result,'complete',jsonb_array_length(result)<=1000);
end$$;
create function public.read_packing_rules(p_org uuid,p_work jsonb default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.read_packing_rules(p_org,p_work)$$;
revoke all on function private.read_packing_rules(uuid,jsonb),public.read_packing_rules(uuid,jsonb) from public,anon,service_role;
grant execute on function private.read_packing_rules(uuid,jsonb),public.read_packing_rules(uuid,jsonb) to authenticated;

create function private.approve_packing_rule(p_org uuid,p_service text,p_task text,p_revision integer,p_items jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous private.command_receipts;current_revision integer;rule_id uuid;fingerprint text;result jsonb;item jsonb;canonical jsonb:='[]'::jsonb;names text[]:='{}';item_name text;unit_name text;normalized_name text;quantity integer;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_service is null or p_task is null or length(trim(p_service)) not between 2 and 80 or length(trim(p_task))>120
 or p_revision is null or p_revision<0 or p_key is null or length(p_key) not between 16 and 128
 or p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'VALIDATION';end if;
 if jsonb_array_length(p_items)>40 then raise exception 'VALIDATION';end if;
 p_service:=trim(p_service);p_task:=trim(p_task);
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' then raise exception 'VALIDATION';end if;
  if (select count(*) from jsonb_object_keys(item))<>4 or not (item ?& array['name','unit','quantity','consumed'])
   or jsonb_typeof(item->'name')<>'string' or jsonb_typeof(item->'unit')<>'string' or jsonb_typeof(item->'quantity')<>'number' or jsonb_typeof(item->'consumed')<>'boolean' then raise exception 'VALIDATION';end if;
  item_name:=regexp_replace(trim(item->>'name'),'\s+',' ','g');unit_name:=lower(trim(item->>'unit'));
  if length(item_name) not between 1 and 80 or unit_name !~ '^[a-z][a-z ]{0,23}$' or item->>'quantity' !~ '^[0-9]{1,4}$' then raise exception 'VALIDATION';end if;
  quantity:=(item->>'quantity')::integer;if quantity not between 1 and 1000 then raise exception 'VALIDATION';end if;
  normalized_name:=lower(item_name);if normalized_name=any(names) then raise exception 'DUPLICATE_EQUIPMENT';end if;names:=array_append(names,normalized_name);
  canonical:=canonical||jsonb_build_array(jsonb_build_object('name',item_name,'unit',unit_name,'quantity',quantity,'consumed',(item->>'consumed')::boolean));
 end loop;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_service,p_task,p_revision,canonical,auth.uid())::text,'UTF8')),'hex');
 -- Serialize all packing edits for this company, so two first-time approvals cannot race.
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':packing-rules',0));
 select * into previous from private.command_receipts where organization_id=p_org and command='ApprovePackingRule' and key=p_key;
 if found then if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return previous.result;end if;
 select revision into current_revision from private.packing_rules where organization_id=p_org and service_name=p_service and task_name=p_task for update;
 if coalesce(current_revision,0)<>p_revision then raise exception 'STALE_REVISION';end if;
 if current_revision is null and (select count(*) from private.packing_rules where organization_id=p_org)>=1000 then raise exception 'RULE_LIMIT';end if;
 insert into private.packing_rules(organization_id,service_name,task_name,revision,items,updated_by)
 values(p_org,p_service,p_task,p_revision+1,canonical,auth.uid())
 on conflict(organization_id,service_name,task_name) do update set revision=excluded.revision,items=excluded.items,updated_by=excluded.updated_by,updated_at=clock_timestamp() returning id into rule_id;
 insert into private.packing_rule_versions(organization_id,service_name,task_name,revision,items,approved_by)
 values(p_org,p_service,p_task,p_revision+1,canonical,auth.uid());
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
 values(p_org,auth.uid(),'packing.rule_approved',rule_id,p_revision+1,rule_id);
 result:=jsonb_build_object('revision',p_revision+1,'saved',true);
 insert into private.command_receipts values(p_org,'ApprovePackingRule',p_key,fingerprint,result,clock_timestamp());return result;
end$$;
create function public.approve_packing_rule(p_org uuid,p_service text,p_task text,p_revision integer,p_items jsonb,p_key text) returns jsonb
language sql security invoker set search_path='' as $$select private.approve_packing_rule(p_org,p_service,p_task,p_revision,p_items,p_key)$$;
revoke all on function private.approve_packing_rule(uuid,text,text,integer,jsonb,text),public.approve_packing_rule(uuid,text,text,integer,jsonb,text) from public,anon,service_role;
grant execute on function private.approve_packing_rule(uuid,text,text,integer,jsonb,text),public.approve_packing_rule(uuid,text,text,integer,jsonb,text) to authenticated;

-- Daily calls filter by arrival, independently of dashboard pages.
create index appointments_day_plan on public.appointments(organization_id,arrival_at,id) where status in('reserved','needs_review');
