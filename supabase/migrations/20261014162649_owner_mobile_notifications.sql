-- Private, opt-in owner device registry and generic notification intents.
create table private.owner_mobile_devices (
 organization_id uuid not null references public.organizations(id),
 id uuid not null, user_id uuid not null references auth.users(id), session_id uuid not null,
 token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'), encrypted_token text not null check(length(encrypted_token) between 50 and 2048),
 environment text not null check(environment in('sandbox','production')),
 new_requests boolean not null, appointments boolean not null, sound boolean not null,
 quiet_start integer not null check(quiet_start between 0 and 1439), quiet_end integer not null check(quiet_end between 0 and 1439),
 revision integer not null default 1 check(revision>0), enabled boolean not null default true,
 updated_at timestamptz not null default now(), primary key(organization_id,id)
);
create index owner_mobile_user_idx on private.owner_mobile_devices(user_id,organization_id);
create index owner_mobile_session_idx on private.owner_mobile_devices(session_id);
alter table private.owner_mobile_devices enable row level security;
create table private.owner_mobile_push (
 organization_id uuid not null, id uuid not null default gen_random_uuid(),device_id uuid not null,
 kind text not null check(kind in('new_request','appointment')),
 object_id uuid not null, object_revision integer not null,
 state text not null default 'pending' check(state in('pending','sending','accepted','rejected','unknown','skipped')),
 lease uuid, lease_until timestamptz, outcome text, created_at timestamptz not null default now(),finished_at timestamptz,
 primary key(organization_id,id), foreign key(organization_id,device_id) references private.owner_mobile_devices(organization_id,id),
 unique(organization_id,device_id,kind,object_id,object_revision)
);
create index owner_mobile_pending_idx on private.owner_mobile_push(state,created_at);
alter table private.owner_mobile_push enable row level security;
create function private.save_owner_mobile_device(p_org uuid,p_id uuid,p_revision integer,p_hash text,p_cipher text,p_environment text,p_requests boolean,p_appointments boolean,p_sound boolean,p_quiet_start integer,p_quiet_end integer,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d private.owner_mobile_devices; prior private.command_receipts; fingerprint text; result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_revision is null or p_revision<0 or p_key is null or length(p_key) not between 16 and 128 or p_requests is null or p_appointments is null or p_sound is null or p_quiet_start is null or p_quiet_end is null then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),auth.jwt()->>'session_id',p_id,p_revision,p_hash,p_environment,p_requests,p_appointments,p_sound,p_quiet_start,p_quiet_end)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':mobile:'||p_id::text,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='SaveOwnerMobileDevice' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into d from private.owner_mobile_devices where organization_id=p_org and id=p_id for update;
 if found and (d.user_id<>auth.uid() or d.revision<>p_revision) then raise exception 'STALE_REVISION';end if;
 if not found and p_revision<>0 then raise exception 'STALE_REVISION';end if;
 if not found and (select count(*) from private.owner_mobile_devices where organization_id=p_org and user_id=auth.uid())>=20 then raise exception 'DEVICE_LIMIT';end if;
 update private.owner_mobile_devices set enabled=false,encrypted_token=repeat('0',50),token_hash=repeat('0',64),revision=revision+1,updated_at=now() where token_hash=p_hash and user_id<>auth.uid() and enabled;
 insert into private.owner_mobile_devices(organization_id,id,user_id,session_id,token_hash,encrypted_token,environment,new_requests,appointments,sound,quiet_start,quiet_end)
 values(p_org,p_id,auth.uid(),(auth.jwt()->>'session_id')::uuid,p_hash,p_cipher,p_environment,p_requests,p_appointments,p_sound,p_quiet_start,p_quiet_end)
 on conflict(organization_id,id) do update set session_id=excluded.session_id,token_hash=excluded.token_hash,encrypted_token=excluded.encrypted_token,environment=excluded.environment,new_requests=excluded.new_requests,appointments=excluded.appointments,sound=excluded.sound,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,enabled=true,revision=private.owner_mobile_devices.revision+1,updated_at=now()
 returning * into d;
 result:=jsonb_build_object('id',d.id,'revision',d.revision,'enabled',d.enabled);
 insert into private.command_receipts values(p_org,'SaveOwnerMobileDevice',p_key,fingerprint,result,now());
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'mobile.notifications.reviewed',p_id,d.revision,gen_random_uuid());
 return result;
