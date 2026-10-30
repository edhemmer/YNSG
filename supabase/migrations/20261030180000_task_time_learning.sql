-- Operational task evidence; never prices, approvals, invoice lines or automatic charges.
create table private.job_task_plans(
 organization_id uuid not null,id uuid not null default gen_random_uuid(),job_id uuid not null,
 service text not null check(length(service) between 2 and 80),name text not null check(length(name) between 2 and 120),
 planned_minutes integer not null check(planned_minutes between 1 and 1440),revision integer not null default 1 check(revision>0),
 finished_at timestamptz,allocated_cents integer not null default 0 check(allocated_cents>=0),
 primary key(organization_id,id),unique(organization_id,job_id,service,name),foreign key(organization_id,job_id) references public.jobs(organization_id,id)
);
create index task_plans_job on private.job_task_plans(organization_id,job_id);
create table private.job_task_sessions(
 organization_id uuid not null,id uuid not null default gen_random_uuid(),task_id uuid not null,actor_id uuid not null references auth.users(id),
 started_at timestamptz not null,ended_at timestamptz,reviewed_start timestamptz,reviewed_end timestamptz,reason text not null default '',
 primary key(organization_id,id),foreign key(organization_id,task_id) references private.job_task_plans(organization_id,id),
 check(ended_at is null or ended_at>=started_at),check((reviewed_start is null and reviewed_end is null) or (ended_at is not null and reviewed_start is not null and reviewed_end is not null and reviewed_end>=reviewed_start and reviewed_end-reviewed_start<=interval '24 hours'))
);
create unique index task_one_active_operator on private.job_task_sessions(organization_id,actor_id) where ended_at is null;
create unique index task_one_active_task on private.job_task_sessions(organization_id,task_id) where ended_at is null;
create index task_sessions_task on private.job_task_sessions(organization_id,task_id,started_at,id);
create index task_sessions_period on private.job_task_sessions(organization_id,reviewed_start,reviewed_end);
create table private.job_task_reviews(
 organization_id uuid not null,id uuid not null default gen_random_uuid(),task_id uuid not null,actor_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),action text not null,before_record jsonb not null,after_record jsonb not null,reason text not null,
 primary key(organization_id,id),foreign key(organization_id,task_id) references private.job_task_plans(organization_id,id)
);
alter table private.job_task_plans enable row level security;
alter table private.job_task_sessions enable row level security;
alter table private.job_task_reviews enable row level security;
create policy task_plans_owner_read on private.job_task_plans for select to authenticated using(private.staff(organization_id,array['owner','admin']));
create policy task_sessions_owner_read on private.job_task_sessions for select to authenticated using(private.staff(organization_id,array['owner','admin']));
create policy task_reviews_owner_read on private.job_task_reviews for select to authenticated using(private.staff(organization_id,array['owner','admin']));
revoke all on private.job_task_plans,private.job_task_sessions,private.job_task_reviews from public,anon,authenticated,service_role;

