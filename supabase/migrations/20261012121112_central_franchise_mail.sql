-- One platform sender, with separately approved contacts and permission per business.
alter table private.transactional_mail_controls add column provider text not null default 'relay' check(provider in('relay','resend'));
create or replace function public.transactional_mail_status(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.jwt()->>'role' is distinct from 'service_role' and not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return coalesce((select jsonb_build_object('enabled',private.transactional_mail_enabled(p_org),'provider',provider,'origin',origin,'sender',sender,'verifiedAt',verified_at) from private.transactional_mail_controls where organization_id=p_org),jsonb_build_object('enabled',false));
end$$;
revoke all on function public.transactional_mail_status(uuid) from public,anon;
grant execute on function public.transactional_mail_status(uuid) to authenticated,service_role;
do $$declare d text;begin
 d:=pg_get_functiondef('public.activate_transactional_mail(uuid,uuid,uuid,text,text)'::regprocedure);
 if strpos(d,'do update set enabled=true,origin=')=0 then raise exception 'activation baseline changed';end if;
 execute replace(d,'do update set enabled=true,origin=','do update set enabled=true,provider=''relay'',origin=');
end$$;
create function private.activate_central_mail(p_org uuid,p_actor uuid,p_session uuid,p_origin text,p_sender text) returns void language plpgsql security definer set search_path='' as $$begin
 -- Existing activation independently validates live session, membership and contacts.
 perform public.activate_transactional_mail(p_org,p_actor,p_session,p_origin,p_sender);
 update private.transactional_mail_controls set provider='resend' where organization_id=p_org;
end$$;
create function public.activate_central_mail(p_org uuid,p_actor uuid,p_session uuid,p_origin text,p_sender text) returns void language sql security invoker set search_path='' as $$select private.activate_central_mail(p_org,p_actor,p_session,p_origin,p_sender)$$;
revoke all on function private.activate_central_mail(uuid,uuid,uuid,text,text),public.activate_central_mail(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function private.activate_central_mail(uuid,uuid,uuid,text,text),public.activate_central_mail(uuid,uuid,uuid,text,text) to service_role;
create function private.pause_transactional_mail(p_org uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 update private.transactional_mail_controls set enabled=false where organization_id=p_org;
 update private.mail_delivery_controls set enabled=false where organization_id=p_org;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'transactional_mail.paused',p_org,1,gen_random_uuid());
end$$;
create function public.pause_transactional_mail(p_org uuid) returns void language sql security invoker set search_path='' as $$select private.pause_transactional_mail(p_org)$$;
revoke all on function private.pause_transactional_mail(uuid),public.pause_transactional_mail(uuid) from public,anon,service_role;
grant execute on function private.pause_transactional_mail(uuid),public.pause_transactional_mail(uuid) to authenticated;
