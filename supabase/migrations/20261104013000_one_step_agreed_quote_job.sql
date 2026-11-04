-- Save the agreed work and price and prepare its job in one atomic owner action.
-- No second phone/in-person/text approval form; no implied customer consent for a quote-only save.
create function private.save_agreed_quote_and_prepare_job(
 p_org uuid,p_request uuid,p_revision integer,p_scope text,p_minutes integer,
 p_community boolean,p_eligibility_reviewed boolean,p_customer uuid,p_key text,
 p_people integer,p_rate integer,p_total integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q jsonb;j jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 q:=private.publish_flexible_quote(p_org,p_request,p_revision,p_scope,p_minutes,p_community,p_eligibility_reviewed,p_customer,p_key,p_people,p_rate,p_total);
 -- This command is selected only when the owner confirms work and price are already agreed.
 -- The saved quote is the record; there is no separate customer approval interaction.
 j:=private.approve_quote(p_org,(q->>'id')::uuid,(q->>'version')::integer,
  'Owner confirmed that the customer already agreed to the saved work and price. Recorded during one-step job preparation.');
 return jsonb_build_object('id',j->>'id','jobId',j->>'id','quoteId',q->>'id','version',q->>'version','requestRevision',q->>'requestRevision');
end $$;
create function public.save_agreed_quote_and_prepare_job(
 p_org uuid,p_request uuid,p_revision integer,p_scope text,p_minutes integer,
 p_community boolean,p_eligibility_reviewed boolean,p_customer uuid,p_key text,
 p_people integer,p_rate integer,p_total integer
) returns jsonb language sql security invoker set search_path='' as $$
 select private.save_agreed_quote_and_prepare_job(p_org,p_request,p_revision,p_scope,p_minutes,p_community,p_eligibility_reviewed,p_customer,p_key,p_people,p_rate,p_total) $$;
revoke all on function private.save_agreed_quote_and_prepare_job(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text,integer,integer,integer),public.save_agreed_quote_and_prepare_job(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text,integer,integer,integer) from public,anon,service_role;
grant execute on function private.save_agreed_quote_and_prepare_job(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text,integer,integer,integer),public.save_agreed_quote_and_prepare_job(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text,integer,integer,integer) to authenticated;

-- Existing quote-only drafts can be prepared with one action, without asking
-- the owner to select or enter an artificial approval method.
create function private.prepare_agreed_quote_job(p_org uuid,p_quote uuid,p_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return private.approve_quote(p_org,p_quote,p_version,
  'Owner confirmed that the customer already agreed to the saved work and price. Job prepared without a separate approval form.');
end $$;
create function public.prepare_agreed_quote_job(p_org uuid,p_quote uuid,p_version integer)
returns jsonb language sql security invoker set search_path='' as $$
 select private.prepare_agreed_quote_job(p_org,p_quote,p_version) $$;
revoke all on function private.prepare_agreed_quote_job(uuid,uuid,integer),public.prepare_agreed_quote_job(uuid,uuid,integer) from public,anon,service_role;
grant execute on function private.prepare_agreed_quote_job(uuid,uuid,integer),public.prepare_agreed_quote_job(uuid,uuid,integer) to authenticated;