end$$;
create function public.save_owner_mobile_device(p_org uuid,p_id uuid,p_revision integer,p_hash text,p_cipher text,p_environment text,p_requests boolean,p_appointments boolean,p_sound boolean,p_quiet_start integer,p_quiet_end integer,p_key text) returns jsonb
language sql security invoker set search_path='' as $$select private.save_owner_mobile_device(p_org,p_id,p_revision,p_hash,p_cipher,p_environment,p_requests,p_appointments,p_sound,p_quiet_start,p_quiet_end,p_key)$$;
create function private.owner_mobile_settings(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return jsonb_build_object('devices',coalesce((select jsonb_agg(jsonb_build_object('id',id,'revision',revision,'enabled',enabled,'newRequests',new_requests,'appointments',appointments,'sound',sound,'quietStart',quiet_start,'quietEnd',quiet_end,'updatedAt',updated_at) order by updated_at desc) from private.owner_mobile_devices where organization_id=p_org and user_id=auth.uid()),'[]'::jsonb),'delivery',jsonb_build_object('pending',(select count(*) from private.owner_mobile_push p join private.owner_mobile_devices d on d.organization_id=p.organization_id and d.id=p.device_id where d.organization_id=p_org and d.user_id=auth.uid() and p.state in('pending','sending')),'accepted',(select count(*) from private.owner_mobile_push p join private.owner_mobile_devices d on d.organization_id=p.organization_id and d.id=p.device_id where d.organization_id=p_org and d.user_id=auth.uid() and p.state='accepted'),'needsAttention',(select count(*) from private.owner_mobile_push p join private.owner_mobile_devices d on d.organization_id=p.organization_id and d.id=p.device_id where d.organization_id=p_org and d.user_id=auth.uid() and p.state in('rejected','unknown'))));
end$$;
create function public.owner_mobile_settings(p_org uuid) returns jsonb language sql security invoker set search_path='' as $$select private.owner_mobile_settings(p_org)$$;
create function private.disable_owner_mobile_device(p_org uuid,p_id uuid,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.owner_mobile_devices;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into d from private.owner_mobile_devices where organization_id=p_org and id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if not d.enabled then return jsonb_build_object('id',d.id,'revision',d.revision,'enabled',false);end if;
 if d.revision<>p_revision then raise exception 'STALE_REVISION';end if;
 update private.owner_mobile_devices set enabled=false,encrypted_token=repeat('0',50),token_hash=repeat('0',64),revision=revision+1,updated_at=now() where organization_id=p_org and id=p_id returning * into d;
 update private.owner_mobile_push set state='skipped',finished_at=now(),outcome='device_disabled' where organization_id=p_org and device_id=p_id and state='pending';
 return jsonb_build_object('id',d.id,'revision',d.revision,'enabled',false);
end$$;
create function public.disable_owner_mobile_device(p_org uuid,p_id uuid,p_revision integer) returns jsonb language sql security invoker set search_path='' as $$select private.disable_owner_mobile_device(p_org,p_id,p_revision)$$;
create function private.mobile_device_active(d private.owner_mobile_devices) returns boolean language sql stable security definer set search_path='' as $$
 select d.enabled and exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id join auth.sessions s on s.user_id=u.id where m.organization_id=d.organization_id and m.user_id=d.user_id and m.role in('owner','admin') and m.revoked_at is null and s.id=d.session_id and (s.not_after is null or s.not_after>now()) and u.email_confirmed_at is not null and u.deleted_at is null and not u.is_anonymous and (u.banned_until is null or u.banned_until<=now()))
$$;
create function private.mobile_device_quiet(d private.owner_mobile_devices) returns boolean language sql stable security definer set search_path='' as $$
 select (d).quiet_start<>(d).quiet_end and (((d).quiet_start<(d).quiet_end and minutes>=(d).quiet_start and minutes<(d).quiet_end) or ((d).quiet_start>(d).quiet_end and (minutes>=(d).quiet_start or minutes<(d).quiet_end))) from (select extract(hour from now() at time zone timezone)::integer*60+extract(minute from now() at time zone timezone)::integer as minutes from public.organizations where id=(d).organization_id) local_clock
$$;
create function private.queue_mobile_request() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.recurring_series_id is not null or new.status<>'submitted' then return new;end if;
 insert into private.owner_mobile_push(organization_id,device_id,kind,object_id,object_revision)
 select new.organization_id,d.id,'new_request',new.id,new.revision from private.owner_mobile_devices d where d.organization_id=new.organization_id and d.new_requests and private.mobile_device_active(d) on conflict do nothing;
 return new;
end$$;
create trigger owner_mobile_request_intent after insert on public.service_requests for each row execute function private.queue_mobile_request();
create function private.claim_owner_mobile_push() returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.owner_mobile_push; d private.owner_mobile_devices; minutes integer; zone text; lease_id uuid;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 update private.owner_mobile_push set state='unknown',finished_at=now(),outcome='sending_lease_expired' where state='sending' and lease_until<now();
 update private.owner_mobile_push stale set state='skipped',finished_at=now(),outcome='permission_or_visit_changed' where stale.state='pending' and (not exists(select 1 from private.owner_mobile_devices device where device.organization_id=stale.organization_id and device.id=stale.device_id and private.mobile_device_active(device) and ((stale.kind='new_request' and device.new_requests) or (stale.kind='appointment' and device.appointments))) or (stale.kind='appointment' and not exists(select 1 from public.appointments visit where visit.organization_id=stale.organization_id and visit.id=stale.object_id and visit.status='reserved' and visit.revision=stale.object_revision and visit.start_at>now())) or (stale.kind='new_request' and not exists(select 1 from public.service_requests request_row where request_row.organization_id=stale.organization_id and request_row.id=stale.object_id and request_row.status not in('declined','canceled'))));
 insert into private.owner_mobile_push(organization_id,device_id,kind,object_id,object_revision)
 select a.organization_id,dev.id,'appointment',a.id,a.revision from public.appointments a join private.owner_mobile_devices dev on dev.organization_id=a.organization_id where a.status='reserved' and a.start_at>now() and a.start_at<=now()+interval '30 minutes' and dev.appointments and private.mobile_device_active(dev) on conflict do nothing;
 for p in select q.* from private.owner_mobile_push q join private.owner_mobile_devices candidate on candidate.organization_id=q.organization_id and candidate.id=q.device_id where q.state='pending' and (not private.mobile_device_active(candidate) or not private.mobile_device_quiet(candidate)) order by q.created_at,q.id limit 100 for update of q skip locked loop
  select * into d from private.owner_mobile_devices where organization_id=p.organization_id and id=p.device_id;
  if not private.mobile_device_active(d) or (p.kind='new_request' and (not d.new_requests or not exists(select 1 from public.service_requests r where r.organization_id=p.organization_id and r.id=p.object_id and r.status not in('declined','canceled')))) or (p.kind='appointment' and (not d.appointments or not exists(select 1 from public.appointments a where a.organization_id=p.organization_id and a.id=p.object_id and a.status='reserved' and a.revision=p.object_revision and a.start_at>now() and a.start_at<=now()+interval '30 minutes'))) then
   update private.owner_mobile_push set state='skipped',finished_at=now(),outcome='permission_or_visit_changed' where organization_id=p.organization_id and id=p.id;continue;
  end if;
  select timezone into zone from public.organizations where id=p.organization_id;
  minutes:=extract(hour from now() at time zone zone)::integer*60+extract(minute from now() at time zone zone)::integer;
  if d.quiet_start<>d.quiet_end and ((d.quiet_start<d.quiet_end and minutes>=d.quiet_start and minutes<d.quiet_end) or (d.quiet_start>d.quiet_end and (minutes>=d.quiet_start or minutes<d.quiet_end))) then continue;end if;
  lease_id:=gen_random_uuid();
  update private.owner_mobile_push set state='sending',lease=lease_id,lease_until=now()+interval '2 minutes' where organization_id=p.organization_id and id=p.id;
  return jsonb_build_object('id',p.id,'organization',p.organization_id,'device',d.id,'kind',p.kind,'object',p.object_id,'environment',d.environment,'cipher',d.encrypted_token,'sound',d.sound,'lease',lease_id);
 end loop;
 return null;
end$$;
create function public.claim_owner_mobile_push() returns jsonb language sql security invoker set search_path='' as $$select private.claim_owner_mobile_push()$$;
create function private.finish_owner_mobile_push(p_org uuid,p_id uuid,p_lease uuid,p_state text,p_outcome text,p_disable boolean) returns void language plpgsql security definer set search_path='' as $$
declare p private.owner_mobile_push;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_state not in('accepted','rejected','unknown') or length(coalesce(p_outcome,''))>100 then raise exception 'VALIDATION';end if;
 select * into p from private.owner_mobile_push where organization_id=p_org and id=p_id and state='sending' and lease=p_lease for update;
 if not found then raise exception 'LEASE_CHANGED';end if;
 update private.owner_mobile_push set state=p_state,outcome=p_outcome,finished_at=now(),lease_until=null where organization_id=p_org and id=p_id;
 if p_disable then update private.owner_mobile_devices set enabled=false,encrypted_token=repeat('0',50),token_hash=repeat('0',64),revision=revision+1,updated_at=now() where organization_id=p_org and id=p.device_id;end if;
end$$;
create function public.finish_owner_mobile_push(p_org uuid,p_id uuid,p_lease uuid,p_state text,p_outcome text,p_disable boolean) returns void language sql security invoker set search_path='' as $$select private.finish_owner_mobile_push(p_org,p_id,p_lease,p_state,p_outcome,p_disable)$$;
revoke all on private.owner_mobile_devices,private.owner_mobile_push from public,anon,authenticated;
revoke all on function private.mobile_device_active(private.owner_mobile_devices),private.mobile_device_quiet(private.owner_mobile_devices),private.queue_mobile_request() from public,anon,authenticated,service_role;
revoke all on function private.save_owner_mobile_device(uuid,uuid,integer,text,text,text,boolean,boolean,boolean,integer,integer,text),public.save_owner_mobile_device(uuid,uuid,integer,text,text,text,boolean,boolean,boolean,integer,integer,text),private.owner_mobile_settings(uuid),public.owner_mobile_settings(uuid),private.disable_owner_mobile_device(uuid,uuid,integer),public.disable_owner_mobile_device(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function private.save_owner_mobile_device(uuid,uuid,integer,text,text,text,boolean,boolean,boolean,integer,integer,text),public.save_owner_mobile_device(uuid,uuid,integer,text,text,text,boolean,boolean,boolean,integer,integer,text),private.owner_mobile_settings(uuid),public.owner_mobile_settings(uuid),private.disable_owner_mobile_device(uuid,uuid,integer),public.disable_owner_mobile_device(uuid,uuid,integer) to authenticated;
revoke all on function private.claim_owner_mobile_push(),public.claim_owner_mobile_push(),private.finish_owner_mobile_push(uuid,uuid,uuid,text,text,boolean),public.finish_owner_mobile_push(uuid,uuid,uuid,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function private.claim_owner_mobile_push(),public.claim_owner_mobile_push(),private.finish_owner_mobile_push(uuid,uuid,uuid,text,text,boolean),public.finish_owner_mobile_push(uuid,uuid,uuid,text,text,boolean) to service_role;
