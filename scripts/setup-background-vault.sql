-- Internal deployment setup. These credentials are never returned to clients.
create table private.background_deployment (
 singleton boolean primary key default true check(singleton),
 organization_id uuid not null references public.organizations(id),
 origin text not null check(origin ~ '^https://[a-zA-Z0-9.-]+$')
);
alter table private.background_deployment enable row level security;
revoke all on private.background_deployment from public,anon,authenticated,service_role;
insert into private.background_deployment(singleton,organization_id,origin)
values(true,'a933d657-14d3-46b6-85e6-21d973e4ed97','https://ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app');

create function private.background_setup(p_org uuid,p_actor uuid,p_session uuid,p_action text,p_worker text default null,p_bypass text default null,p_origin text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare deployment private.background_deployment; secret_id uuid; secret_name text; secret_value text; ready boolean; jobs jsonb;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into deployment from private.background_deployment where singleton;
 if deployment.organization_id is distinct from p_org or not exists(
  select 1 from auth.sessions s join auth.users u on u.id=s.user_id join public.memberships m on m.user_id=u.id and m.organization_id=p_org
  where s.id=p_session and u.id=p_actor and (s.not_after is null or s.not_after>clock_timestamp())
  and u.deleted_at is null and u.email_confirmed_at is not null and not u.is_anonymous
  and (u.banned_until is null or u.banned_until<=clock_timestamp()) and m.revoked_at is null and m.role='owner'
 ) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_action='prepare' then
  if p_origin is distinct from deployment.origin or coalesce(length(p_worker),0) not between 32 and 512
   or coalesce(length(p_bypass),0) not between 32 and 512 or p_worker ~ '[[:space:]]' or p_bypass ~ '[[:space:]]'
   then raise exception 'SETUP_REQUIRED';end if;
  perform pg_advisory_xact_lock(hashtextextended('ynsg-background-setup',0));
  perform cron.alter_job(jobid,active:=false) from cron.job where jobname in('ynsg-mail-worker','ynsg-calendar-worker');
  foreach secret_name in array array['ynsg_crm_worker_secret','ynsg_crm_protection_bypass','ynsg_crm_worker_origin'] loop
   secret_value:=case secret_name when 'ynsg_crm_worker_secret' then p_worker when 'ynsg_crm_protection_bypass' then p_bypass else p_origin end;
   select id into secret_id from vault.secrets where name=secret_name;
   if secret_id is null then perform vault.create_secret(secret_value,secret_name,'Internal background scheduler');
   else perform vault.update_secret(secret_id,secret_value,secret_name,'Internal background scheduler');end if;
  end loop;
 elsif p_action is distinct from 'status' then raise exception 'ACTION_NOT_ACCEPTED';end if;
 select count(*)=3 into ready from vault.secrets where name in('ynsg_crm_worker_secret','ynsg_crm_protection_bypass','ynsg_crm_worker_origin');
 select coalesce(jsonb_agg(jsonb_build_object('name',jobname,'active',active)),'[]'::jsonb) into jobs from cron.job where jobname in('ynsg-mail-worker','ynsg-calendar-worker');
 return jsonb_build_object('credentialsStored',ready,'jobs',jobs);
end$$;
revoke all on function private.background_setup(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
create function public.background_setup(p_org uuid,p_actor uuid,p_session uuid,p_action text,p_worker text default null,p_bypass text default null,p_origin text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select private.background_setup(p_org,p_actor,p_session,p_action,p_worker,p_bypass,p_origin)
$$;
revoke all on function public.background_setup(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function private.background_setup(uuid,uuid,uuid,text,text,text,text),public.background_setup(uuid,uuid,uuid,text,text,text,text) to service_role;
