-- Future fully settled invoices only. Existing schemaVersion 1 paid events are never activated.
do $$declare d text;old text:=$old$jsonb_build_object('schemaVersion',1,'paymentId',pid)$old$;begin
 d:=pg_get_functiondef('private.record_payment(uuid,uuid,integer,text,text,timestamp with time zone,boolean,text)'::regprocedure);
 if strpos(d,old)=0 then raise exception 'PAYMENT_BASELINE_CHANGED';end if;
 execute replace(d,old,$new$jsonb_build_object('schemaVersion',2,'paymentId',pid,'recipient',i.snapshot->'recipient'->>'email','review',(select settings->'review' from public.configuration_versions where organization_id=p_org order by version desc limit 1))$new$);
end$$;
create function private.paid_notice_current(p_org uuid,p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outbox o join public.invoices i on i.organization_id=o.organization_id and i.id=o.object_id
 where o.organization_id=p_org and o.id=p_id and o.kind='invoice.paid' and o.payload->>'schemaVersion'='2'
 and i.total_cents>0 and o.payload->>'recipient'=i.snapshot->'recipient'->>'email'
 and coalesce(i.snapshot->'recipient'->>'email','') ~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$'
 and exists(select 1 from public.audit_events a where a.organization_id=p_org and a.object_id=i.id and a.action='invoice.owner_approved')
 and (select coalesce(sum(p.cents),0) from public.payments p where p.organization_id=p_org and p.invoice_id=i.id)=i.total_cents)
$$;
revoke all on function private.paid_notice_current(uuid,uuid) from public,anon,authenticated,service_role;
do $$declare name text;d text;old text:=$kind$'invoice.delivery'$kind$;begin
 foreach name in array array['private.claim_mail_company()','private.claim_outbox(uuid,integer)'] loop
  d:=pg_get_functiondef(name::regprocedure);
  if strpos(d,old)=0 then raise exception 'MAIL_SELECTOR_BASELINE_CHANGED';end if;
  d:=replace(d,old,old||$kind$,'invoice.paid'$kind$);
  if name='private.claim_mail_company()' then
   d:=replace(d,'and o.next_attempt_at<=moment','and (o.kind<>''invoice.paid'' or private.paid_notice_current(o.organization_id,o.id)) and o.next_attempt_at<=moment');
  else
   d:=replace(d,'and x.attempts<10','and (x.kind<>''invoice.paid'' or private.paid_notice_current(p_org,x.id)) and x.attempts<10');
   d:=replace(d,'if not private.gmail_delivery_enabled(p_org) then return;end if;',
    'update public.outbox o set status=''suppressed'',lease_token=null,lease_until=null where o.organization_id=p_org and o.kind=''invoice.paid'' and o.payload->>''schemaVersion''=''2'' and o.status in(''pending'',''failed'',''leased'') and not private.paid_notice_current(p_org,o.id); if not private.gmail_delivery_enabled(p_org) then return;end if;');
  end if;
  execute d;
 end loop;
 d:=pg_get_functiondef('private.begin_delivery(uuid,uuid,uuid)'::regprocedure);
 if strpos(d,'update public.outbox set status=''sending''')=0 then raise exception 'DISPATCH_BASELINE_CHANGED';end if;
 d:=replace(d,'update public.outbox set status=''sending''',
 'if o.kind=''invoice.paid'' and not private.paid_notice_current(p_org,p_id) then update public.outbox set status=''suppressed'',lease_token=null,lease_until=null where organization_id=p_org and id=p_id;return jsonb_build_object(''status'',''suppressed'');end if; update public.outbox set status=''sending''');
 execute d;
end$$;
