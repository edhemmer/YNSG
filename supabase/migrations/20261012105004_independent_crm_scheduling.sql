-- CRM owns capacity. Calendar integrations are projections, not booking authority.
create table private.calendar_authorities(
 organization_id uuid primary key references public.organizations(id),source text not null default 'crm' check(source in('crm','google')),revision integer not null default 1 check(revision>0)
);
alter table private.calendar_authorities enable row level security;
revoke all on private.calendar_authorities from public,anon,authenticated,service_role;
create policy calendar_authorities_deny on private.calendar_authorities to anon,authenticated using(false) with check(false);
insert into private.calendar_authorities(organization_id) select id from public.organizations;
create function private.initialize_crm_calendar() returns trigger language plpgsql security definer set search_path='' as $$begin insert into private.calendar_authorities(organization_id) values(new.id);return new;end$$;
revoke all on function private.initialize_crm_calendar() from public,anon,authenticated,service_role;
create trigger initialize_crm_calendar after insert on public.organizations for each row execute function private.initialize_crm_calendar();
create function private.crm_calendar(p_org uuid) returns boolean language sql stable security invoker set search_path='' as $$select exists(select 1 from private.calendar_authorities where organization_id=p_org and source='crm')$$;
revoke all on function private.crm_calendar(uuid) from public,anon,authenticated,service_role;
create function public.calendar_authority(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' and not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return (select jsonb_build_object('source',source,'revision',revision) from private.calendar_authorities where organization_id=p_org);
end$$;
revoke all on function public.calendar_authority(uuid) from public,anon;
grant execute on function public.calendar_authority(uuid) to authenticated,service_role;
create function public.crm_calendar_facts(p_org uuid,p_begin timestamptz,p_finish timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.calendar_authorities;cfg public.configuration_versions;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into a from private.calendar_authorities where organization_id=p_org;
 select * into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 if a.source is distinct from 'crm' or cfg.version is null or p_begin is null or p_finish is null or p_finish<=p_begin or p_finish>p_begin+interval '370 days' then raise exception 'CALENDAR_AUTHORITY_REQUIRED';end if;
 -- Busy resources/blocks are checked by canonical transaction rules, not fabricated Google facts.
 return jsonb_build_object('source','crm','authorityRevision',a.revision,'configurationVersion',cfg.version,'checkedAt',clock_timestamp(),'windowStart',p_begin,'windowEnd',p_finish,'busy','[]'::jsonb);
end$$;
revoke all on function public.crm_calendar_facts(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.crm_calendar_facts(uuid,timestamptz,timestamptz) to service_role;
create function private.assert_crm_calendar_facts(p_org uuid,p_provider jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare moment timestamptz:=clock_timestamp();begin
 if p_provider->>'source' is distinct from 'crm' or not private.crm_calendar(p_org)
 or (p_provider->>'authorityRevision')::integer is distinct from (select revision from private.calendar_authorities where organization_id=p_org)
 or (p_provider->>'configurationVersion')::integer is distinct from (select version from public.configuration_versions where organization_id=p_org order by version desc limit 1)
 or p_provider->>'checkedAt' is null or (p_provider->>'checkedAt')::timestamptz>moment+interval '5 seconds' or (p_provider->>'checkedAt')::timestamptz<=moment-interval '60 seconds'
 or p_provider->>'windowStart' is null or p_provider->>'windowEnd' is null or p_provider->'busy' is distinct from '[]'::jsonb then raise exception 'CRM_FACTS_REQUIRED';end if;
end$$;
revoke all on function private.assert_crm_calendar_facts(uuid,jsonb) from public,anon,authenticated,service_role;
do $$declare d text;start_at integer;stop_at integer;old text;begin
 d:=pg_get_functiondef('private.website_provider_clear(uuid,timestamptz,timestamptz,integer,jsonb)'::regprocedure);
 d:=replace(d,'begin','begin
 if private.crm_calendar(p_org) then
 perform private.assert_crm_calendar_facts(p_org,p_provider);
 if p_buffer is null or p_buffer not between 0 and 180 or (p_provider->>''windowStart'')::timestamptz>p_start-make_interval(mins=>p_buffer) or (p_provider->>''windowEnd'')::timestamptz<p_end+make_interval(mins=>p_buffer) then raise exception ''CRM_FACTS_REQUIRED'';end if;
 return;end if;');execute d;
 d:=pg_get_functiondef('private.record_scheduling_review(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure);
 start_at:=strpos(d,' select * into g from private.google_accounts');stop_at:=strpos(d,' start_time:=');
 if start_at=0 or stop_at<=start_at then raise exception 'calendar review baseline changed';end if;
 old:=substring(d from start_at for stop_at-start_at);
 d:=replace(d,old,' if private.crm_calendar(p_org) then perform private.assert_crm_calendar_facts(p_org,p_provider);else
'||old||' end if;
');
 d:=replace(d,'''kind'',''owner_review''','''source'',case when private.crm_calendar(p_org) then ''crm'' else ''google'' end,''authorityRevision'',(select revision from private.calendar_authorities where organization_id=p_org),''kind'',''owner_review''');execute d;
 d:=pg_get_functiondef('private.assert_schedule_evidence(uuid,uuid,uuid,timestamptz)'::regprocedure);
 old:='or (e.provider_references->>''connectionRevision'')::integer is distinct from (select revision from private.google_accounts where organization_id=p_org)';
 if strpos(d,old)=0 then raise exception 'evidence connection baseline changed';end if;
 d:=replace(d,old,'or (case when private.crm_calendar(p_org) then e.provider_references->>''source'' is distinct from ''crm'' or (e.provider_references->>''authorityRevision'')::integer is distinct from (select revision from private.calendar_authorities where organization_id=p_org) else (e.provider_references->>''connectionRevision'')::integer is distinct from (select revision from private.google_accounts where organization_id=p_org) end)');execute d;
end$$;

-- Independent transactional mail is enabled only after an authenticated owner test.
create table private.transactional_mail_controls(organization_id uuid primary key references public.organizations(id),enabled boolean not null default false,origin text not null,sender text,approved_recipient text,approved_reply_to text,verified_at timestamptz,verified_by uuid references auth.users(id));
alter table private.transactional_mail_controls enable row level security;
revoke all on private.transactional_mail_controls from public,anon,authenticated,service_role;
create policy transactional_mail_deny on private.transactional_mail_controls to anon,authenticated using(false) with check(false);
create function private.transactional_mail_enabled(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.transactional_mail_controls t join public.organizations o on o.id=t.organization_id where t.organization_id=p_org and t.enabled and t.verified_at is not null and o.status='active' and exists(select 1 from public.memberships m where m.organization_id=p_org and m.user_id=t.verified_by and m.revoked_at is null and m.role in('owner','admin')) and lower(t.approved_recipient) is not distinct from (select lower(settings->>'notificationRecipient') from public.configuration_versions where organization_id=p_org order by version desc limit 1) and lower(t.approved_reply_to) is not distinct from (select lower(settings->>'sender') from public.configuration_versions where organization_id=p_org order by version desc limit 1) and exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled))$$;
revoke all on function private.transactional_mail_enabled(uuid) from public,anon,authenticated,service_role;
create function public.transactional_mail_status(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.jwt()->>'role' is distinct from 'service_role' and not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return coalesce((select jsonb_build_object('enabled',private.transactional_mail_enabled(p_org),'origin',origin,'sender',sender,'verifiedAt',verified_at) from private.transactional_mail_controls where organization_id=p_org),jsonb_build_object('enabled',false));
end$$;
revoke all on function public.transactional_mail_status(uuid) from public,anon;
grant execute on function public.transactional_mail_status(uuid) to authenticated,service_role;
create function public.activate_transactional_mail(p_org uuid,p_actor uuid,p_session uuid,p_origin text,p_sender text) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.jwt()->>'role' is distinct from 'service_role' or not exists(select 1 from auth.sessions s join public.memberships m on m.user_id=s.user_id and m.organization_id=p_org where s.id=p_session and s.user_id=p_actor and (s.not_after is null or s.not_after>now()) and m.role in('owner','admin') and m.revoked_at is null) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_origin!~'^https://[a-zA-Z0-9.-]+$' or p_sender is null or length(p_sender)>300 or p_sender~E'[\\r\\n]' then raise exception 'VALIDATION';end if;
 insert into private.transactional_mail_controls(organization_id,enabled,origin,sender,approved_recipient,approved_reply_to,verified_at,verified_by) select p_org,true,p_origin,p_sender,settings->>'notificationRecipient',settings->>'sender',now(),p_actor from public.configuration_versions where organization_id=p_org order by version desc limit 1 on conflict(organization_id) do update set enabled=true,origin=excluded.origin,sender=excluded.sender,approved_recipient=excluded.approved_recipient,approved_reply_to=excluded.approved_reply_to,verified_at=excluded.verified_at,verified_by=excluded.verified_by;
 insert into private.mail_delivery_controls(organization_id) values(p_org) on conflict do nothing;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,p_actor,'transactional_mail.verified',p_org,1,gen_random_uuid());
end$$;
revoke all on function public.activate_transactional_mail(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.activate_transactional_mail(uuid,uuid,uuid,text,text) to service_role;
alter function private.gmail_delivery_enabled(uuid) rename to legacy_gmail_delivery_enabled;
create function private.gmail_delivery_enabled(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$select private.legacy_gmail_delivery_enabled(p_org) or private.transactional_mail_enabled(p_org)$$;
revoke all on function private.gmail_delivery_enabled(uuid) from public,anon,authenticated,service_role;
do $$declare sig text;d text;begin
 -- Renaming retains dependencies in parsed SQL; rebuild callers against the wrapper.
 for sig in select oid::regprocedure::text from pg_proc where pronamespace='private'::regnamespace and proname in('claim_outbox','begin_delivery','claim_mail_company','mail_dispatch_actor','mail_delivery_status','request_invoice_delivery','notify_delay','configure_mail_delivery') loop
 d:=pg_get_functiondef(sig::regprocedure);d:=replace(d,'private.legacy_gmail_delivery_enabled','private.gmail_delivery_enabled');
 d:=replace(d,'if not exists(select 1 from public.integration_connections where organization_id=p_org and provider=''gmail'' and status=''active'' and secret_ref is not null) then return;end if;','if not private.gmail_delivery_enabled(p_org) then return;end if;');
 d:=replace(d,'if not exists(select 1 from public.integration_connections where organization_id=p_org and provider=''gmail'' and status=''active'' and secret_ref is not null) then raise exception ''PROVIDER_DISABLED'';end if;','if not private.gmail_delivery_enabled(p_org) then raise exception ''PROVIDER_DISABLED'';end if;');execute d;
 end loop;
end$$;

create table private.calendar_feeds(organization_id uuid not null references public.organizations(id),owner_id uuid not null references auth.users(id),token_hash text unique not null check(token_hash~'^[a-f0-9]{64}$'),include_details boolean not null default false,created_at timestamptz not null default now(),primary key(organization_id,owner_id));
alter table private.calendar_feeds enable row level security;
revoke all on private.calendar_feeds from public,anon,authenticated,service_role;
create policy calendar_feeds_deny on private.calendar_feeds to anon,authenticated using(false) with check(false);
create function public.calendar_feed_command(p_org uuid,p_action text,p_hash text,p_details boolean) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_action='revoke' then delete from private.calendar_feeds where organization_id=p_org and owner_id=auth.uid();return jsonb_build_object('revoked',true);end if;
 if p_action<>'create' or p_hash!~'^[a-f0-9]{64}$' or p_details is null then raise exception 'VALIDATION';end if;
 insert into private.calendar_feeds(organization_id,owner_id,token_hash,include_details) values(p_org,auth.uid(),p_hash,p_details) on conflict(organization_id,owner_id) do update set token_hash=excluded.token_hash,include_details=excluded.include_details,created_at=now();
 return jsonb_build_object('created',true);
end$$;
revoke all on function public.calendar_feed_command(uuid,text,text,boolean) from public,anon,service_role;
grant execute on function public.calendar_feed_command(uuid,text,text,boolean) to authenticated;
create function public.calendar_feed_read(p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f private.calendar_feeds;result jsonb;begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into f from private.calendar_feeds where token_hash=p_hash;
 if f.organization_id is null or not exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id where m.organization_id=f.organization_id and m.user_id=f.owner_id and m.role in('owner','admin') and m.revoked_at is null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) then return null;end if;
 select jsonb_build_object('name',o.display_name,'events',coalesce(jsonb_agg(jsonb_build_object('id',a.id,'revision',a.revision,'start',a.start_at,'end',a.end_at,'updatedAt',a.created_at,'status',a.status,'customer',case when f.include_details then r.original_submission->>'name' else null end,'address',case when f.include_details then concat_ws(', ',r.original_submission->>'street',r.original_submission->>'city') else null end) order by a.start_at) filter(where a.id is not null),'[]'::jsonb)) into result
 from public.organizations o left join public.appointments a on a.organization_id=o.id and a.status in('reserved','completed','canceled') and a.start_at>=now()-interval '30 days' and a.start_at<now()+interval '370 days' and a.request_id is not null
 left join public.service_requests r on r.organization_id=a.organization_id and r.id=a.request_id where o.id=f.organization_id group by o.display_name;
 return result;
end$$;
revoke all on function public.calendar_feed_read(text) from public,anon,authenticated;
grant execute on function public.calendar_feed_read(text) to service_role;
