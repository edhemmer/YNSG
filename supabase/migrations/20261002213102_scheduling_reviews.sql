-- Read-only scheduling context. No reservation, provider activation or customer intake changes.
create function private.scheduling_snapshot(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare cfg public.configuration_versions; result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='scheduling' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 select * into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 if not found then raise exception 'SETUP_REQUIRED';end if;
 select jsonb_build_object(
  'configurationVersion',cfg.version,'settings',cfg.settings,
  'scheduleRevision',coalesce((select revision from private.schedule_state where organization_id=p_org),0),
  'resources',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'status',status) order by name,id) from public.resources where organization_id=p_org),'[]'::jsonb),
  'reservations',coalesce((select jsonb_agg(jsonb_build_object('resourceId',r.resource_id,'start',lower(r.during),'end',upper(r.during)) order by lower(r.during),r.id)
   from public.resource_reservations r join public.appointments a on a.organization_id=r.organization_id and a.id=r.appointment_id
   where r.organization_id=p_org and r.active and r.during && tstzrange(now(),now()+interval '9 days','[)')
    and (a.status not in('held','proposal') or a.expires_at>now())),'[]'::jsonb),
  'blocks',coalesce((select jsonb_agg(jsonb_build_object('start',starts_at,'end',ends_at) order by starts_at,id) from public.availability_exceptions where organization_id=p_org and ends_at>now() and starts_at<now()+interval '9 days'),'[]'::jsonb)
 ) into result;
 return result;
end$$;
create function public.scheduling_snapshot(p_org uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.scheduling_snapshot(p_org)$$;
revoke all on function private.scheduling_snapshot(uuid),public.scheduling_snapshot(uuid) from public,anon,service_role;
grant execute on function private.scheduling_snapshot(uuid),public.scheduling_snapshot(uuid) to authenticated;
