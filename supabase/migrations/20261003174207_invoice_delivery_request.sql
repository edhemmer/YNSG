-- Explicit owner-reviewed delivery is distinct from issuance and grants no activation.
create function private.request_invoice_delivery(p_org uuid,p_invoice uuid,p_reviewed boolean,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare inv public.invoices; prior private.command_receipts; fingerprint text; result jsonb; notice public.outbox;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_reviewed is distinct from true or p_key is null or length(p_key) not between 16 and 128 then raise exception 'INVOICE_REVIEW_REQUIRED';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_invoice,p_reviewed)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':invoice-delivery:'||p_invoice::text,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='SendInvoice' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into inv from public.invoices where organization_id=p_org and id=p_invoice;
 if not found then raise exception 'NOT_FOUND';end if;
 if not exists(select 1 from public.audit_events where organization_id=p_org and object_id=p_invoice and action='invoice.owner_approved') then raise exception 'INVOICE_APPROVAL_REQUIRED';end if;
 if coalesce(inv.snapshot->'recipient'->>'email','') !~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$' then raise exception 'INVOICE_CUSTOMER_DETAILS_REQUIRED';end if;
 select * into notice from public.outbox where organization_id=p_org and event_key='invoice:'||p_invoice||':delivery';
 if not found then
  if not private.gmail_delivery_enabled(p_org) then raise exception 'GMAIL_RECEIPT_REQUIRED';end if;
  insert into public.outbox(organization_id,event_key,kind,object_id,payload)
  values(p_org,'invoice:'||p_invoice||':delivery','invoice.delivery',p_invoice,jsonb_build_object('schemaVersion',1,'recipient',inv.snapshot->'recipient'->>'email')) returning * into notice;
  insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
  values(p_org,auth.uid(),'invoice.delivery_requested',p_invoice,1,gen_random_uuid());
 end if;
 result:=jsonb_build_object('id',notice.id,'status',notice.status);
 insert into private.command_receipts values(p_org,'SendInvoice',p_key,fingerprint,result,now());return result;
end$$;
create function public.request_invoice_delivery(p_org uuid,p_invoice uuid,p_reviewed boolean,p_key text) returns jsonb
language sql security invoker set search_path='' as $$select private.request_invoice_delivery(p_org,p_invoice,p_reviewed,p_key)$$;
revoke all on function private.request_invoice_delivery(uuid,uuid,boolean,text),public.request_invoice_delivery(uuid,uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function private.request_invoice_delivery(uuid,uuid,boolean,text),public.request_invoice_delivery(uuid,uuid,boolean,text) to authenticated;
-- Only explicit invoice.delivery enters the due selectors; invoice.issued remains excluded.
do $$declare name text;d text;old text:=$kind$'request.owner_notification'$kind$;begin
 foreach name in array array['private.claim_mail_company()','private.claim_outbox(uuid,integer)'] loop
  d:=pg_get_functiondef(name::regprocedure);
  if strpos(d,old)=0 then raise exception 'invoice selector baseline changed';end if;
  execute replace(d,old,old||$kind$,'invoice.delivery'$kind$);
 end loop;
end$$;
