-- Owner-confirmed receipt and explicit per-company delivery authorization. No activation by migration.
create table private.mail_delivery_controls (
 organization_id uuid primary key references public.organizations(id),enabled boolean not null default false,
 account_subject text,test_key uuid,configuration_version integer,receipt_confirmed_at timestamptz,receipt_confirmed_by uuid references auth.users(id),
 last_polled_at timestamptz,worker_lease uuid,worker_lease_until timestamptz,
 foreign key(organization_id,configuration_version) references public.configuration_versions(organization_id,version)
);
alter table private.mail_delivery_controls enable row level security;
revoke all on private.mail_delivery_controls from public,anon,authenticated,service_role;
create policy mail_delivery_controls_deny on private.mail_delivery_controls to anon,authenticated using(false) with check(false);
create function private.gmail_delivery_enabled(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.mail_delivery_controls d join private.google_accounts g on g.organization_id=d.organization_id join public.organizations o on o.id=d.organization_id
 join public.configuration_versions c on c.organization_id=d.organization_id and c.version=d.configuration_version
 where d.organization_id=p_org and d.enabled and d.receipt_confirmed_at is not null and d.receipt_confirmed_by is not null and g.encrypted_tokens is not null and g.subject=d.account_subject
 and g.test_key=d.test_key and g.gmail_test='accepted' and lower(trim(g.email))=lower(trim(c.settings->>'sender')) and o.status='active'
 and c.version=(select max(version) from public.configuration_versions where organization_id=p_org)
 and 'https://www.googleapis.com/auth/gmail.send'=any(g.scopes)
 and exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled))
$$;
revoke all on function private.gmail_delivery_enabled(uuid) from public,anon,authenticated,service_role;
create function private.mail_delivery_status(p_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare g private.google_accounts;c public.configuration_versions;d private.mail_delivery_controls;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into g from private.google_accounts where organization_id=p_org;
 select * into c from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 select * into d from private.mail_delivery_controls where organization_id=p_org;
 return jsonb_build_object('enabled',private.gmail_delivery_enabled(p_org),'testKey',g.test_key,'configurationVersion',c.version,'connectionRevision',g.revision,'receiptConfirmedAt',d.receipt_confirmed_at,'senderMatches',lower(trim(g.email))=lower(trim(c.settings->>'sender')));
end$$;
create function public.mail_delivery_status(p_org uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.mail_delivery_status(p_org)$$;
revoke all on function private.mail_delivery_status(uuid),public.mail_delivery_status(uuid) from public,anon,service_role;
grant execute on function private.mail_delivery_status(uuid),public.mail_delivery_status(uuid) to authenticated;
create function private.configure_mail_delivery(p_org uuid,p_enable boolean,p_revision integer,p_test uuid,p_configuration integer,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.google_accounts;c public.configuration_versions;prior private.command_receipts;fingerprint text;result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_enable is null or p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION';end if;
 perform 1 from public.organizations where id=p_org for update;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_enable,p_revision,p_test,p_configuration,auth.uid())::text,'UTF8')),'hex');
 select * into prior from private.command_receipts where organization_id=p_org and command='ConfigureMailDelivery' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into g from private.google_accounts where organization_id=p_org for update;
 select * into c from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 if p_enable then
  if g.revision is distinct from p_revision or c.version is distinct from p_configuration or g.test_key is distinct from p_test then raise exception 'STALE_CONNECTION';end if;
  if g.encrypted_tokens is null or g.subject is null or g.gmail_test<>'accepted' or g.test_key is null or lower(trim(g.email)) is distinct from lower(trim(c.settings->>'sender')) or not ('https://www.googleapis.com/auth/gmail.send'=any(g.scopes)) then raise exception 'RECEIPT_REVIEW_REQUIRED';end if;
  insert into private.mail_delivery_controls(organization_id,enabled,account_subject,test_key,configuration_version,receipt_confirmed_at,receipt_confirmed_by)
   values(p_org,true,g.subject,g.test_key,c.version,clock_timestamp(),auth.uid())
   on conflict(organization_id) do update set enabled=true,account_subject=excluded.account_subject,test_key=excluded.test_key,configuration_version=excluded.configuration_version,receipt_confirmed_at=excluded.receipt_confirmed_at,receipt_confirmed_by=excluded.receipt_confirmed_by;
  if not private.gmail_delivery_enabled(p_org) then raise exception 'SETUP_REQUIRED';end if;
 else
  insert into private.mail_delivery_controls(organization_id,enabled) values(p_org,false) on conflict(organization_id) do update set enabled=false;
 end if;
 insert into public.integration_connections(organization_id,provider,status,secret_ref) values(p_org,'gmail',case when p_enable then 'active' else 'disabled' end,case when p_enable then 'google-account:'||p_org else null end)
  on conflict(organization_id,provider) do update set status=excluded.status,secret_ref=excluded.secret_ref;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),case when p_enable then 'gmail.receipt_confirmed_and_enabled' else 'gmail.delivery_disabled' end,p_org,coalesce(c.version,1),gen_random_uuid());
 result:=private.mail_delivery_status(p_org);insert into private.command_receipts values(p_org,'ConfigureMailDelivery',p_key,fingerprint,result,clock_timestamp());return result;
