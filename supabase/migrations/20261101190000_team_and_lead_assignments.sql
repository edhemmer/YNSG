-- Operational technician contacts are separate from applicants, customer records and login identities.
create table private.team_technicians(
 organization_id uuid not null references public.organizations(id),id uuid not null,name text not null check(length(name) between 2 and 120),phone text not null check(length(phone) between 7 and 35),email text not null check(length(email) between 3 and 254),skills text not null default '' check(length(skills)<=500),notes text not null default '' check(length(notes)<=2000),user_id uuid references auth.users(id),archived boolean not null default false,revision integer not null default 1 check(revision>0),updated_at timestamptz not null default clock_timestamp(),primary key(organization_id,id)
);
create unique index team_active_account on private.team_technicians(organization_id,user_id) where user_id is not null and not archived;
create index team_directory on private.team_technicians(organization_id,archived,name,id);
create table private.lead_assignments(
 organization_id uuid not null,request_id uuid not null,technician_id uuid,revision integer not null default 1 check(revision>0),assigned_at timestamptz,assigned_by uuid references auth.users(id),note text not null default '' check(length(note)<=2000),primary key(organization_id,request_id),foreign key(organization_id,request_id) references public.service_requests(organization_id,id),foreign key(organization_id,technician_id) references private.team_technicians(organization_id,id)
);
create index technician_leads on private.lead_assignments(organization_id,technician_id,request_id);
create table private.lead_assignment_history(
 organization_id uuid not null,request_id uuid not null,revision integer not null,technician_id uuid,technician_name text,actor_id uuid not null references auth.users(id),recorded_at timestamptz not null default clock_timestamp(),note text not null,primary key(organization_id,request_id,revision),foreign key(organization_id,request_id) references public.service_requests(organization_id,id)
);
alter table private.team_technicians enable row level security;alter table private.lead_assignments enable row level security;alter table private.lead_assignment_history enable row level security;
revoke all on private.team_technicians,private.lead_assignments,private.lead_assignment_history from public,anon,authenticated,service_role;
create policy team_deny on private.team_technicians to anon,authenticated using(false) with check(false);
create policy assignment_deny on private.lead_assignments to anon,authenticated using(false) with check(false);
create policy assignment_history_deny on private.lead_assignment_history to anon,authenticated using(false) with check(false);
create function public.technician_directory(p_org uuid,p_page integer,p_query text,p_archived boolean,p_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare items jsonb;accounts jsonb;n integer;begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_page is null or p_page not between 0 and 10000 or p_query is null or length(p_query)>100 or p_archived is null then raise exception 'VALIDATION';end if;
 if (select count(*) from public.memberships where organization_id=p_org and role='technician' and revoked_at is null)>100 then raise exception 'CAPACITY_REVIEW';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'email',u.email) order by m.user_id),'[]') into accounts from public.memberships m join auth.users u on u.id=m.user_id where m.organization_id=p_org and m.role='technician' and m.revoked_at is null and u.email is not null;
 select count(*) into n from private.team_technicians where organization_id=p_org and (p_id is null or id=p_id) and (p_archived or not archived) and position(lower(p_query) in lower(name||' '||skills||' '||email||' '||phone))>0;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'revision',t.revision,'profile',jsonb_build_object('name',t.name,'phone',t.phone,'email',t.email,'skills',t.skills,'notes',t.notes,'userId',t.user_id,'archived',t.archived),'updatedAt',t.updated_at,'activeLeads',(select count(*) from private.lead_assignments a join public.service_requests r on r.organization_id=a.organization_id and r.id=a.request_id where a.organization_id=p_org and a.technician_id=t.id and r.status not in('declined','canceled','completed'))) order by t.name,t.id),'[]') into items from (select * from private.team_technicians where organization_id=p_org and (p_id is null or id=p_id) and (p_archived or not archived) and position(lower(p_query) in lower(name||' '||skills||' '||email||' '||phone))>0 order by name,id limit 25 offset p_page*25) t;
 return jsonb_build_object('organization',p_org,'actor',auth.uid(),'page',p_page,'total',n,'hasMore',p_page*25+jsonb_array_length(items)<n,'items',items,'accounts',accounts);
