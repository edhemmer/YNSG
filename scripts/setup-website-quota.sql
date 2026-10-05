begin;
create table private.website_quota_buckets (
 organization_id uuid not null references public.organizations(id), operation text not null check(operation in ('availability','request')), bucket text not null, window_start timestamptz not null, hits integer not null,
 primary key(organization_id,operation,bucket,window_start)
);
create table private.website_quota_receipts (
 organization_id uuid not null references public.organizations(id), key_hash text not null, client_hash text not null, email_hash text not null, created_at timestamptz not null default now(),
 primary key(organization_id,key_hash)
);
alter table private.website_quota_buckets enable row level security;
alter table private.website_quota_receipts enable row level security;
create policy website_quota_buckets_deny on private.website_quota_buckets for all to anon,authenticated using(false) with check(false);
create policy website_quota_receipts_deny on private.website_quota_receipts for all to anon,authenticated using(false) with check(false);
revoke all on private.website_quota_buckets,private.website_quota_receipts from public,anon,authenticated;
grant select,insert,update,delete on private.website_quota_buckets,private.website_quota_receipts to service_role;
create function public.website_quota(p_org uuid,p_operation text,p_client text,p_key text,p_email text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare moment timestamptz:=now(); win timestamptz; n integer; maximum integer; retry integer;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_operation not in ('availability','request') or p_client is null or p_client !~ '^[a-f0-9]{64}$' or p_key is null or p_key !~ '^[a-f0-9]{64}$' or (p_operation='request' and (p_email is null or p_email !~ '^[a-f0-9]{64}$')) or not exists(select 1 from public.organizations where id=p_org and status in('setup','active')) then raise exception 'VALIDATION';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':website:'||p_operation||':'||p_client,0));
 if p_operation='request' then
  perform pg_advisory_xact_lock(hashtextextended(p_org::text||':website:email:'||p_email,0));
  if exists(select 1 from private.website_quota_receipts where organization_id=p_org and key_hash=p_key and client_hash=p_client and email_hash=p_email and created_at>moment-interval '24 hours') then return jsonb_build_object('allowed',true);end if;
 end if;
 delete from private.website_quota_buckets where organization_id=p_org and window_start<moment-interval '25 hours';
 delete from private.website_quota_receipts where organization_id=p_org and created_at<moment-interval '25 hours';
 win:=date_trunc(case when p_operation='availability' then 'minute' else 'hour' end,moment);maximum:=case when p_operation='availability' then 60 else 20 end;
 retry:=greatest(1,ceil(extract(epoch from(win+case when p_operation='availability' then interval '1 minute' else interval '1 hour' end-moment)))::integer);
 insert into private.website_quota_buckets values(p_org,p_operation,'ip:'||p_client,win,1) on conflict(organization_id,operation,bucket,window_start) do update set hits=least(private.website_quota_buckets.hits+1,maximum+1) returning hits into n;
 if n>maximum then return jsonb_build_object('allowed',false,'retryAfter',retry);end if;
 if p_operation='request' then
  insert into private.website_quota_buckets values(p_org,p_operation,'email:'||p_email,win,1) on conflict(organization_id,operation,bucket,window_start) do update set hits=least(private.website_quota_buckets.hits+1,6) returning hits into n;
  if n>5 then return jsonb_build_object('allowed',false,'retryAfter',retry);end if;
  insert into private.website_quota_receipts(organization_id,key_hash,client_hash,email_hash) values(p_org,p_key,p_client,p_email) on conflict do nothing;
 end if;
 return jsonb_build_object('allowed',true);
end $$;
revoke all on function public.website_quota(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.website_quota(uuid,text,text,text,text) to service_role;
commit;
