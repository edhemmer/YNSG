-- Preserve the owner's existing sending authorization across unrelated settings
-- edits. Sender/recipient changes, account changes, paused controls and failed
-- receipt checks remain fail-closed. This does not approve a new mail identity.
create or replace function private.gmail_delivery_enabled(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(
 select 1 from private.mail_delivery_controls d
 join private.google_accounts g on g.organization_id=d.organization_id
 join public.organizations o on o.id=d.organization_id
 join public.configuration_versions approved on approved.organization_id=d.organization_id and approved.version=d.configuration_version
 join lateral(select settings from public.configuration_versions where organization_id=p_org order by version desc limit 1) current on true
 where d.organization_id=p_org and d.enabled and d.receipt_confirmed_at is not null and d.receipt_confirmed_by is not null
 and g.encrypted_tokens is not null and g.subject=d.account_subject and g.test_key=d.test_key and g.gmail_test='accepted'
 and lower(trim(g.email))=lower(trim(approved.settings->>'sender'))
 and lower(trim(current.settings->>'sender'))=lower(trim(approved.settings->>'sender'))
 and lower(trim(current.settings->>'notificationRecipient'))=lower(trim(approved.settings->>'notificationRecipient'))
 and o.status='active' and 'https://www.googleapis.com/auth/gmail.send'=any(g.scopes)
 and exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled))
$$;
revoke all on function private.gmail_delivery_enabled(uuid) from public,anon,authenticated,service_role;
update public.integration_connections set status='active',last_error=null
 where provider='gmail' and status='test' and private.gmail_delivery_enabled(organization_id);
