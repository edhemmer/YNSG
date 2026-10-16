-- WEB-08: owner-confirmed mileage is a trip log, NOT a tax deduction or customer charge.
create table private.mileage_trips(
 organization_id uuid not null references public.organizations(id),id uuid not null,
 actor_id uuid not null references auth.users(id),request_key uuid not null,
 trip_date date not null,purpose text not null check(length(purpose) between 5 and 300),
 origin text not null check(length(origin) between 3 and 250),
 destination text not null check(length(destination) between 3 and 250),
 vehicle_label text not null check(length(vehicle_label) between 2 and 100),
 odometer_start integer not null check(odometer_start between 0 and 9999999),
 odometer_end integer not null check(odometer_end between 1 and 9999999 and odometer_end>odometer_start),
 business_use text not null check(business_use in('business','personal','mixed-review')),
 recorded_source text not null check(recorded_source in('manual-odometer','verified-trip-log')),
 job_id uuid,notes text not null default '' check(length(notes)<=500),
 created_at timestamptz not null default now(),
 reversed_at timestamptz,reversed_by uuid references auth.users(id),reversal_key uuid,reversal_reason text,
 primary key(organization_id,id),unique(organization_id,actor_id,request_key),
 foreign key(organization_id,job_id) references public.jobs(organization_id,id),
 check((reversed_at is null and reversed_by is null and reversal_key is null and reversal_reason is null) or
       (reversed_at is not null and reversed_by is not null and reversal_key is not null and length(reversal_reason) between 10 and 300))
);
create index mileage_trip_dates on private.mileage_trips(organization_id,trip_date desc,id);
create index mileage_trip_jobs on private.mileage_trips(organization_id,job_id) where job_id is not null;
create index mileage_trip_actor on private.mileage_trips(actor_id);
create index mileage_trip_reversal_actor on private.mileage_trips(reversed_by) where reversed_by is not null;
alter table private.mileage_trips enable row level security;
revoke all on private.mileage_trips from public,anon,authenticated,service_role;
create policy mileage_trips_deny on private.mileage_trips to anon,authenticated using(false) with check(false);

create function public.record_mileage_trip(p_org uuid,p_id uuid,p_key uuid,p_date date,p_purpose text,p_origin text,p_destination text,p_vehicle text,p_start integer,p_end integer,p_usage text,p_source text,p_job uuid,p_notes text) returns jsonb
language plpgsql security definer set search_path='' as $record$
declare found_trip private.mileage_trips%rowtype; miles integer;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_key is null or p_date is null or p_date>current_date or
    p_purpose is null or length(trim(p_purpose)) not between 5 and 300 or p_origin is null or length(trim(p_origin)) not between 3 and 250 or
    p_destination is null or length(trim(p_destination)) not between 3 and 250 or lower(trim(p_origin))=lower(trim(p_destination)) or
    p_vehicle is null or length(trim(p_vehicle)) not between 2 and 100 or p_start is null or p_end is null or
    p_start<0 or p_end<=p_start or p_end>9999999 or p_usage not in('business','personal','mixed-review') or
    p_source not in('manual-odometer','verified-trip-log') or p_notes is null or length(p_notes)>500 then raise exception 'VALIDATION';end if;
 if p_job is not null and not exists(select 1 from public.jobs where organization_id=p_org and id=p_job) then raise exception 'JOB_NOT_FOUND';end if;
 -- One actor-bound key and trip ID; retries cannot create new rows or alter original facts.
 select * into found_trip from private.mileage_trips where organization_id=p_org and
 ((actor_id=auth.uid() and request_key=p_key) or id=p_id) for update;
 if found then
  if found_trip.id<>p_id or found_trip.actor_id<>auth.uid() or found_trip.request_key<>p_key or
  found_trip.trip_date<>p_date or found_trip.purpose<>trim(p_purpose) or found_trip.origin<>trim(p_origin) or
  found_trip.destination<>trim(p_destination) or found_trip.vehicle_label<>trim(p_vehicle) or
  found_trip.odometer_start<>p_start or found_trip.odometer_end<>p_end or
  found_trip.business_use<>p_usage or found_trip.recorded_source<>p_source or
  found_trip.job_id is distinct from p_job or found_trip.notes<>trim(p_notes)
  then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 else
  -- Lock the specific vehicle/day to prevent concurrently accepted overlapping business intervals.
  perform pg_advisory_xact_lock(hashtextextended(p_org::text||p_date::text||lower(trim(p_vehicle)),0));
  if p_usage='business' and exists(select 1 from private.mileage_trips where organization_id=p_org and trip_date=p_date and
    lower(vehicle_label)=lower(trim(p_vehicle)) and business_use='business' and reversed_at is null
    and p_start<odometer_end and odometer_start<p_end) then raise exception 'OVERLAPPING_MILEAGE';end if;
  insert into private.mileage_trips(organization_id,id,actor_id,request_key,trip_date,purpose,origin,destination,vehicle_label,odometer_start,odometer_end,business_use,recorded_source,job_id,notes)
  values(p_org,p_id,auth.uid(),p_key,p_date,trim(p_purpose),trim(p_origin),trim(p_destination),trim(p_vehicle),p_start,p_end,p_usage,p_source,p_job,trim(p_notes));
  insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
  values(p_org,auth.uid(),'mileage.trip_recorded',p_id,1,gen_random_uuid());
 end if;
 miles:=p_end-p_start;
 return jsonb_build_object('id',p_id,'miles',miles,'businessMiles',case when p_usage='business' then miles else 0 end,
 'reversed',found and found_trip.reversed_at is not null);
