-- Read-only service-role probe. Public HTTP responses expose only an overall status.
create function private.operations_health(p_org uuid,p_mail_kinds text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare workers boolean:=false;queue_ok boolean;configured boolean;begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 configured:=exists(select 1 from public.organizations where id=p_org and status='active') and private.crm_calendar(p_org) and private.transactional_mail_enabled(p_org);
 if to_regclass('private.background_http_runs') is not null and to_regclass('net._http_response') is not null and to_regclass('cron.job') is not null then
  execute $q$select count(*)=2 and bool_and(exists(select 1 from private.background_http_runs r join net._http_response h on h.id=r.request_id where r.kind=k.kind and r.requested_at>clock_timestamp()-interval '5 minutes' and h.status_code=200 and not coalesce(h.timed_out,false) and h.error_msg is null)) and (select count(*)=2 and bool_and(active) from cron.job where jobname in('ynsg-mail-worker','ynsg-calendar-worker')) from (values('mail'),('calendar')) k(kind)$q$ into workers;
 end if;
 select not exists(select 1 from public.outbox where organization_id=p_org and kind=any(p_mail_kinds)
  and (kind<>'invoice.paid' or payload->>'schemaVersion'='2') and (status in('needs_reconciliation','dead_letter') or (status in('pending','failed','leased','sending') and next_attempt_at<clock_timestamp()-interval '5 minutes' and (lease_until is null or lease_until<clock_timestamp())))) into queue_ok;
 return jsonb_build_object('healthy',coalesce(configured and workers and queue_ok,false),'checkedAt',clock_timestamp());
end$$;
revoke all on function private.operations_health(uuid,text[]) from public,anon,authenticated,service_role;
create function public.operations_health(p_org uuid,p_mail_kinds text[]) returns jsonb language sql security invoker set search_path='' as $$select private.operations_health(p_org,p_mail_kinds)$$;
revoke all on function public.operations_health(uuid,text[]) from public,anon,authenticated,service_role;
grant execute on function private.operations_health(uuid,text[]),public.operations_health(uuid,text[]) to service_role;
