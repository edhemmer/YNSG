-- Owner-only service valuation. Not part of public invoice snapshots.
create table if not exists private.invoice_owner_pricing (
 organization_id uuid not null,
 job_id uuid not null,
 job_revision integer not null check(job_revision>0),
 breakdown jsonb not null,
 created_by uuid not null,
 updated_at timestamptz not null default now(),
 primary key(organization_id,job_id),
 foreign key(organization_id,job_id) references public.jobs(organization_id,id)
);
alter table private.invoice_owner_pricing enable row level security;
revoke all on private.invoice_owner_pricing from public,anon,authenticated,service_role;
drop policy if exists invoice_owner_pricing_deny on private.invoice_owner_pricing;
create policy invoice_owner_pricing_deny on private.invoice_owner_pricing to anon,authenticated using(false) with check(false);

-- Immutable revisions keep historical calculations even when draft amounts change.
create table if not exists private.invoice_owner_pricing_history (
 organization_id uuid not null,
 job_id uuid not null,
 job_revision integer not null check(job_revision>0),
 breakdown jsonb not null,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 primary key(organization_id,job_id,job_revision),
 foreign key(organization_id,job_id) references public.jobs(organization_id,id)
);
alter table private.invoice_owner_pricing_history enable row level security;
revoke all on private.invoice_owner_pricing_history from public,anon,authenticated,service_role;
drop policy if exists invoice_owner_pricing_history_deny on private.invoice_owner_pricing_history;
create policy invoice_owner_pricing_history_deny on private.invoice_owner_pricing_history
 to anon,authenticated using(false) with check(false);

create or replace function private.validate_invoice_owner_pricing(p_breakdown jsonb,p_lines jsonb)
returns void language plpgsql set search_path='' as $body$
declare item jsonb; standard_total bigint:=0; billed_total bigint:=0; labor_total bigint:=0;
begin
 if jsonb_typeof(p_breakdown) is distinct from 'object'
  or jsonb_typeof(p_breakdown->'services') is distinct from 'array'
  or jsonb_array_length(p_breakdown->'services') not between 1 and 25
  or jsonb_typeof(p_breakdown->'reason') is distinct from 'string'
  or length(p_breakdown->>'reason')>500
  or exists(select 1 from jsonb_object_keys(p_breakdown) k where k not in ('services','reason'))
 then raise exception 'INVALID_OWNER_PRICING';end if;
 for item in select value from jsonb_array_elements(p_breakdown->'services') loop
  if jsonb_typeof(item) is distinct from 'object'
   or exists(select 1 from jsonb_object_keys(item) k where k not in ('description','method','standardCents','billedCents','minutes','hourlyRateCents'))
   or jsonb_typeof(item->'description') is distinct from 'string'
   or length(btrim(item->>'description')) not between 2 and 160
   or coalesce(item->>'method','') not in ('fixed','hourly')
   or coalesce(item->>'standardCents','') !~ '^(0|[1-9][0-9]*)$'
   or coalesce(item->>'billedCents','') !~ '^(0|[1-9][0-9]*)$'
  then raise exception 'INVALID_OWNER_PRICING';end if;
  if (item->>'standardCents')::numeric>999999999
    or (item->>'billedCents')::numeric>999999999
    or (item->>'billedCents')::bigint>(item->>'standardCents')::bigint
  then raise exception 'INVALID_OWNER_PRICING';end if;
  if item->>'method'='fixed' then
    if item ? 'minutes' or item ? 'hourlyRateCents' then raise exception 'INVALID_OWNER_PRICING';end if;
  else
    if coalesce(item->>'minutes','') !~ '^[1-9][0-9]*$'
      or coalesce(item->>'hourlyRateCents','') !~ '^(0|[1-9][0-9]*)$'
    then raise exception 'INVALID_OWNER_PRICING';end if;
    if (item->>'minutes')::numeric>1440 or (item->>'hourlyRateCents')::numeric>999999999
    then raise exception 'INVALID_OWNER_PRICING';end if;
    if floor(((item->>'minutes')::numeric*(item->>'hourlyRateCents')::numeric+30)/60)<>(item->>'standardCents')::numeric
    then raise exception 'INVALID_OWNER_PRICING';end if;
  end if;
  standard_total:=standard_total+(item->>'standardCents')::bigint;
  billed_total:=billed_total+(item->>'billedCents')::bigint;
 end loop;
 select coalesce(sum((value->>'chargedCents')::bigint),0) into labor_total from jsonb_array_elements(p_lines);
 if billed_total<>labor_total or standard_total>999999999 then raise exception 'OWNER_PRICING_TOTAL_MISMATCH';end if;
 if standard_total>billed_total and length(btrim(p_breakdown->>'reason'))<2 then raise exception 'OWNER_DISCOUNT_REASON_REQUIRED';end if;
