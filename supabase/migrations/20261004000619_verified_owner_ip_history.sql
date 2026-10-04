-- Record only a verified owner/admin session. Do not accept anonymous IP assertions.
drop function public.owner_security_event(text,inet,text,uuid);
drop function private.owner_security_event(text,inet,text,uuid);
drop table private.owner_security_config;
create function private.record_owner_session_ip(p_org uuid,p_ip inet) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if p_ip is null or not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 if sid is null then raise exception 'UNAUTHORIZED' using errcode='42501';end if;
 delete from private.owner_signin_events where occurred_at<now()-interval '30 days';
 insert into private.owner_signin_events(organization_id,actor_id,session_id,ip_address,kind)
 values(p_org,auth.uid(),sid,p_ip,'session_seen') on conflict do nothing;
end$$;
create function public.record_owner_session_ip(p_org uuid,p_ip inet) returns void language sql security invoker set search_path='' as $$select private.record_owner_session_ip(p_org,p_ip)$$;
revoke all on function private.record_owner_session_ip(uuid,inet),public.record_owner_session_ip(uuid,inet) from public,anon;
grant execute on function private.record_owner_session_ip(uuid,inet),public.record_owner_session_ip(uuid,inet) to authenticated;
create or replace function private.owner_security_recent(p_org uuid) returns jsonb
language plpgsql security definer stable set search_path='' as $$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('occurredAt',s.occurred_at,'ip',host(s.ip_address),'actorId',s.actor_id) order by s.occurred_at desc)
 from (select occurred_at,ip_address,actor_id from private.owner_signin_events where organization_id=p_org and kind='session_seen' and occurred_at>=now()-interval '30 days' order by occurred_at desc limit 20) s),'[]'::jsonb);
end$$;
