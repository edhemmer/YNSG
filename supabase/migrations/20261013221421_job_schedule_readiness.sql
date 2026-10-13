-- Read-only aggregate guidance uses the same approved duration as work-start enforcement.
create function private.job_schedule_readiness(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ready bigint;needs_review bigint;scheduling boolean;begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 scheduling:=exists(select 1 from public.entitlements where organization_id=p_org and module='scheduling' and enabled);
 select count(*) filter(where good),count(*) filter(where not good) into ready,needs_review from(
  select not scheduling or exists(select 1 from public.appointments a join public.quote_versions v on v.organization_id=a.organization_id and v.quote_id=j.quote_id and v.version=j.approved_version
   where a.organization_id=p_org and a.job_id=j.id and a.status='reserved' and a.end_at>clock_timestamp() and extract(epoch from(a.end_at-a.arrival_at))/60>=v.duration_minutes) good
  from public.jobs j where j.organization_id=p_org and j.status in('approved','scheduled','en_route','arrived')) reviewed;
 return jsonb_build_object('ready',ready,'needsReview',needs_review);
end$$;
create function public.job_schedule_readiness(p_org uuid) returns jsonb language sql security invoker set search_path='' as $$select private.job_schedule_readiness(p_org)$$;
revoke all on function private.job_schedule_readiness(uuid),public.job_schedule_readiness(uuid) from public,anon,authenticated,service_role;
grant execute on function private.job_schedule_readiness(uuid),public.job_schedule_readiness(uuid) to authenticated;