end $$;
create function public.save_technician(p_org uuid,p_id uuid,p_revision integer,p_profile jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t private.team_technicians;assignment private.lead_assignments;f text;prior private.command_receipts;r jsonb;u uuid;begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or p_id is null or p_revision is null or p_revision<0 or jsonb_typeof(p_profile) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_profile))<>7 or exists(select 1 from jsonb_object_keys(p_profile) x where x not in('name','phone','email','skills','notes','userId','archived')) then raise exception 'VALIDATION';end if;
 if exists(select 1 from jsonb_each(p_profile) e where e.key in('name','phone','email','skills','notes') and jsonb_typeof(e.value)<>'string') or jsonb_typeof(p_profile->'archived') is distinct from 'boolean' or (p_profile->'userId' is distinct from 'null'::jsonb and jsonb_typeof(p_profile->'userId') is distinct from 'string') then raise exception 'VALIDATION';end if;
 if length(btrim(p_profile->>'name')) not between 2 and 120 or length(p_profile->>'phone') not between 7 and 35 or p_profile->>'phone'!~'^[+0-9() .xX#-]+$' or p_profile->>'email'!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_profile->>'email')>254 or length(p_profile->>'skills')>500 or length(p_profile->>'notes')>2000 or ((p_profile->>'name')||(p_profile->>'phone')||(p_profile->>'email')||(p_profile->>'skills'))~'[[:cntrl:]<>]' then raise exception 'VALIDATION';end if;
 u:=(p_profile->>'userId')::uuid;
 if u is not null and not exists(select 1 from public.memberships where organization_id=p_org and user_id=u and role='technician' and revoked_at is null) and not exists(select 1 from private.team_technicians where organization_id=p_org and id=p_id and user_id=u) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 f:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_id,p_revision,p_profile)::text,'UTF8')),'hex');perform pg_advisory_xact_lock(hashtextextended(p_org::text||':team:'||p_key::text,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='SaveTechnician' and key=p_key::text;if found then if prior.fingerprint<>f then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':team-directory',0));
 if u is not null and not (p_profile->>'archived')::boolean and exists(select 1 from private.team_technicians where organization_id=p_org and user_id=u and id<>p_id and not archived) then raise exception 'ACCOUNT_ALREADY_LINKED';end if;
 perform 1 from public.service_requests r where r.organization_id=p_org and exists(select 1 from private.lead_assignments a where a.organization_id=p_org and a.request_id=r.id and a.technician_id=p_id) order by r.id for update;
 -- Changes to the linked identity/archived status serialize with in-flight labor saves.
 perform 1 from public.jobs j where j.organization_id=p_org and (exists(select 1 from public.quotes q join private.lead_assignments a on a.organization_id=q.organization_id and a.request_id=q.request_id where q.organization_id=p_org and q.id=j.quote_id and a.technician_id=p_id)) order by j.id for update;
 select * into t from private.team_technicians where organization_id=p_org and id=p_id for update;
 if not found then
  if p_revision<>0 then raise exception 'STALE_REVISION';end if;
  if (select count(*) from private.team_technicians where organization_id=p_org)>=200 then raise exception 'CAPACITY_REVIEW';end if;
  insert into private.team_technicians(organization_id,id,name,phone,email,skills,notes,user_id,archived) values(p_org,p_id,btrim(p_profile->>'name'),p_profile->>'phone',p_profile->>'email',p_profile->>'skills',p_profile->>'notes',u,(p_profile->>'archived')::boolean) returning * into t;
 else
  if t.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
  if not t.archived and (p_profile->>'archived')::boolean then
   for assignment in select * from private.lead_assignments where organization_id=p_org and technician_id=p_id order by request_id loop
    perform public.assign_lead(p_org,assignment.request_id,assignment.revision,null,'Technician archived; Owner resumes responsibility',gen_random_uuid());
   end loop;
   if t.user_id is not null then update public.memberships set revoked_at=clock_timestamp() where organization_id=p_org and user_id=t.user_id and role='technician';end if;
   insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'team.technician_access_revoked',p_id,t.revision+1,p_key);
  end if;
  update private.team_technicians set name=btrim(p_profile->>'name'),phone=p_profile->>'phone',email=p_profile->>'email',skills=p_profile->>'skills',notes=p_profile->>'notes',user_id=u,archived=(p_profile->>'archived')::boolean,revision=revision+1,updated_at=clock_timestamp() where organization_id=p_org and id=p_id returning * into t;
 end if;
 r:=jsonb_build_object('organization',p_org,'id',p_id,'key',p_key,'revision',t.revision);insert into private.command_receipts values(p_org,'SaveTechnician',p_key::text,f,r,now());
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'team.technician_saved',p_id,t.revision,p_key);return r;
end $$;
create function public.lead_assignment(p_org uuid,p_request uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a private.lead_assignments;t private.team_technicians;begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.service_requests where organization_id=p_org and id=p_request) then raise exception 'NOT_FOUND';end if;
 select * into a from private.lead_assignments where organization_id=p_org and request_id=p_request;select * into t from private.team_technicians where organization_id=p_org and id=a.technician_id;
 return jsonb_build_object('organization',p_org,'actor',auth.uid(),'request',p_request,'revision',coalesce(a.revision,1),'technician',a.technician_id,'assignedAt',a.assigned_at,'note',coalesce(a.note,''),'contact',case when t.id is null then null else jsonb_build_object('id',t.id,'name',t.name,'phone',t.phone,'email',t.email,'archived',t.archived,'userId',t.user_id) end);
