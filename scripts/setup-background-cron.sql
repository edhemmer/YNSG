-- Internal, reviewed installation script. Requires pg_cron, pg_net and Vault.
-- This script never enables a job. Activation is a separate reviewed operation.
begin;
do $$begin
 if to_regprocedure('cron.schedule(text,text,text)') is null
 or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null
 or to_regclass('vault.decrypted_secrets') is null then
  raise exception 'Background scheduler extensions need setup';
 end if;
end$$;
create table if not exists private.background_http_runs (
 request_id bigint primary key,kind text not null check(kind in('mail','calendar')),
 requested_at timestamptz not null default clock_timestamp()
);
alter table private.background_http_runs enable row level security;
revoke all on private.background_http_runs from public,anon,authenticated,service_role;
create or replace function private.enqueue_background_worker(p_kind text) returns bigint
language plpgsql security invoker set search_path='' as $$
declare worker text;bypass text;origin text;path text;request_id bigint;
begin
 if p_kind not in ('mail','calendar') or p_kind is null then raise exception 'Worker type not accepted';end if;
 select decrypted_secret into worker from vault.decrypted_secrets where name='ynsg_crm_worker_secret';
 select decrypted_secret into bypass from vault.decrypted_secrets where name='ynsg_crm_protection_bypass';
 select decrypted_secret into origin from vault.decrypted_secrets where name='ynsg_crm_worker_origin';
 if coalesce(length(worker),0)<32 or coalesce(length(bypass),0)<32 then raise exception 'Background credentials need setup';end if;
 if origin is distinct from 'https://ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app' then raise exception 'Worker origin not accepted';end if;
 path:=case when p_kind='mail' then '/api/notifications/worker' else '/api/google/worker' end;
 request_id:=net.http_post(url:=origin||path,body:='{}'::jsonb,
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||worker,'x-vercel-protection-bypass',bypass),timeout_milliseconds:=55000);
 insert into private.background_http_runs(request_id,kind) values(request_id,p_kind);
 delete from private.background_http_runs where requested_at<clock_timestamp()-interval '7 days';
 return request_id;
end$$;
revoke all on function private.enqueue_background_worker(text) from public,anon,authenticated,service_role;
do $$declare job bigint;begin
 job:=cron.schedule('ynsg-mail-worker','* * * * *',$command$select private.enqueue_background_worker('mail');$command$);
 perform cron.alter_job(job,active:=false);
 job:=cron.schedule('ynsg-calendar-worker','* * * * *',$command$select private.enqueue_background_worker('calendar');$command$);
 perform cron.alter_job(job,active:=false);
end$$;
commit;
-- After reviewed activation, correlate private.background_http_runs.request_id
-- with net._http_response.id. Do not expose headers, Vault values or raw content.
-- Pause safely: select cron.alter_job(jobid,active:=false) from cron.job
-- where jobname in ('ynsg-mail-worker','ynsg-calendar-worker');
