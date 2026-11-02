-- Reauthorize one Google account without first removing working credentials,
-- its selected calendar, or its retained receipt-confirmed mail authorization.
-- Only the server can submit verified Google identity and calendar ownership.
do $migration$
declare definition text;marker text:='if p_action=''connect'' then';addition text;
begin
 definition:=pg_get_functiondef('private.google_store(uuid,text,jsonb)'::regprocedure);
 if strpos(definition,marker)=0 then raise exception 'Google reconnect baseline changed';end if;
 addition:=$body$
 if p_action='reconnect' then
  if p_input->>'subject' is null or p_input->>'email' is null or p_input->>'ciphertext' is null
   or jsonb_typeof(p_input->'scopes') is distinct from 'array' or jsonb_array_length(p_input->'scopes')>20
   or not exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id
    where m.organization_id=p_org and m.user_id=(p_input->>'actor')::uuid and m.role in('owner','admin') and m.revoked_at is null and u.email_confirmed_at is not null and u.deleted_at is null)
   then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if not (p_input->'scopes' @> '["openid","https://www.googleapis.com/auth/userinfo.email","https://www.googleapis.com/auth/gmail.send","https://www.googleapis.com/auth/calendar.calendarlist.readonly","https://www.googleapis.com/auth/calendar.events.owned","https://www.googleapis.com/auth/calendar.freebusy","https://www.googleapis.com/auth/calendar.app.created"]'::jsonb)
   then raise exception 'MISSING_GOOGLE_SCOPES';end if;
  -- Existing identity is a reconnect boundary, never an implicit account switch.
  if coalesce(a.subject,(select account_subject from private.mail_delivery_controls where organization_id=p_org)) is not null
   and coalesce(a.subject,(select account_subject from private.mail_delivery_controls where organization_id=p_org)) is distinct from p_input->>'subject'
   then raise exception 'GOOGLE_ACCOUNT_MISMATCH';end if;
  if a.email is not null and lower(trim(a.email)) is distinct from lower(trim(p_input->>'email')) then raise exception 'GOOGLE_ACCOUNT_MISMATCH';end if;
  if a.calendar_id is not null and (a.calendar_id is distinct from p_input->>'calendarId' or p_input->>'calendarVerified' is distinct from 'true')
   then raise exception 'CALENDAR_RECONNECT_REVIEW_REQUIRED';end if;
  update private.google_accounts g set encrypted_tokens=p_input->>'ciphertext',email=p_input->>'email',subject=p_input->>'subject',
   scopes=array(select jsonb_array_elements_text(p_input->'scopes')),health='healthy',checked_at=clock_timestamp(),
   revision=g.revision+1,updated_at=clock_timestamp(),
   gmail_test=case when a.subject=p_input->>'subject' and lower(trim(a.email))=lower(trim(p_input->>'email')) and a.gmail_test='accepted' then a.gmail_test
    when exists(select 1 from private.mail_delivery_controls d join public.configuration_versions c on c.organization_id=d.organization_id and c.version=d.configuration_version
     where d.organization_id=p_org and d.enabled and d.account_subject=p_input->>'subject' and d.test_key is not null and d.receipt_confirmed_at is not null and d.receipt_confirmed_by is not null and lower(trim(c.settings->>'sender'))=lower(trim(p_input->>'email'))) then 'accepted' else 'not_tested' end,
   test_key=case when a.subject=p_input->>'subject' and lower(trim(a.email))=lower(trim(p_input->>'email')) and a.gmail_test='accepted' then a.test_key
    else (select d.test_key from private.mail_delivery_controls d join public.configuration_versions c on c.organization_id=d.organization_id and c.version=d.configuration_version
     where d.organization_id=p_org and d.enabled and d.account_subject=p_input->>'subject' and d.receipt_confirmed_at is not null and d.receipt_confirmed_by is not null and lower(trim(c.settings->>'sender'))=lower(trim(p_input->>'email'))) end
   where g.organization_id=p_org returning * into a;
  insert into public.integration_connections(organization_id,provider,status,last_success_at,last_error,secret_ref)
   values(p_org,'google_calendar',case when a.calendar_id is null then 'configured' else 'active' end,a.checked_at,null,null),
   (p_org,'gmail',case when private.gmail_delivery_enabled(p_org) then 'active' else 'test' end,a.checked_at,null,case when private.gmail_delivery_enabled(p_org) then 'google-account:'||p_org else null end)
   on conflict(organization_id,provider) do update set status=excluded.status,last_success_at=excluded.last_success_at,last_error=null,secret_ref=excluded.secret_ref;
  insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
   values(p_org,(p_input->>'actor')::uuid,'google.reconnect',p_org,a.revision,gen_random_uuid());
  -- No dispatcher/worker toggle, mail intent, test message, new calendar or event.
  return to_jsonb(a);
 end if;
 $body$;
 execute replace(definition,marker,addition||marker);
end $migration$;
