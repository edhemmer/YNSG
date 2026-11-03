-- Read-only clock derived from canonical work sessions; never a billing authority.
create function public.field_job_clock(p_org uuid,p_job uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j public.jobs; closed_seconds bigint; running_since timestamptz; open_count integer; moment timestamptz:=statement_timestamp();
begin
 if not private.field_job_access(p_org,p_job) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into j from public.jobs where organization_id=p_org and id=p_job;
 if not found then raise exception 'NOT_FOUND' using errcode='P0002';end if;
 select coalesce(floor(sum(extract(epoch from ended_at-started_at)) filter(where ended_at is not null)),0)::bigint,min(started_at) filter(where ended_at is null),count(*) filter(where ended_at is null) into closed_seconds,running_since,open_count from public.work_sessions where organization_id=p_org and job_id=p_job;
 if closed_seconds<0 or closed_seconds>315360000 or open_count>1 or (j.status='working') is distinct from (open_count=1) or running_since>moment then raise exception 'TIME_RECORD_REVIEW_REQUIRED';end if;
 return jsonb_build_object('organization',p_org,'job',p_job,'actor',auth.uid(),'revision',j.revision,'status',j.status,'checkedAt',moment,'closedSeconds',closed_seconds,'runningSince',running_since);
end $$;
revoke all on function public.field_job_clock(uuid,uuid) from public,anon,service_role;
grant execute on function public.field_job_clock(uuid,uuid) to authenticated;