end $body$;
revoke all on function private.validate_invoice_owner_pricing(jsonb,jsonb) from public,anon,authenticated,service_role;

create or replace function private.save_invoice_priced_labor(
 p_org uuid,p_job uuid,p_revision integer,p_lines jsonb,p_breakdown jsonb,p_key text
) returns jsonb language plpgsql security definer set search_path='' as $body$
declare result jsonb; current_revision integer; prior private.invoice_owner_pricing;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform private.validate_invoice_owner_pricing(p_breakdown,p_lines);
 result:=private.save_invoice_labor(p_org,p_job,p_revision,p_lines,p_key);
 select revision into current_revision from public.jobs where organization_id=p_org and id=p_job;
 if current_revision<>(result->>'revision')::integer then raise exception 'STALE_REVISION';end if;
 select * into prior from private.invoice_owner_pricing where organization_id=p_org and job_id=p_job for update;
 if found and prior.job_revision=(result->>'revision')::integer and prior.breakdown<>p_breakdown
 then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 insert into private.invoice_owner_pricing(organization_id,job_id,job_revision,breakdown,created_by)
 values(p_org,p_job,(result->>'revision')::integer,p_breakdown,auth.uid())
 on conflict(organization_id,job_id) do update set
 job_revision=excluded.job_revision,breakdown=excluded.breakdown,created_by=excluded.created_by,updated_at=now();
 insert into private.invoice_owner_pricing_history(organization_id,job_id,job_revision,breakdown,created_by)
 values(p_org,p_job,(result->>'revision')::integer,p_breakdown,auth.uid())
 on conflict(organization_id,job_id,job_revision) do nothing;
 if exists(select 1 from private.invoice_owner_pricing_history h
   where h.organization_id=p_org and h.job_id=p_job and h.job_revision=(result->>'revision')::integer
   and h.breakdown<>p_breakdown) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 return result;
end $body$;
revoke all on function private.save_invoice_priced_labor(uuid,uuid,integer,jsonb,jsonb,text) from public,anon,service_role;
grant execute on function private.save_invoice_priced_labor(uuid,uuid,integer,jsonb,jsonb,text) to authenticated;

create or replace function public.save_invoice_priced_labor(
 p_org uuid,p_job uuid,p_revision integer,p_lines jsonb,p_breakdown jsonb,p_key text
) returns jsonb language sql security invoker set search_path='' as $body$
 select private.save_invoice_priced_labor(p_org,p_job,p_revision,p_lines,p_breakdown,p_key)
$body$;
revoke all on function public.save_invoice_priced_labor(uuid,uuid,integer,jsonb,jsonb,text) from public,anon,service_role;
grant execute on function public.save_invoice_priced_labor(uuid,uuid,integer,jsonb,jsonb,text) to authenticated;

create or replace function private.invoice_owner_pricing_read(p_org uuid,p_job uuid)
returns jsonb language plpgsql security definer set search_path='' as $body$
declare snapshot jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select breakdown into snapshot from private.invoice_owner_pricing where organization_id=p_org and job_id=p_job;
 return snapshot;
end $body$;
revoke all on function private.invoice_owner_pricing_read(uuid,uuid) from public,anon,service_role;
grant execute on function private.invoice_owner_pricing_read(uuid,uuid) to authenticated;

create or replace function public.invoice_owner_pricing_read(p_org uuid,p_job uuid)
returns jsonb language sql security invoker set search_path='' as $body$
 select private.invoice_owner_pricing_read(p_org,p_job)
$body$;
revoke all on function public.invoice_owner_pricing_read(uuid,uuid) from public,anon,service_role;
grant execute on function public.invoice_owner_pricing_read(uuid,uuid) to authenticated;
