-- Owner-directed recruitment interest only. No contractor classification, hiring or farm staffing approval.
create table private.career_policy(
 organization_id uuid primary key references public.organizations(id),enabled boolean not null default false,employee_count integer not null default 1 check(employee_count between 0 and 10000),review_until timestamptz not null,revision integer not null default 1 check(revision>0),updated_by uuid,updated_at timestamptz not null default clock_timestamp()
);
insert into private.career_policy(organization_id,enabled,employee_count,review_until)
 select id,true,1,clock_timestamp()+interval '90 days' from public.organizations where slug='ynsg' and status='active';
create table private.career_applications(
 organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(),profile jsonb not null,
 status text not null default 'new' check(status in('new','reviewing','contacted','closed','withdrawn')),revision integer not null default 1 check(revision>0),
 resume_name text,resume_bytes bytea,resume_sha text,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,id),check((resume_bytes is null and resume_name is null and resume_sha is null) or (octet_length(resume_bytes) between 16 and 1048576 and length(resume_name) between 1 and 180 and resume_sha=encode(sha256(resume_bytes),'hex')))
);
create index careers_queue on private.career_applications(organization_id,status,created_at desc,id);
create table private.career_receipts(
 organization_id uuid not null references public.organizations(id),key uuid not null,proof_hash text not null check(proof_hash ~ '^[a-f0-9]{64}$'),fingerprint text,
 outcome text not null check(outcome in('received','not_applied')),application_id uuid,client_hash text not null check(client_hash ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,key),foreign key(organization_id,application_id) references private.career_applications(organization_id,id),check((outcome='received')=(application_id is not null))
);
create index careers_attempt_rate on private.career_receipts(organization_id,client_hash,created_at);
create table private.career_history(
 organization_id uuid not null,application_id uuid not null,id uuid not null default gen_random_uuid(),actor_id uuid not null,status text not null,note text not null check(length(note) between 10 and 2000),recorded_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,id),foreign key(organization_id,application_id) references private.career_applications(organization_id,id)
);
create index careers_history on private.career_history(organization_id,application_id,recorded_at,id);
alter table private.career_policy enable row level security;alter table private.career_applications enable row level security;alter table private.career_receipts enable row level security;alter table private.career_history enable row level security;
revoke all on private.career_policy,private.career_applications,private.career_receipts,private.career_history from public,anon,authenticated,service_role;