end$record$;

create function public.reverse_mileage_trip(p_org uuid,p_id uuid,p_key uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $reverse$
declare trip private.mileage_trips%rowtype;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_key is null or p_reason is null or length(trim(p_reason)) not between 10 and 300 then raise exception 'VALIDATION';end if;
 select * into trip from private.mileage_trips where organization_id=p_org and id=p_id for update;
 if not found then raise exception 'NOT_FOUND' using errcode='42501';end if;
 if trip.reversed_at is null then
  update private.mileage_trips set reversed_at=now(),reversed_by=auth.uid(),reversal_key=p_key,reversal_reason=trim(p_reason) where organization_id=p_org and id=p_id;
  insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
  values(p_org,auth.uid(),'mileage.trip_reversed',p_id,1,gen_random_uuid());
 elsif trip.reversal_key<>p_key or trip.reversed_by<>auth.uid() or trip.reversal_reason<>trim(p_reason) then raise exception 'ALREADY_REVERSED';end if;
 return jsonb_build_object('id',p_id,'reversed',true);
end$reverse$;

create function public.mileage_activity(p_org uuid,p_from date,p_to date,p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $read$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_page is null or p_page not between 0 and 10000 or p_to-p_from>366 then raise exception 'VALIDATION';end if;
 return jsonb_build_object('from',p_from,'to',p_to,'page',p_page,
 'businessMiles',coalesce((select sum(odometer_end-odometer_start) from private.mileage_trips where organization_id=p_org and trip_date between p_from and p_to and business_use='business' and reversed_at is null),0),
 'activeTrips',(select count(*) from private.mileage_trips where organization_id=p_org and trip_date between p_from and p_to and reversed_at is null),
 'trips',coalesce((select jsonb_agg(row_to_json(t) order by t.trip_date desc,t.id desc) from
 (select id,trip_date,purpose,origin,destination,vehicle_label,odometer_start,odometer_end,business_use,recorded_source,job_id,notes,created_at,reversed_at,reversal_reason
  from private.mileage_trips where organization_id=p_org and trip_date between p_from and p_to order by trip_date desc,id desc limit 51 offset p_page*50) t),'[]'::jsonb));
end$read$;
revoke all on function public.record_mileage_trip(uuid,uuid,uuid,date,text,text,text,text,integer,integer,text,text,uuid,text),
 public.reverse_mileage_trip(uuid,uuid,uuid,text),public.mileage_activity(uuid,date,date,integer) from public,anon,service_role;
grant execute on function public.record_mileage_trip(uuid,uuid,uuid,date,text,text,text,text,integer,integer,text,text,uuid,text),
 public.reverse_mileage_trip(uuid,uuid,uuid,text),public.mileage_activity(uuid,date,date,integer) to authenticated;
