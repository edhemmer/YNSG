-- Demand reporting from retained requests; never infer customer identity or marketing consent.
create index if not exists service_requests_customer_history on public.service_requests(organization_id,customer_id,created_at desc,id);
create function private.owner_customer_service_history(p_org uuid,p_customer uuid default null,p_query text default '',p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_query is null or length(p_query)>100 or p_page is null or p_page not between 0 and 10000 then raise exception 'VALIDATION';end if;
 if p_customer is not null and not exists(select 1 from public.customers where organization_id=p_org and id=p_customer) then raise exception 'NOT_FOUND';end if;
 with requests as materialized (
  select r.id,r.customer_id,r.created_at,r.original_submission,
   (r.recurring_series_id is not null or coalesce(r.original_submission->>'recurringVisit','false')='true') generated
  from public.service_requests r where r.organization_id=p_org and (p_customer is null or r.customer_id=p_customer)
 ), jobs as materialized (
  select distinct r.id,r.customer_id,r.created_at,
   case when lower(coalesce(j->>'service','')) in('leaf cleanup','leaf clean-up','leaf management') then 'Lawn care'
        when j->>'service' in('Home jobs','Home tasks') then 'Help around the home'
        else coalesce(nullif(left(j->>'service',80),''),'Unspecified service') end service,
   case when lower(coalesce(j->>'task',j->>'service','')) in('leaf cleanup','leaf clean-up','leaf management') then 'Leaf management'
        else coalesce(nullif(left(j->>'task',120),''),'Unspecified job') end task
  from requests r cross join lateral jsonb_array_elements(case when jsonb_typeof(r.original_submission->'services')='array' then r.original_submission->'services' else jsonb_build_array(jsonb_build_object('service',r.original_submission->>'service','task',r.original_submission->>'task')) end) j
  where not r.generated
 ), matches as materialized (
  select c.id,c.display_name,c.archived_at from public.customers c where c.organization_id=p_org and (p_customer is null or c.id=p_customer)
   and (trim(p_query)='' or position(lower(trim(p_query)) in lower(c.display_name))>0 or exists(select 1 from jobs j where j.customer_id=c.id and position(lower(trim(p_query)) in lower(j.service||' '||j.task))>0))
 ), page as (
  select * from matches order by display_name,id offset p_page*20 limit 21
 ), items as (
  select p.id,p.display_name,jsonb_build_object('customerId',p.id,'name',p.display_name,'archived',p.archived_at is not null,
   'requestCount',(select count(*) from requests r where r.customer_id=p.id and not r.generated),
   'generatedVisits',(select count(*) from requests r where r.customer_id=p.id and r.generated),
   'firstRequestedAt',(select min(created_at) from requests r where r.customer_id=p.id and not r.generated),
   'lastRequestedAt',(select max(created_at) from requests r where r.customer_id=p.id and not r.generated),
   'categories',coalesce((select jsonb_agg(s.data order by s.n desc,s.service) from (select j.service,count(distinct j.id) n,jsonb_build_object('service',j.service,'requestCount',count(distinct j.id),'lastRequestedAt',max(j.created_at)) data from jobs j where j.customer_id=p.id group by j.service order by count(distinct j.id) desc,j.service limit 200) s),'[]'::jsonb),
   'services',coalesce((select jsonb_agg(s.data order by s.n desc,s.service,s.task) from (
    select j.service,j.task,count(*) n,jsonb_build_object('service',j.service,'task',j.task,'requestCount',count(*),'lastRequestedAt',max(j.created_at)) data
    from jobs j where j.customer_id=p.id group by j.service,j.task order by count(*) desc,j.service,j.task limit 200
   ) s),'[]'::jsonb),
   'servicesMore',(select count(*)>200 from (select distinct service,task from jobs where customer_id=p.id) x)) data
  from page p
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(data order by display_name,id) from (select * from items order by display_name,id limit 20) x),'[]'::jsonb),
  'page',p_page,'hasMore',(select count(*)>20 from page),'matchingCustomers',(select count(*) from matches),
  'unlinkedRequests',(select count(*) from requests where customer_id is null and not generated),
  'linkedRequests',(select count(*) from requests where customer_id is not null and not generated),
  'generatedVisits',(select count(*) from requests where generated),'checkedAt',statement_timestamp()) into result;
 return result;
end$$;
create function public.owner_customer_service_history(p_org uuid,p_customer uuid default null,p_query text default '',p_page integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$select private.owner_customer_service_history(p_org,p_customer,p_query,p_page)$$;
revoke all on function private.owner_customer_service_history(uuid,uuid,text,integer),public.owner_customer_service_history(uuid,uuid,text,integer) from public,anon,service_role;
grant execute on function private.owner_customer_service_history(uuid,uuid,text,integer),public.owner_customer_service_history(uuid,uuid,text,integer) to authenticated;