end$$;
create function public.configure_mail_delivery(p_org uuid,p_enable boolean,p_revision integer,p_test uuid,p_configuration integer,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.configure_mail_delivery(p_org,p_enable,p_revision,p_test,p_configuration,p_key)$$;
revoke all on function private.configure_mail_delivery(uuid,boolean,integer,uuid,integer,text),public.configure_mail_delivery(uuid,boolean,integer,uuid,integer,text) from public,anon,service_role;
grant execute on function private.configure_mail_delivery(uuid,boolean,integer,uuid,integer,text),public.configure_mail_delivery(uuid,boolean,integer,uuid,integer,text) to authenticated;

-- Refreshing access/health must preserve explicitly authorized delivery. New identity/test invalidates it.
do $$declare definition text;old_block text;new_block text;begin
 definition:=pg_get_functiondef('private.google_store(uuid,text,jsonb)'::regprocedure);
 old_block:=$old$insert into public.integration_connections(organization_id,provider,status,last_success_at,last_error)
 values(p_org,'gmail',case when a.encrypted_tokens is null then 'disabled' else 'test' end,a.checked_at,null),
 (p_org,'google_calendar',case when a.encrypted_tokens is null then 'disabled' when a.calendar_id is null then 'configured' else 'test' end,a.checked_at,null)
 on conflict(organization_id,provider) do update set status=excluded.status,last_success_at=excluded.last_success_at,secret_ref=null;$old$;
 new_block:=$new$insert into public.integration_connections(organization_id,provider,status,last_success_at,last_error,secret_ref)
 values(p_org,'gmail',case when a.encrypted_tokens is null then 'disabled' when private.gmail_delivery_enabled(p_org) then 'active' else 'test' end,a.checked_at,null,case when private.gmail_delivery_enabled(p_org) then 'google-account:'||p_org else null end),
 (p_org,'google_calendar',case when a.encrypted_tokens is null then 'disabled' when a.calendar_id is null then 'configured' else 'test' end,a.checked_at,null,null)
 on conflict(organization_id,provider) do update set status=excluded.status,last_success_at=excluded.last_success_at,secret_ref=excluded.secret_ref;$new$;
 if position(old_block in definition)=0 then raise exception 'MIGRATION_REVIEW_REQUIRED';end if;
 execute replace(definition,old_block,new_block);
end$$;

create function private.mail_dispatch_actor(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.staff(p_org,array['owner','admin']) or (coalesce(auth.jwt()->>'role','')='service_role' and private.gmail_delivery_enabled(p_org))
$$;
create function private.mail_finish_actor(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.staff(p_org,array['owner','admin']) or (coalesce(auth.jwt()->>'role','')='service_role' and exists(select 1 from public.organizations where id=p_org))
$$;
revoke all on function private.mail_dispatch_actor(uuid),private.mail_finish_actor(uuid) from public,anon,authenticated,service_role;
-- Narrow server grants for leased mail only; the general scheduling command remains staff-only.
do $$declare name text;signature regprocedure;definition text;expected text:=$expected$if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;$expected$;begin
 foreach name in array array['private.claim_outbox(uuid,integer)','private.begin_delivery(uuid,uuid,uuid)','private.issue_customer_request_link(uuid,uuid,uuid,text)','private.finish_delivery(uuid,uuid,uuid,text,text,text)'] loop
  signature:=name::regprocedure;definition:=pg_get_functiondef(signature);
  if position(expected in definition)=0 then raise exception 'MIGRATION_REVIEW_REQUIRED';end if;
  execute replace(definition,expected,case when name like 'private.finish_delivery%' then $new$if not private.mail_finish_actor(p_org) then raise exception 'FORBIDDEN' using errcode='42501';end if;$new$ else $new$if not private.mail_dispatch_actor(p_org) then raise exception 'FORBIDDEN' using errcode='42501';end if;$new$ end);
  definition:=pg_get_functiondef(signature);
  if name like 'private.claim_outbox%' then
   definition:=replace(definition,$find$if not exists(select 1 from public.integration_connections where organization_id=p_org and provider='gmail' and status='active' and secret_ref is not null) then return;end if;$find$, $replacement$if not private.gmail_delivery_enabled(p_org) then return;end if; if not exists(select 1 from public.integration_connections where organization_id=p_org and provider='gmail' and status='active' and secret_ref is not null) then return;end if;$replacement$);
  elsif name not like 'private.finish_delivery%' then
   definition:=replace(definition,$guard$if not private.mail_dispatch_actor(p_org) then raise exception 'FORBIDDEN' using errcode='42501';end if;$guard$,$guard$if not private.mail_dispatch_actor(p_org) then raise exception 'FORBIDDEN' using errcode='42501';end if; if not private.gmail_delivery_enabled(p_org) then raise exception 'PROVIDER_DISABLED';end if;$guard$);
  end if;
  execute definition;
  execute format('grant execute on function %s to service_role',signature);
 end loop;
end$$;
grant execute on function public.claim_outbox(uuid,integer),public.begin_delivery(uuid,uuid,uuid),public.issue_customer_request_link(uuid,uuid,uuid,text),public.finish_delivery(uuid,uuid,uuid,text,text,text) to service_role;

create function private.claim_mail_company() returns jsonb language plpgsql security definer set search_path='' as $$
declare chosen private.mail_delivery_controls;moment timestamptz:=clock_timestamp();
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select d.* into chosen from private.mail_delivery_controls d where private.gmail_delivery_enabled(d.organization_id) and (d.worker_lease_until is null or d.worker_lease_until<=moment)
  and exists(select 1 from public.outbox o where o.organization_id=d.organization_id and o.status in('pending','failed','leased','sending') and o.kind in('request.owner_notification','appointment.owner_approval','appointment.confirmation','appointment.reminder','appointment.declined_time','appointment.declined_service','appointment.reschedule_requested') and o.next_attempt_at<=moment)
 order by d.last_polled_at nulls first,d.organization_id for update skip locked limit 1;
 if not found then return null;end if;
 update private.mail_delivery_controls set worker_lease=gen_random_uuid(),worker_lease_until=moment+interval '90 seconds',last_polled_at=moment where organization_id=chosen.organization_id returning * into chosen;
 return jsonb_build_object('organization',chosen.organization_id,'lease',chosen.worker_lease);
end$$;
create function public.claim_mail_company() returns jsonb language sql security invoker set search_path='' as $$select private.claim_mail_company()$$;
create function private.finish_mail_company(p_org uuid,p_lease uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 update private.mail_delivery_controls set worker_lease=null,worker_lease_until=null where organization_id=p_org and worker_lease=p_lease;
end$$;
create function public.finish_mail_company(p_org uuid,p_lease uuid) returns void language sql security invoker set search_path='' as $$select private.finish_mail_company(p_org,p_lease)$$;
revoke all on function private.claim_mail_company(),public.claim_mail_company(),private.finish_mail_company(uuid,uuid),public.finish_mail_company(uuid,uuid) from public,anon,authenticated;
grant execute on function private.claim_mail_company(),public.claim_mail_company(),private.finish_mail_company(uuid,uuid),public.finish_mail_company(uuid,uuid) to service_role;

grant select on public.customer_schedule_preferences to service_role;