create function private.career_valid_profile(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;v text;limit_n integer;begin
 if jsonb_typeof(p) is distinct from 'object' or (select count(*) from jsonb_object_keys(p))<>13 or octet_length(p::text)>16000 or exists(select 1 from jsonb_object_keys(p) key where key not in('role','name','email','phone','city','skills','experience','availability','travel','authorized','adult','privacy','notice')) then return false;end if;
 foreach k in array array['role','name','email','phone','city','experience','availability','travel','authorized','notice'] loop
  v:=p->>k;limit_n:=case k when 'name' then 120 when 'email' then 254 when 'phone' then 35 when 'city' then 80 when 'experience' then 4000 when 'availability' then 1000 else 80 end;
  if jsonb_typeof(p->k) is distinct from 'string' or v<>btrim(v) or length(v)>limit_n or v ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' or (k not in('experience','availability') and v ~ '[\n\r\t<>]') then return false;end if;
 end loop;
 if p->>'role' not in('home_support','yard_support') or length(p->>'name')<2 or length(p->>'city')<2 or length(p->>'experience')<20 or length(p->>'availability')<5 or p->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p->>'phone' !~ '^[+0-9() .xX#-]{7,35}$' or length(regexp_replace(p->>'phone','[^0-9]','','g'))<7 or p->>'travel' not in('yes','discuss') or p->>'authorized' not in('yes','discuss') or p->'adult' is distinct from 'true'::jsonb or p->'privacy' is distinct from 'true'::jsonb or p->>'notice'<>'careers-2026-11-01' then return false;end if;
 if jsonb_typeof(p->'skills') is distinct from 'array' or jsonb_array_length(p->'skills') not between 1 and 12 or exists(select 1 from jsonb_array_elements_text(p->'skills') skill where skill not in('Furniture assembly','Household hardware','Minor drywall patches','Organizing','Lawn care','Garden-bed care','Leaf management','Mulch handling','Residential snow','Manageable cleanouts','Customer communication','Other relevant experience')) or (select count(distinct value) from jsonb_array_elements_text(p->'skills'))<>jsonb_array_length(p->'skills') then return false;end if;return true;
end $$;
alter table private.career_applications add constraint career_profile_valid check(private.career_valid_profile(profile));
revoke all on function private.career_valid_profile(jsonb) from public,anon,authenticated,service_role;

create function public.career_public_status(p_org uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('accepting',coalesce((select p.enabled and p.employee_count<15 and p.review_until>now() and o.status='active' from private.career_policy p join public.organizations o on o.id=p.organization_id where p.organization_id=p_org),false),'checkedAt',clock_timestamp(),'roles',case when exists(select 1 from private.career_policy p join public.organizations o on o.id=p.organization_id where p.organization_id=p_org and p.enabled and p.employee_count<15 and p.review_until>now() and o.status='active') then '["home_support","yard_support"]'::jsonb else '[]'::jsonb end)
$$;
revoke all on function public.career_public_status(uuid) from public,anon,authenticated;grant execute on function public.career_public_status(uuid) to service_role;

create function public.career_apply(p_org uuid,p_body text,p_client_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;p jsonb;r jsonb;k uuid;proof text;f text;prior private.career_receipts;rid uuid;resume_data bytea;name_n text;sha text;begin
 if auth.role()<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_body is null or p_client_hash is null or octet_length(p_body)>1500000 or p_client_hash !~ '^[a-f0-9]{64}$' then raise exception 'VALIDATION';end if;
 d:=p_body::jsonb;k:=(d->>'key')::uuid;proof:=d->>'proof';p:=d->'profile';r:=d->'resume';
 if k is null or proof is null or proof !~ '^[a-f0-9]{64}$' or (select count(*) from jsonb_object_keys(d))<>4 or not private.career_valid_profile(p) then raise exception 'VALIDATION';end if;
 f:=encode(sha256(convert_to(p_body,'UTF8')),'hex');perform pg_advisory_xact_lock(hashtextextended(p_org::text||':career:'||k::text,0));
 select * into prior from private.career_receipts where organization_id=p_org and key=k;
 if found then
  if prior.proof_hash<>encode(sha256(convert_to(proof,'UTF8')),'hex') or (prior.fingerprint is not null and prior.fingerprint<>f) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  if prior.outcome='not_applied' then raise exception 'ATTEMPT_CLOSED';end if;
  return jsonb_build_object('organization',p_org,'key',k,'id',prior.application_id,'outcome','received');
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':career-quota',0));
 if not coalesce((public.career_public_status(p_org)->>'accepting')::boolean,false) then raise exception 'INTAKE_PAUSED';end if;
 if (select count(*) from private.career_receipts where organization_id=p_org and created_at>now()-interval '1 day')>=500 then raise exception 'RATE_LIMITED';end if;
 if (select count(*) from private.career_receipts where organization_id=p_org and client_hash=p_client_hash and created_at>now()-interval '1 day')>=10 then raise exception 'RATE_LIMITED';end if;
 if (select count(*) from private.career_applications where organization_id=p_org)>=200 then raise exception 'CAPACITY_REVIEW';end if;
 if r is distinct from 'null'::jsonb then
  if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>5 or r->>'mime'<>'application/pdf' or length(r->>'name') not between 1 and 180 or r->>'name' ~ '[[:cntrl:]<>/\\]' or r->>'name' !~* '\.pdf$' or length(r->>'content')>1400000 or r->>'content' !~ '^[A-Za-z0-9+/=\r\n]+$' then raise exception 'VALIDATION';end if;
  resume_data:=decode(r->>'content','base64');name_n:=r->>'name';sha:=encode(sha256(resume_data),'hex');
  if octet_length(resume_data) not between 16 and 1048576 or (r->>'bytes')::integer<>octet_length(resume_data) or r->>'sha256'<>sha or encode(substring(resume_data from 1 for 5),'escape')<>'%PDF-' or position(convert_to('%%EOF','UTF8') in substring(resume_data from greatest(1,octet_length(resume_data)-1023)))=0 then raise exception 'VALIDATION';end if;
  if coalesce((select sum(octet_length(resume_bytes)) from private.career_applications where organization_id=p_org),0)+octet_length(resume_data)>26214400 then raise exception 'RESUME_CAPACITY';end if;
 end if;
 insert into private.career_applications(organization_id,profile,resume_name,resume_bytes,resume_sha) values(p_org,p,name_n,resume_data,sha) returning id into rid;
 insert into private.career_receipts(organization_id,key,proof_hash,fingerprint,outcome,application_id,client_hash) values(p_org,k,encode(sha256(convert_to(proof,'UTF8')),'hex'),f,'received',rid,p_client_hash);
 insert into public.audit_events(organization_id,action,object_id,object_revision,correlation_id) values(p_org,'careers.application_received',rid,1,k);
 return jsonb_build_object('organization',p_org,'key',k,'id',rid,'outcome','received');
end $$;
revoke all on function public.career_apply(uuid,text,text) from public,anon,authenticated;grant execute on function public.career_apply(uuid,text,text) to service_role;

create function public.career_resolve(p_org uuid,p_key uuid,p_proof text,p_client_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.career_receipts;begin
 if auth.role()<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or p_proof is null or p_client_hash is null or p_proof !~ '^[a-f0-9]{64}$' or p_client_hash !~ '^[a-f0-9]{64}$' then raise exception 'VALIDATION';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':career:'||p_key::text,0));select * into r from private.career_receipts where organization_id=p_org and key=p_key;
 if found then
  if r.proof_hash<>encode(sha256(convert_to(p_proof,'UTF8')),'hex') then raise exception 'FORBIDDEN' using errcode='42501';end if;
  return jsonb_build_object('organization',p_org,'key',p_key,'id',r.application_id,'outcome',r.outcome);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':career-quota',0));
 if not exists(select 1 from private.career_policy where organization_id=p_org) then raise exception 'INTAKE_PAUSED';end if;
 if (select count(*) from private.career_receipts where organization_id=p_org and created_at>now()-interval '1 day')>=500 then raise exception 'RATE_LIMITED';end if;
 if (select count(*) from private.career_receipts where organization_id=p_org and client_hash=p_client_hash and created_at>now()-interval '1 day')>=10 then raise exception 'RATE_LIMITED';end if;
 insert into private.career_receipts(organization_id,key,proof_hash,outcome,client_hash) values(p_org,p_key,encode(sha256(convert_to(p_proof,'UTF8')),'hex'),'not_applied',p_client_hash);
 return jsonb_build_object('organization',p_org,'key',p_key,'id',null,'outcome','not_applied');
