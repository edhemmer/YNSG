create function private.authorize_record_export(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.staff(p_org,array['owner','admin','bookkeeper']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from auth.sessions s where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid() and s.created_at<=clock_timestamp() and s.created_at>=clock_timestamp()-interval '15 minutes' and (s.not_after is null or s.not_after>clock_timestamp())) then raise exception 'REAUTHENTICATION_REQUIRED';end if;
 return jsonb_build_object('organization',p_org,'authorized',true);
end$$;
create function public.authorize_record_export(p_org uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.authorize_record_export(p_org)$$;
revoke all on function private.authorize_record_export(uuid),public.authorize_record_export(uuid) from public,anon,service_role;
grant execute on function private.authorize_record_export(uuid),public.authorize_record_export(uuid) to authenticated;
-- Preserve the original canonical checks and append-only audit while guarding
-- direct RPC callers as well as the application download entry point.
do $$declare d text;begin
 d:=pg_get_functiondef('public.audit_customer_export(uuid,uuid,uuid)'::regprocedure);
 d:=replace(d,'BEGIN','BEGIN PERFORM private.authorize_record_export(p_org);');
 d:=replace(d,E'begin\n',E'begin\n perform private.authorize_record_export(p_org);\n');
 if position('perform private.authorize_record_export' in lower(d))=0 then raise exception 'EXPORT_AUDIT_BASELINE_CHANGED';end if;execute d;
 d:=pg_get_functiondef('private.accounting_journal_export(uuid,date,date)'::regprocedure);
 d:=replace(d,'BEGIN','BEGIN PERFORM private.authorize_record_export(p_org);');
 d:=replace(d,E'begin\n',E'begin\n perform private.authorize_record_export(p_org);\n');
 if position('perform private.authorize_record_export' in lower(d))=0 then raise exception 'ACCOUNTING_EXPORT_BASELINE_CHANGED';end if;execute d;
end$$;
