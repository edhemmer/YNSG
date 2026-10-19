-- Selected wording and decline transition commit together; original submission stays immutable.
create function private.decline_service_request_with_message(p_org uuid,p_id uuid,p_revision integer,p_reason text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous private.command_receipts; fingerprint text; result jsonb; changed integer;
begin
 if not private.staff(p_org,array['owner','admin','dispatcher']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_reason is null or length(btrim(p_reason)) not between 2 and 1000 or p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_revision,p_reason,auth.uid())::text,'UTF8')),'hex');
 -- Same lock as the underlying legacy command also prevents mixing old/new attempts.
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':review:'||p_key,0));
 select * into previous from private.command_receipts where organization_id=p_org and command='DeclineRequestWithMessage' and key=p_key;
 if found then
  if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return previous.result;
 end if;
 if exists(select 1 from private.command_receipts where organization_id=p_org and command='ReviewRequest' and key=p_key) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 result:=private.review_service_request(p_org,p_id,p_revision,'declined',p_key);
 update public.outbox set payload=payload||jsonb_build_object('reason',p_reason)
 where organization_id=p_org and kind='request.declined' and object_id=p_id
 and event_key='request:'||p_id||':'||(result->>'revision')||':declined';
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'DECLINE_NOTICE_REQUIRED';end if;
 insert into private.command_receipts values(p_org,'DeclineRequestWithMessage',p_key,fingerprint,result,now());
 return result;
end $$;
create function public.decline_service_request_with_message(p_org uuid,p_id uuid,p_revision integer,p_reason text,p_key text) returns jsonb
language sql security invoker set search_path='' as $$select private.decline_service_request_with_message(p_org,p_id,p_revision,p_reason,p_key)$$;
revoke all on function private.decline_service_request_with_message(uuid,uuid,integer,text,text),public.decline_service_request_with_message(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function private.decline_service_request_with_message(uuid,uuid,integer,text,text),public.decline_service_request_with_message(uuid,uuid,integer,text,text) to authenticated;