end $$;
revoke all on function public.career_resolve(uuid,uuid,text,text) from public,anon,authenticated;grant execute on function public.career_resolve(uuid,uuid,text,text) to service_role;

create function public.career_owner_workspace(p_org uuid,p_page integer default 0,p_status text default 'all',p_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare items jsonb;n bigint;policy private.career_policy;begin
 if not private.staff(p_org,array['owner']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_page not between 0 and 10000 or p_status not in('all','new','reviewing','contacted','closed','withdrawn') then raise exception 'VALIDATION';end if;
 select * into policy from private.career_policy where organization_id=p_org;
 if not found then raise exception 'SETUP_REQUIRED';end if;
 select count(*) into n from private.career_applications a where a.organization_id=p_org and (p_status='all' or a.status=p_status) and (p_id is null or a.id=p_id);
 select coalesce(jsonb_agg(item order by created_at desc,id),'[]'::jsonb) into items from (
  select a.created_at,a.id,jsonb_build_object('id',a.id,'profile',a.profile,'status',a.status,'revision',a.revision,'createdAt',a.created_at,'updatedAt',a.updated_at,'resume',case when a.resume_bytes is null then null else jsonb_build_object('name',a.resume_name,'bytes',octet_length(a.resume_bytes)) end,'history',coalesce((select jsonb_agg(jsonb_build_object('at',h.recorded_at,'actor',h.actor_id,'status',h.status,'note',h.note) order by h.recorded_at,h.id) from private.career_history h where h.organization_id=p_org and h.application_id=a.id),'[]'::jsonb)) as item
  from private.career_applications a where a.organization_id=p_org and (p_status='all' or a.status=p_status) and (p_id is null or a.id=p_id) order by a.created_at desc,a.id limit 25 offset p_page*25
 ) page;
 return jsonb_build_object('organization',p_org,'actor',auth.uid(),'checkedAt',clock_timestamp(),'policy',jsonb_build_object('enabled',policy.enabled,'employeeCount',policy.employee_count,'reviewUntil',policy.review_until,'revision',policy.revision),'page',p_page,'total',n,'hasMore',p_page*25+jsonb_array_length(items)<n,'items',items);
end $$;
revoke all on function public.career_owner_workspace(uuid,integer,text,uuid) from public,anon,service_role;grant execute on function public.career_owner_workspace(uuid,integer,text,uuid) to authenticated;

create function public.career_owner_command(p_org uuid,p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;k uuid;f text;ns text;r jsonb;prior private.command_receipts;a private.career_applications;policy private.career_policy;rev integer;cid uuid;action_n text;begin
 if not private.staff(p_org,array['owner']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_body is null or octet_length(p_body)>6000 then raise exception 'VALIDATION';end if;d:=p_body::jsonb;k:=(d->>'key')::uuid;action_n:=d->>'action';
 if jsonb_typeof(d) is distinct from 'object' or k is null or (d->>'organization')::uuid is distinct from p_org or action_n is null or action_n not in('review','configure') or jsonb_typeof(d->'revision') is distinct from 'number' or coalesce(d->>'revision','')!~'^[1-9][0-9]{0,8}$' then raise exception 'VALIDATION';end if;
 if action_n='configure' then
  if (select count(*) from jsonb_object_keys(d))<>7 or exists(select 1 from jsonb_object_keys(d) x where x not in('organization','key','revision','action','employeeCount','accepting','reviewed')) or jsonb_typeof(d->'employeeCount') is distinct from 'number' or coalesce(d->>'employeeCount','')!~'^[0-9]{1,5}$' or jsonb_typeof(d->'accepting') is distinct from 'boolean' then raise exception 'VALIDATION';end if;
 else
  if (select count(*) from jsonb_object_keys(d))<>8 or exists(select 1 from jsonb_object_keys(d) x where x not in('organization','key','revision','action','id','status','note','confirmedContact')) or jsonb_typeof(d->'id') is distinct from 'string' or jsonb_typeof(d->'status') is distinct from 'string' or jsonb_typeof(d->'note') is distinct from 'string' or jsonb_typeof(d->'confirmedContact') is distinct from 'boolean' then raise exception 'VALIDATION';end if;
 end if;
 ns:='career_owner:'||auth.uid()::text;f:=encode(sha256(convert_to(p_body,'UTF8')),'hex');perform pg_advisory_xact_lock(hashtextextended(p_org::text||ns||k::text,0));
 select * into prior from private.command_receipts where organization_id=p_org and command=ns and key=k::text;
 if found then if prior.fingerprint<>f then raise exception 'IDEMPOTENCY_CONFLICT';end if;if prior.result->>'outcome'='not_applied' then raise exception 'ATTEMPT_CLOSED';end if;return prior.result;end if;
 if action_n='configure' then
  select * into policy from private.career_policy where organization_id=p_org for update;
  if not found then raise exception 'SETUP_REQUIRED';end if;
  if (d->>'revision')::integer is distinct from policy.revision then raise exception 'STALE_REVISION';end if;
  if d->'reviewed' is distinct from 'true'::jsonb or jsonb_typeof(d->'accepting')<>'boolean' or (d->>'employeeCount')::integer not between 0 and 10000 then raise exception 'VALIDATION';end if;
  if (d->>'employeeCount')::integer>=15 and (d->>'accepting')::boolean then raise exception 'PAY_DISCLOSURE_REQUIRED';end if;
  update private.career_policy set enabled=(d->>'accepting')::boolean,employee_count=(d->>'employeeCount')::integer,review_until=clock_timestamp()+interval '90 days',revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp() where organization_id=p_org returning revision into rev;
 else
  cid:=(d->>'id')::uuid;select * into a from private.career_applications where organization_id=p_org and id=cid for update;
  if not found then raise exception 'NOT_FOUND';end if;if (d->>'revision')::integer is distinct from a.revision then raise exception 'STALE_REVISION';end if;
  if d->>'status' not in('new','reviewing','contacted','closed','withdrawn') or length(btrim(d->>'note')) not between 10 and 2000 or d->>'note' ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' or (d->>'status'='contacted' and d->'confirmedContact' is distinct from 'true'::jsonb) then raise exception 'VALIDATION';end if;
  if (select count(*) from private.career_history where organization_id=p_org and application_id=cid)>=20 then raise exception 'HISTORY_LIMIT';end if;
  update private.career_applications set status=d->>'status',revision=revision+1,updated_at=clock_timestamp() where organization_id=p_org and id=cid returning revision into rev;
  insert into private.career_history(organization_id,application_id,actor_id,status,note) values(p_org,cid,auth.uid(),d->>'status',btrim(d->>'note'));
 end if;
 r:=jsonb_build_object('organization',p_org,'key',k,'id',cid,'revision',rev,'action',action_n,'outcome','saved','fingerprint',f);insert into private.command_receipts values(p_org,ns,k::text,f,r,now());
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'careers.'||action_n,coalesce(cid,p_org),rev,k);return r;
end $$;
revoke all on function public.career_owner_command(uuid,text) from public,anon,service_role;grant execute on function public.career_owner_command(uuid,text) to authenticated;

create function public.career_resume_owner(p_org uuid,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.career_applications;begin
 if not private.staff(p_org,array['owner']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into a from private.career_applications where organization_id=p_org and id=p_id;
 if not found or a.resume_bytes is null then raise exception 'NOT_FOUND';end if;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'careers.resume_download',p_id,a.revision,gen_random_uuid());
 return jsonb_build_object('organization',p_org,'id',p_id,'name',a.resume_name,'mime','application/pdf','bytes',octet_length(a.resume_bytes),'sha256',a.resume_sha,'content',encode(a.resume_bytes,'base64'));
end $$;
revoke all on function public.career_resume_owner(uuid,uuid) from public,anon,service_role;grant execute on function public.career_resume_owner(uuid,uuid) to authenticated;

create function public.career_owner_resolve(p_org uuid,p_key uuid,p_id uuid,p_operation text,p_fingerprint text) returns jsonb language plpgsql security definer set search_path='' as $$
declare prior private.command_receipts;ns text;r jsonb;begin
 if not private.staff(p_org,array['owner']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or p_operation is null or p_fingerprint is null or (p_operation='review' and p_id is null) or (p_operation='configure' and p_id is not null) or p_operation not in('review','configure') or p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'VALIDATION';end if;
 ns:='career_owner:'||auth.uid()::text;perform pg_advisory_xact_lock(hashtextextended(p_org::text||ns||p_key::text,0));select * into prior from private.command_receipts where organization_id=p_org and command=ns and key=p_key::text;
 if found then if prior.fingerprint<>p_fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 r:=jsonb_build_object('organization',p_org,'key',p_key,'id',p_id,'revision',null,'action',p_operation,'outcome','not_applied','fingerprint',p_fingerprint);
 insert into private.command_receipts values(p_org,ns,p_key::text,p_fingerprint,r,now());return r;
end $$;
revoke all on function public.career_owner_resolve(uuid,uuid,uuid,text,text) from public,anon,service_role;grant execute on function public.career_owner_resolve(uuid,uuid,uuid,text,text) to authenticated;
