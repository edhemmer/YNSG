-- Internal, read-only owner diagnostics. Does not activate jobs or send messages.
begin;
create or replace function private.background_health(p_org uuid,p_actor uuid,p_session uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare checked timestamptz:=clock_timestamp(); workers jsonb; queue jsonb;
begin
 -- Reuse deployment binding, live session and verified owner checks. Never prepare.
 perform private.background_setup(p_org,p_actor,p_session,'status');
 select jsonb_agg(jsonb_build_object(
  'kind',k.kind,'lastRequestedAt',latest.requested_at,
  'lastSuccessfulAt',success.requested_at,'lastOutcome',outcome.result
 )) into workers
 from (values ('mail'),('calendar')) k(kind)
 left join lateral (
  select r.requested_at from private.background_http_runs r
  where r.kind=k.kind order by r.requested_at desc,r.request_id desc limit 1
 ) latest on true
 left join lateral (
  select r.requested_at from private.background_http_runs r join net._http_response h on h.id=r.request_id
  where r.kind=k.kind and h.status_code=200 and not coalesce(h.timed_out,false)
   and h.error_msg is null and r.requested_at>checked-interval '10 minutes'
  order by r.requested_at desc,r.request_id desc limit 1
 ) success on true
 left join lateral (
  select case when h.status_code=200 and not coalesce(h.timed_out,false) and h.error_msg is null
   then 'success' else 'failed' end as result
  from private.background_http_runs r join net._http_response h on h.id=r.request_id
  where r.kind=k.kind and r.requested_at>checked-interval '10 minutes'
  order by r.requested_at desc,r.request_id desc limit 1
 ) outcome on true;
 select jsonb_build_object(
  'needsReview',count(*) filter(where status in('needs_reconciliation','dead_letter')),
  'overdue',count(*) filter(where status in('pending','failed','leased','sending')
   and next_attempt_at<checked-interval '5 minutes' and (lease_until is null or lease_until<checked)),
  'waiting',count(*) filter(where status in('pending','failed','leased','sending'))
 ) into queue from public.outbox where organization_id=p_org;
 return jsonb_build_object('checkedAt',checked,'workers',workers,'queue',queue);
end$$;
revoke all on function private.background_health(uuid,uuid,uuid) from public,anon,authenticated;
create or replace function public.background_health(p_org uuid,p_actor uuid,p_session uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select private.background_health(p_org,p_actor,p_session)
$$;
revoke all on function public.background_health(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.background_health(uuid,uuid,uuid),public.background_health(uuid,uuid,uuid) to service_role;
commit;
