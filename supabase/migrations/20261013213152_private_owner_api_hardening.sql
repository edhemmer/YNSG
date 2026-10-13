-- Keep authorization checks unchanged while removing exposed SECURITY DEFINER RPCs.
-- Implementation lives in the private schema; the public API remains invoker-only.
alter function public.calendar_authority(uuid) set schema private;
create function public.calendar_authority(p_org uuid) returns jsonb language sql security invoker set search_path='' as $$select private.calendar_authority(p_org)$$;
revoke all on function private.calendar_authority(uuid),public.calendar_authority(uuid) from public,anon,authenticated,service_role;
grant execute on function private.calendar_authority(uuid),public.calendar_authority(uuid) to authenticated,service_role;

alter function public.calendar_feed_command(uuid,text,text,boolean) set schema private;
create function public.calendar_feed_command(p_org uuid,p_action text,p_hash text,p_details boolean) returns jsonb language sql security invoker set search_path='' as $$select private.calendar_feed_command(p_org,p_action,p_hash,p_details)$$;
revoke all on function private.calendar_feed_command(uuid,text,text,boolean),public.calendar_feed_command(uuid,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function private.calendar_feed_command(uuid,text,text,boolean),public.calendar_feed_command(uuid,text,text,boolean) to authenticated;

alter function public.transactional_mail_status(uuid) set schema private;
create function public.transactional_mail_status(p_org uuid) returns jsonb language sql security invoker set search_path='' as $$select private.transactional_mail_status(p_org)$$;
revoke all on function private.transactional_mail_status(uuid),public.transactional_mail_status(uuid) from public,anon,authenticated,service_role;
grant execute on function private.transactional_mail_status(uuid),public.transactional_mail_status(uuid) to authenticated,service_role;

-- Explicit default-deny policy preserves the existing private sign-in-log isolation.
create policy owner_signin_events_deny on private.owner_signin_events to anon,authenticated using(false) with check(false);
