-- Keep privileged implementations outside the exposed API schema.
alter function public.owner_calendar_blocks(uuid) set schema private;
create function public.owner_calendar_blocks(p_org uuid) returns jsonb language sql security invoker set search_path='' as $$select private.owner_calendar_blocks(p_org)$$;
alter function public.manage_calendar_block(uuid,uuid,integer,timestamptz,timestamptz,boolean,text) set schema private;
create function public.manage_calendar_block(p_org uuid,p_id uuid,p_revision integer,p_start timestamptz,p_end timestamptz,p_remove boolean,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.manage_calendar_block(p_org,p_id,p_revision,p_start,p_end,p_remove,p_key)$$;
alter function public.invite_customer_account(uuid,uuid,text,text) set schema private;
create function public.invite_customer_account(p_org uuid,p_customer uuid,p_email text,p_hash text) returns jsonb language sql security invoker set search_path='' as $$select private.invite_customer_account(p_org,p_customer,p_email,p_hash)$$;
alter function public.claim_customer_account(text) set schema private;
create function public.claim_customer_account(p_hash text) returns jsonb language sql security invoker set search_path='' as $$select private.claim_customer_account(p_hash)$$;
alter function public.platform_owner_accounts(integer) set schema private;
create function public.platform_owner_accounts(p_page integer default 0) returns jsonb language sql security invoker set search_path='' as $$select private.platform_owner_accounts(p_page)$$;
revoke all on function public.owner_calendar_blocks(uuid),public.manage_calendar_block(uuid,uuid,integer,timestamptz,timestamptz,boolean,text),public.invite_customer_account(uuid,uuid,text,text),public.claim_customer_account(text),public.platform_owner_accounts(integer) from public,anon,service_role;
grant execute on function public.owner_calendar_blocks(uuid),public.manage_calendar_block(uuid,uuid,integer,timestamptz,timestamptz,boolean,text),public.invite_customer_account(uuid,uuid,text,text),public.claim_customer_account(text),public.platform_owner_accounts(integer) to authenticated;