create function private.task_time_command(p_org uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.jobs;t private.job_task_plans;s private.job_task_sessions;prior private.command_receipts;
 a text:=p_data->>'action';k text:=p_data->>'key';f text;r jsonb;moment timestamptz;lo timestamptz;hi timestamptz;before_value jsonb;labor bigint;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4000 or k is null or length(k) not between 16 and 128 or a is null or a not in('plan','start','pause','finish','review','allocate')
 or exists(select 1 from jsonb_object_keys(p_data) x where x not in('organization','job','jobRevision','key','action','task','revision','service','name','plannedMinutes','session','startedAt','endedAt','reason','cents'))
 or p_data->>'organization' is distinct from p_org::text then raise exception 'VALIDATION';end if;
 f:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_data)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':task-time:'||k,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='TaskTime' and key=k;
 if found then if prior.fingerprint<>f then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 -- Serialize switches and interval corrections for the entire company, including other admins.
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':task-time',0));
 select * into j from public.jobs where organization_id=p_org and id=(p_data->>'job')::uuid for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if j.revision is distinct from (p_data->>'jobRevision')::integer then raise exception 'STALE_REVISION';end if;
 if not exists(select 1 from public.approvals where organization_id=p_org and quote_id=j.quote_id and version=j.approved_version) then raise exception 'APPROVAL_REQUIRED';end if;
 moment:=clock_timestamp();
 if a='plan' then
  if j.status in('completed','canceled') or length(coalesce(p_data->>'service','')) not between 2 and 80 or length(coalesce(p_data->>'name','')) not between 2 and 120 or coalesce((p_data->>'plannedMinutes')::integer,0) not between 1 and 1440 then raise exception 'VALIDATION';end if;
  if p_data->>'task' is not null then
   select * into t from private.job_task_plans where organization_id=p_org and id=(p_data->>'task')::uuid and job_id=j.id for update;
   if not found then raise exception 'NOT_FOUND';end if;
   if t.revision is distinct from (p_data->>'revision')::integer then raise exception 'STALE_REVISION';end if;
   if exists(select 1 from private.job_task_sessions where organization_id=p_org and task_id=t.id) or t.finished_at is not null then raise exception 'ESTIMATE_LOCKED';end if;
   if t.service is distinct from p_data->>'service' or t.name is distinct from p_data->>'name' or length(coalesce(p_data->>'reason','')) not between 10 and 500 then raise exception 'VALIDATION';end if;
   before_value:=to_jsonb(t);
   update private.job_task_plans set planned_minutes=(p_data->>'plannedMinutes')::integer,revision=revision+1 where organization_id=p_org and id=t.id returning * into t;
   insert into private.job_task_reviews(organization_id,task_id,actor_id,action,before_record,after_record,reason) values(p_org,t.id,auth.uid(),a,before_value,to_jsonb(t),p_data->>'reason');
  else
   if (select count(*) from private.job_task_plans where organization_id=p_org and job_id=j.id)>=30 then raise exception 'TASK_LIMIT';end if;
   if exists(select 1 from private.job_task_plans where organization_id=p_org and job_id=j.id and service=p_data->>'service' and name=p_data->>'name') then raise exception 'TASK_EXISTS';end if;
   insert into private.job_task_plans(organization_id,job_id,service,name,planned_minutes) values(p_org,j.id,p_data->>'service',p_data->>'name',(p_data->>'plannedMinutes')::integer) returning * into t;
  end if;
 else
  select * into t from private.job_task_plans where organization_id=p_org and id=(p_data->>'task')::uuid and job_id=j.id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if t.revision is distinct from (p_data->>'revision')::integer then raise exception 'STALE_REVISION';end if;
  if a in('start','pause') and j.status not in('working','paused') then raise exception 'TRANSITION';end if;
  if a='start' then
   if j.status<>'working' or t.finished_at is not null then raise exception 'TRANSITION';end if;
   if exists(select 1 from private.job_task_sessions s2 join private.job_task_plans t2 on t2.organization_id=s2.organization_id and t2.id=s2.task_id where s2.organization_id=p_org and s2.actor_id=auth.uid() and s2.ended_at is null and t2.job_id<>j.id) then raise exception 'OTHER_JOB_ACTIVE';end if;
   if exists(select 1 from private.job_task_sessions where organization_id=p_org and task_id=t.id and ended_at is null) then raise exception 'ALREADY_RUNNING';end if;
   -- Switching tasks is one transaction at one server timestamp. All closed intervals await review.
   update private.job_task_sessions set ended_at=moment where organization_id=p_org and actor_id=auth.uid() and ended_at is null;
   insert into private.job_task_sessions(organization_id,task_id,actor_id,started_at) values(p_org,t.id,auth.uid(),moment);
  elsif a in('pause','finish') then
   update private.job_task_sessions set ended_at=moment where organization_id=p_org and task_id=t.id and actor_id=auth.uid() and ended_at is null;
   if a='pause' and not found then raise exception 'NOT_RUNNING';end if;
   if exists(select 1 from private.job_task_sessions where organization_id=p_org and task_id=t.id and ended_at is null) then raise exception 'OTHER_OPERATOR_ACTIVE';end if;
   if a='finish' then
    if j.status='canceled' then raise exception 'TRANSITION';end if;
    if not exists(select 1 from private.job_task_sessions where organization_id=p_org and task_id=t.id) or t.finished_at is not null then raise exception 'TRANSITION';end if;
    update private.job_task_plans set finished_at=(select max(ended_at) from private.job_task_sessions where organization_id=p_org and task_id=t.id) where organization_id=p_org and id=t.id;
   end if;
  elsif a='review' then
   if length(coalesce(p_data->>'reason','')) not between 10 and 500 then raise exception 'REVIEW_REQUIRED';end if;
   select * into s from private.job_task_sessions where organization_id=p_org and id=(p_data->>'session')::uuid and task_id=t.id for update;
   if not found or s.ended_at is null then raise exception 'STOP_FIRST';end if;
   lo:=(p_data->>'startedAt')::timestamptz;hi:=(p_data->>'endedAt')::timestamptz;
   if lo is null or hi is null or hi<lo or hi>moment or hi-lo>interval '24 hours' then raise exception 'VALIDATION';end if;
   if hi>lo and exists(select 1 from private.job_task_sessions s2 where s2.organization_id=p_org and s2.actor_id=s.actor_id and s2.id<>s.id and coalesce(s2.reviewed_start,s2.started_at)<hi and coalesce(s2.reviewed_end,s2.ended_at,'infinity'::timestamptz)>lo) then raise exception 'TIME_OVERLAP';end if;
   before_value:=to_jsonb(s);
   update private.job_task_sessions set reviewed_start=lo,reviewed_end=hi,reason=p_data->>'reason' where organization_id=p_org and id=s.id returning * into s;
   insert into private.job_task_reviews(organization_id,task_id,actor_id,action,before_record,after_record,reason) values(p_org,t.id,auth.uid(),a,before_value,to_jsonb(s),p_data->>'reason');
  elsif a='allocate' then
   if length(coalesce(p_data->>'reason','')) not between 10 and 500 or coalesce((p_data->>'cents')::bigint,-1) not between 0 and 999999999 then raise exception 'VALIDATION';end if;
   select coalesce(sum(l.credit_cents),0) into labor from public.invoices i join public.journal_entries e on e.organization_id=i.organization_id and e.source_kind='invoice' and e.source_id=i.id join public.journal_lines l on l.organization_id=e.organization_id and l.entry_id=e.id and l.account='labor_revenue' where i.organization_id=p_org and i.job_id=j.id;
   if not exists(select 1 from public.invoices where organization_id=p_org and job_id=j.id) or (p_data->>'cents')::bigint+(select coalesce(sum(allocated_cents),0) from private.job_task_plans where organization_id=p_org and job_id=j.id and id<>t.id)>labor then raise exception 'ALLOCATION_EXCEEDS_LABOR';end if;
   before_value:=to_jsonb(t);
   update private.job_task_plans set allocated_cents=(p_data->>'cents')::integer where organization_id=p_org and id=t.id returning * into t;
   insert into private.job_task_reviews(organization_id,task_id,actor_id,action,before_record,after_record,reason) values(p_org,t.id,auth.uid(),a,before_value,to_jsonb(t),p_data->>'reason');
  end if;
  update private.job_task_plans set revision=revision+1 where organization_id=p_org and id=t.id returning * into t;
 end if;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'task_time.'||a,t.id,t.revision,gen_random_uuid());
 r:=jsonb_build_object('organization',p_org,'key',k,'job',j.id,'task',t.id,'revision',t.revision,'action',a);
 insert into private.command_receipts values(p_org,'TaskTime',k,f,r,now());return r;
