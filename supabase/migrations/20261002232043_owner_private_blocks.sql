alter table public.availability_exceptions add column revision integer not null default 1 check(revision>0);
create function public.owner_calendar_blocks(p_org uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'startsAt',starts_at,'endsAt',ends_at,'revision',revision) order by starts_at,id) from public.availability_exceptions where organization_id=p_org),'[]'::jsonb);
end$$;
create function public.manage_calendar_block(p_org uuid,p_id uuid,p_revision integer,p_start timestamptz,p_end timestamptz,p_remove boolean,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior private.command_receipts;fingerprint text;result jsonb;b public.availability_exceptions;cfg jsonb;buffer integer;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='scheduling' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_key is null or length(p_key) not between 16 and 128 or p_remove is null or (p_remove and p_id is null) then raise exception 'VALIDATION';end if;
 if not p_remove and (p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '366 days') then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_id,p_revision,p_start,p_end,p_remove)::text,'UTF8')),'hex');
 insert into private.schedule_state(organization_id) values(p_org) on conflict do nothing;
 perform 1 from private.schedule_state where organization_id=p_org for update;
 select * into prior from private.command_receipts where organization_id=p_org and command='CalendarBlock' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if p_id is not null then select * into b from public.availability_exceptions where organization_id=p_org and id=p_id for update;if not found then raise exception 'NOT_FOUND';end if;if p_revision is distinct from b.revision then raise exception 'STALE_REVISION';end if;end if;
 if not p_remove then
  select settings into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
  buffer:=coalesce((cfg->'scheduling'->>'bufferMinutes')::integer,30);
  if exists(select 1 from public.appointments where organization_id=p_org and status in ('reserved','needs_review','held','proposal') and (status not in ('held','proposal') or expires_at>clock_timestamp()) and start_at-make_interval(mins=>buffer)<p_end and end_at+make_interval(mins=>buffer)>p_start) then raise exception 'CAPACITY_CONFLICT';end if;
  if p_id is null then insert into public.availability_exceptions(organization_id,starts_at,ends_at,reason) values(p_org,p_start,p_end,'Unavailable') returning * into b;
  else update public.availability_exceptions set starts_at=p_start,ends_at=p_end,reason='Unavailable',revision=revision+1 where organization_id=p_org and id=p_id returning * into b;end if;
 else delete from public.availability_exceptions where organization_id=p_org and id=p_id;end if;
 update private.schedule_state set revision=revision+1 where organization_id=p_org;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),case when p_remove then 'calendar.block_removed' else 'calendar.block_saved' end,b.id,b.revision,gen_random_uuid());
 result:=jsonb_build_object('id',b.id,'revision',b.revision,'removed',p_remove);insert into private.command_receipts values(p_org,'CalendarBlock',p_key,fingerprint,result,now());return result;
end$$;
revoke all on function public.owner_calendar_blocks(uuid),public.manage_calendar_block(uuid,uuid,integer,timestamptz,timestamptz,boolean,text) from public,anon,service_role;
grant execute on function public.owner_calendar_blocks(uuid),public.manage_calendar_block(uuid,uuid,integer,timestamptz,timestamptz,boolean,text) to authenticated;