end $$;
create function public.assign_lead(p_org uuid,p_request uuid,p_revision integer,p_technician uuid,p_note text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.lead_assignments;t private.team_technicians;f text;prior private.command_receipts;r jsonb;begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or p_revision is null or p_note is null or length(btrim(p_note)) not between 2 and 2000 then raise exception 'VALIDATION';end if;
 f:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_request,p_revision,p_technician,p_note)::text,'UTF8')),'hex');perform pg_advisory_xact_lock(hashtextextended(p_org::text||':assign-lead:'||p_key::text,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='AssignLead' and key=p_key::text;if found then if prior.fingerprint<>f then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 perform 1 from public.service_requests where organization_id=p_org and id=p_request for update;if not found then raise exception 'NOT_FOUND';end if;
 perform 1 from public.jobs j join public.quotes q on q.organization_id=j.organization_id and q.id=j.quote_id where j.organization_id=p_org and q.request_id=p_request order by j.id for update of j;
 if p_technician is not null then select * into t from private.team_technicians where organization_id=p_org and id=p_technician for update;if not found or t.archived then raise exception 'TECHNICIAN_UNAVAILABLE';end if;end if;
 insert into private.lead_assignments(organization_id,request_id) values(p_org,p_request) on conflict do nothing;select * into a from private.lead_assignments where organization_id=p_org and request_id=p_request for update;
 if a.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 if (select count(*) from private.lead_assignment_history where organization_id=p_org and request_id=p_request)>=200 then raise exception 'HISTORY_LIMIT';end if;
 update private.lead_assignments set technician_id=p_technician,assigned_by=auth.uid(),assigned_at=clock_timestamp(),note=btrim(p_note),revision=revision+1 where organization_id=p_org and request_id=p_request returning * into a;
 insert into private.lead_assignment_history(organization_id,request_id,revision,technician_id,technician_name,actor_id,note) values(p_org,p_request,a.revision,p_technician,t.name,auth.uid(),a.note);
 r:=jsonb_build_object('organization',p_org,'request',p_request,'key',p_key,'revision',a.revision,'technician',p_technician);insert into private.command_receipts values(p_org,'AssignLead',p_key::text,f,r,now());insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'lead.assigned',p_request,a.revision,p_key);return r;
end $$;
create function private.labor_editor(p_org uuid,p_job uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.staff(p_org,array['owner','admin']) or (private.staff(p_org,array['technician']) and exists(select 1 from public.jobs j join public.quotes q on q.organization_id=j.organization_id and q.id=j.quote_id join private.lead_assignments a on a.organization_id=q.organization_id and a.request_id=q.request_id join private.team_technicians t on t.organization_id=a.organization_id and t.id=a.technician_id where j.organization_id=p_org and j.id=p_job and t.user_id=auth.uid() and not t.archived))
$$;
revoke all on function private.labor_editor(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.technician_directory(uuid,integer,text,boolean,uuid),public.save_technician(uuid,uuid,integer,jsonb,uuid),public.lead_assignment(uuid,uuid),public.assign_lead(uuid,uuid,integer,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.technician_directory(uuid,integer,text,boolean,uuid),public.save_technician(uuid,uuid,integer,jsonb,uuid),public.lead_assignment(uuid,uuid),public.assign_lead(uuid,uuid,integer,uuid,text,uuid) to authenticated;
create function private.activate_technician(p_org uuid,p_id uuid,p_revision integer,p_reviewed boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare t private.team_technicians;u uuid;existing_role text;begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_reviewed is distinct from true then raise exception 'VALIDATION';end if;
 select * into t from private.team_technicians where organization_id=p_org and id=p_id for update;if not found or t.archived then raise exception 'TECHNICIAN_UNAVAILABLE';end if;
 if t.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 select id into u from auth.users where lower(email)=lower(t.email) and email_confirmed_at is not null and deleted_at is null;
 if u is null then raise exception 'ACCOUNT_NOT_READY';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':technician-login:'||u::text,0));
 select role into existing_role from public.memberships where organization_id=p_org and user_id=u for update;
 if found and existing_role<>'technician' then raise exception 'ACCOUNT_ROLE_CONFLICT';end if;
 if exists(select 1 from private.team_technicians where organization_id=p_org and user_id=u and id<>p_id and not archived) then raise exception 'ACCOUNT_ALREADY_LINKED';end if;
 insert into public.memberships(organization_id,user_id,role) values(p_org,u,'technician') on conflict(organization_id,user_id) do update set revoked_at=null where public.memberships.role='technician';
 update private.team_technicians set user_id=u,revision=revision+1,updated_at=clock_timestamp() where organization_id=p_org and id=p_id returning * into t;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'team.technician_access_activated',p_id,t.revision,gen_random_uuid());
 return jsonb_build_object('revision',t.revision);
end $$;
revoke all on function private.activate_technician(uuid,uuid,integer,boolean) from public,anon,authenticated,service_role;
create function public.team_command(p_org uuid,p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;k uuid;target uuid;operation text;f text;ns text;prior private.command_receipts;saved jsonb;r jsonb;begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_body is null or octet_length(p_body)>12000 then raise exception 'VALIDATION';end if;d:=p_body::jsonb;k:=(d->>'key')::uuid;operation:=d->>'action';target:=case when operation in('technician','activate') then (d->>'id')::uuid else (d->>'request')::uuid end;
 if k is null or target is null or (d->>'organization')::uuid is distinct from p_org or operation is null or operation not in('technician','assign','activate') or jsonb_typeof(d->'revision') is distinct from 'number' then raise exception 'VALIDATION';end if;
 if operation='technician' and ((select count(*) from jsonb_object_keys(d))<>6 or exists(select 1 from jsonb_object_keys(d) x where x not in('organization','id','key','revision','profile','action'))) then raise exception 'VALIDATION';end if;
 if operation='activate' and ((select count(*) from jsonb_object_keys(d))<>6 or exists(select 1 from jsonb_object_keys(d) x where x not in('organization','id','key','revision','action','reviewed')) or d->'reviewed' is distinct from 'true'::jsonb) then raise exception 'VALIDATION';end if;
 if operation='assign' and ((select count(*) from jsonb_object_keys(d))<>7 or exists(select 1 from jsonb_object_keys(d) x where x not in('organization','request','key','revision','technician','note','action'))) then raise exception 'VALIDATION';end if;
 ns:='TeamCommand:'||auth.uid()::text;f:=encode(sha256(convert_to(p_body,'UTF8')),'hex');perform pg_advisory_xact_lock(hashtextextended(p_org::text||ns||k::text,0));select * into prior from private.command_receipts where organization_id=p_org and command=ns and key=k::text;
 if found then if prior.fingerprint<>f then raise exception 'IDEMPOTENCY_CONFLICT';end if;if prior.result->>'outcome'='not_applied' then raise exception 'ATTEMPT_CLOSED';end if;return prior.result;end if;
 if operation='activate' then saved:=private.activate_technician(p_org,target,(d->>'revision')::integer,true);elsif operation='technician' then saved:=public.save_technician(p_org,target,(d->>'revision')::integer,d->'profile',k);else saved:=public.assign_lead(p_org,target,(d->>'revision')::integer,(d->>'technician')::uuid,d->>'note',k);end if;
 r:=jsonb_build_object('organization',p_org,'key',k,'id',target,'revision',(saved->>'revision')::integer,'action',operation,'fingerprint',f,'outcome','saved');insert into private.command_receipts values(p_org,ns,k::text,f,r,now());return r;
end $$;
create function public.team_resolve(p_org uuid,p_key uuid,p_id uuid,p_operation text,p_fingerprint text) returns jsonb language plpgsql security definer set search_path='' as $$
declare ns text;prior private.command_receipts;r jsonb;begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or p_id is null or p_operation is null or p_operation not in('technician','assign','activate') or p_fingerprint is null or p_fingerprint!~'^[a-f0-9]{64}$' then raise exception 'VALIDATION';end if;
 ns:='TeamCommand:'||auth.uid()::text;perform pg_advisory_xact_lock(hashtextextended(p_org::text||ns||p_key::text,0));select * into prior from private.command_receipts where organization_id=p_org and command=ns and key=p_key::text;
 if found then if prior.fingerprint<>p_fingerprint or prior.result->>'id'<>p_id::text or prior.result->>'action'<>p_operation then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 r:=jsonb_build_object('organization',p_org,'key',p_key,'id',p_id,'revision',null,'action',p_operation,'fingerprint',p_fingerprint,'outcome','not_applied');insert into private.command_receipts values(p_org,ns,p_key::text,p_fingerprint,r,now());return r;
end $$;
revoke all on function public.team_command(uuid,text),public.team_resolve(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.team_command(uuid,text),public.team_resolve(uuid,uuid,uuid,text,text) to authenticated;
create function public.office_request_page(p_org uuid,p_page integer,p_filter text,p_query text,p_assignee text,p_selected uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare items jsonb;assignments jsonb;techs jsonb;n integer;needs integer;ids uuid[];begin
 if not private.staff(p_org,array['owner','admin','dispatcher']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_page is null or p_page not between 0 and 100000 or p_filter is null or p_filter not in('review','all','closed') or p_query is null or length(p_query)>100 or p_assignee is null or (p_assignee not in('all','owner') and p_assignee!~'^[a-fA-F0-9-]{36}$') then raise exception 'VALIDATION';end if;
 select count(*) into needs from public.service_requests where organization_id=p_org and status in('submitted','reviewing');
 select count(*),array_agg(id order by created_at desc,id) into n,ids from public.service_requests r where r.organization_id=p_org and
 ((p_selected is not null and r.id=p_selected) or (p_selected is null and r.recurring_series_id is null and
 (p_filter='all' or (p_filter='review' and r.status in('submitted','reviewing','quoted')) or (p_filter='closed' and r.status in('declined','canceled'))) and
 (p_query='' or position(lower(p_query) in lower(concat_ws(' ',r.original_submission->>'name',r.original_submission->>'street',r.original_submission->>'city',r.original_submission->>'email',r.original_submission->>'phone')))>0) and
 (p_assignee='all' or (p_assignee='owner' and not exists(select 1 from private.lead_assignments a where a.organization_id=p_org and a.request_id=r.id and a.technician_id is not null)) or exists(select 1 from private.lead_assignments a where a.organization_id=p_org and a.request_id=r.id and a.technician_id::text=p_assignee))));
 ids:=coalesce(ids[(p_page*20+1):(p_page*20+20)],'{}');
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'customer_id',r.customer_id,'status',r.status,'revision',r.revision,'created_at',r.created_at,'original_submission',r.original_submission,'appointments',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'request_id',a.request_id,'job_id',a.job_id,'status',a.status,'revision',a.revision,'start_at',a.start_at,'end_at',a.end_at,'arrival_at',a.arrival_at,'expires_at',a.expires_at,'replaces_id',a.replaces_id,'customer_response',a.customer_response) order by a.start_at,a.id),'[]') from public.appointments a where a.organization_id=p_org and a.request_id=r.id)) order by r.created_at desc,r.id),'[]') into items from public.service_requests r where r.organization_id=p_org and r.id=any(ids);
 select coalesce(jsonb_agg(jsonb_build_object('request',r.id,'technician',a.technician_id,'name',coalesce(t.name,'Owner'),'archived',coalesce(t.archived,false)) order by r.id),'[]') into assignments from public.service_requests r left join private.lead_assignments a on a.organization_id=r.organization_id and a.request_id=r.id left join private.team_technicians t on t.organization_id=a.organization_id and t.id=a.technician_id where r.organization_id=p_org and r.id=any(ids);
 if (select count(*) from private.team_technicians where organization_id=p_org)>200 then raise exception 'CAPACITY_REVIEW';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id),'[]') into techs from private.team_technicians where organization_id=p_org;
 return jsonb_build_object('organization',p_org,'page',p_page,'total',n,'needsReview',needs,'requests',items,'assignments',assignments,'technicians',techs);
end $$;
revoke all on function public.office_request_page(uuid,integer,text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.office_request_page(uuid,integer,text,text,text,uuid) to authenticated;



do $migration$
declare d text;old text;begin
 d:=pg_get_functiondef('private.save_invoice_labor(uuid,uuid,integer,jsonb,text)'::regprocedure);
 old:='if not private.staff(p_org,array[''owner'',''admin'']) then';if strpos(d,old)=0 then raise exception 'field labor permission baseline changed';end if;
 d:=replace(d,old,'if not private.labor_editor(p_org,p_job) then');
 old:='select * into j from public.jobs where organization_id=p_org and id=p_job for update;';if strpos(d,old)=0 then raise exception 'field labor lock baseline changed';end if;
 execute replace(d,old,old||' if not private.labor_editor(p_org,p_job) then raise exception ''FORBIDDEN'' using errcode=''42501'';end if;');
end $migration$;