end $$;

create function private.task_time_stop_on_visit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status is distinct from old.status and new.status<>'working' then
  update private.job_task_sessions s set ended_at=clock_timestamp() from private.job_task_plans t where t.organization_id=new.organization_id and t.job_id=new.id and s.organization_id=t.organization_id and s.task_id=t.id and s.ended_at is null;
 end if;return new;
end $$;
create trigger task_time_stop_on_visit_change after update on public.jobs for each row execute function private.task_time_stop_on_visit_change();
revoke all on function private.task_time_stop_on_visit_change() from public,anon,authenticated,service_role;

create function private.owner_task_time(p_org uuid,p_job uuid default null,p_month text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j public.jobs;zone text;lo timestamptz;hi timestamptz;gross bigint;allocated bigint;items jsonb;result jsonb;queue jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if (p_job is null)=(p_month is null) then raise exception 'VALIDATION';end if;
 if p_job is not null then
  select * into j from public.jobs where organization_id=p_org and id=p_job;if not found then raise exception 'NOT_FOUND';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'revision',t.revision,'service',t.service,'name',t.name,'plannedMinutes',t.planned_minutes,'finishedAt',t.finished_at,'allocatedCents',t.allocated_cents,'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'startedAt',s.started_at,'endedAt',s.ended_at,'reviewedStart',s.reviewed_start,'reviewedEnd',s.reviewed_end,'reason',s.reason,'reviewed',s.reviewed_start is not null) order by s.started_at,s.id) from private.job_task_sessions s where s.organization_id=p_org and s.task_id=t.id),'[]')) order by t.service,t.name,t.id),'[]') into items from private.job_task_plans t where t.organization_id=p_org and t.job_id=p_job;
  return jsonb_build_object('organization',p_org,'actor',auth.uid(),'job',j.id,'jobRevision',j.revision,'status',j.status,'checkedAt',now(),'tasks',items);
 end if;
 if p_month !~ '^20[2-9][0-9]-(0[1-9]|1[0-2])$' then raise exception 'VALIDATION';end if;
 select timezone into zone from public.organizations where id=p_org;
 lo:=(p_month||'-01')::timestamp at time zone zone;hi:=((p_month||'-01')::date+interval '1 month') at time zone zone;
 select coalesce(sum(l.credit_cents),0) into gross from public.invoices i join public.journal_entries e on e.organization_id=i.organization_id and e.source_kind='invoice' and e.source_id=i.id join public.journal_lines l on l.organization_id=e.organization_id and l.entry_id=e.id and l.account='labor_revenue' where i.organization_id=p_org and i.issued_at>=lo and i.issued_at<hi;
 select coalesce(sum(t.allocated_cents),0) into allocated from private.job_task_plans t join public.invoices i on i.organization_id=t.organization_id and i.job_id=t.job_id where t.organization_id=p_org and i.issued_at>=lo and i.issued_at<hi;
 with metrics as (
  select t.*,
   coalesce((select sum(extract(epoch from least(s.reviewed_end,hi)-greatest(s.reviewed_start,lo))) from private.job_task_sessions s where s.organization_id=p_org and s.task_id=t.id and s.reviewed_start<hi and s.reviewed_end>lo),0) seconds,
   (t.finished_at is not null and (select max(s.reviewed_end) from private.job_task_sessions s where s.organization_id=p_org and s.task_id=t.id)>=lo and (select max(s.reviewed_end) from private.job_task_sessions s where s.organization_id=p_org and s.task_id=t.id)<hi and exists(select 1 from public.jobs j2 where j2.organization_id=p_org and j2.id=t.job_id and j2.status<>'canceled') and exists(select 1 from private.job_task_sessions s where s.organization_id=p_org and s.task_id=t.id and s.reviewed_end>s.reviewed_start) and not exists(select 1 from private.job_task_sessions s where s.organization_id=p_org and s.task_id=t.id and s.reviewed_start is null)) qualified,
   coalesce((select sum(extract(epoch from s.reviewed_end-s.reviewed_start)) from private.job_task_sessions s where s.organization_id=p_org and s.task_id=t.id),0) full_seconds,
   case when exists(select 1 from public.invoices i where i.organization_id=p_org and i.job_id=t.job_id and i.issued_at>=lo and i.issued_at<hi) then t.allocated_cents else 0 end billed
  from private.job_task_plans t where t.organization_id=p_org
 ), grouped as (
  select service,name,sum(seconds) seconds,count(*) filter(where qualified) samples,sum(planned_minutes) filter(where qualified) planned,sum(full_seconds) filter(where qualified) actual,percentile_cont(.5) within group(order by full_seconds/60.0) filter(where qualified) median,sum(billed) billed
  from metrics group by service,name having sum(seconds)>0 or bool_or(qualified) or sum(billed)>0
 ) select coalesce(jsonb_agg(jsonb_build_object('service',service,'name',name,'reviewedSeconds',seconds,'completedTasks',samples,'plannedMinutes',coalesce(planned,0),'completedSeconds',coalesce(actual,0),'samples',samples,'medianMinutes',median,'allocatedCents',billed) order by service,name),'[]') into items from (select * from grouped order by service,name limit 501) bounded;
 select coalesce(jsonb_agg(jsonb_build_object('job',job_id,'revision',revision,'tasks',names) order by job_id),'[]') into queue from (
 select j3.id job_id,j3.revision,jsonb_agg(distinct t3.name) names from public.jobs j3 join private.job_task_plans t3 on t3.organization_id=j3.organization_id and t3.job_id=j3.id
 where j3.organization_id=p_org and exists(select 1 from private.job_task_sessions s3 where s3.organization_id=p_org and s3.task_id=t3.id and s3.reviewed_start is null and (s3.ended_at is null or (s3.started_at<hi and s3.ended_at>lo)))
 group by j3.id,j3.revision order by j3.id limit 31) q;
 result:=jsonb_build_object('organization',p_org,'reviewJobs',case when jsonb_array_length(queue)>30 then queue-30 else queue end,'reviewJobsMore',jsonb_array_length(queue)>30,'month',p_month,'timezone',zone,'checkedAt',now(),'grossLaborCents',gross,'unallocatedCents',greatest(0,gross-allocated),'unreviewedSessions',(select count(*) from private.job_task_sessions where organization_id=p_org and reviewed_start is null and ended_at is not null and started_at<hi and ended_at>lo),'activeSessions',(select count(*) from private.job_task_sessions where organization_id=p_org and ended_at is null),'items',case when jsonb_array_length(items)>500 then items-500 else items end,'more',jsonb_array_length(items)>500);return result;
end $$;
create function public.task_time_command(p_org uuid,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.task_time_command(p_org,p_data)$$;
create function public.owner_task_time(p_org uuid,p_job uuid default null,p_month text default null) returns jsonb language sql security invoker set search_path='' as $$select private.owner_task_time(p_org,p_job,p_month)$$;
revoke all on function private.task_time_command(uuid,jsonb),public.task_time_command(uuid,jsonb),private.owner_task_time(uuid,uuid,text),public.owner_task_time(uuid,uuid,text) from public,anon,service_role;
grant execute on function private.task_time_command(uuid,jsonb),public.task_time_command(uuid,jsonb),private.owner_task_time(uuid,uuid,text),public.owner_task_time(uuid,uuid,text) to authenticated;

-- Latest explicit owner request adds an intake option. Review remains mandatory; no automatic approval.
insert into public.catalog_services(organization_id,name,scope,exclusions,compliance,pricing_mode)
select id,'Cleanout & removal','Manageable household items, boxes and clutter from garages, basements and storage areas. Disposal fees may apply and are reviewed before proceeding.','No hazardous materials, large appliances or excessively heavy items. Scope, access and disposal plan require review.','review','hourly' from public.organizations where slug='ynsg'
on conflict(organization_id,name) do nothing;
