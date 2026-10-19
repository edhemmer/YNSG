create table private.invoice_credits(
 organization_id uuid not null,id uuid not null default gen_random_uuid(),invoice_id uuid not null,sequence integer not null check(sequence>0),
 subtotal_cents integer not null check(subtotal_cents between -999999999 and 999999999),total_cents integer not null check(total_cents between -999999999 and 999999999 and total_cents<>0),
 tax_components jsonb not null check(jsonb_typeof(tax_components)='array' and jsonb_array_length(tax_components)<=8),reason text not null check(length(trim(reason)) between 10 and 300),
 issued_at timestamptz not null default now(),actor_id uuid not null references auth.users(id),reverses_id uuid,
 primary key(organization_id,id),unique(organization_id,invoice_id,sequence),foreign key(organization_id,invoice_id) references public.invoices(organization_id,id),foreign key(organization_id,reverses_id) references private.invoice_credits(organization_id,id),
 check((reverses_id is null and subtotal_cents>=0 and total_cents>0) or (reverses_id is not null and subtotal_cents<=0 and total_cents<0)));
create unique index one_invoice_credit_reversal on private.invoice_credits(organization_id,reverses_id) where reverses_id is not null;
create index invoice_credits_dates on private.invoice_credits(organization_id,issued_at,id);
create index invoice_credits_actor on private.invoice_credits(actor_id);
alter table private.invoice_credits enable row level security;
create policy invoice_credits_deny on private.invoice_credits to anon,authenticated using(false) with check(false);
revoke all on private.invoice_credits from public,anon,authenticated,service_role;
create trigger invoice_credits_immutable before update or delete on private.invoice_credits for each row execute function private.immutable_record();
alter table public.journal_entries drop constraint journal_entries_source_kind_check;
alter table public.journal_entries add constraint journal_entries_source_kind_check check(source_kind in('invoice','payment','reversal','expense','credit'));
create function private.invoice_credit_total(p_org uuid,p_invoice uuid) returns bigint language sql stable security definer set search_path='' as $$select coalesce(sum(total_cents::bigint),0) from private.invoice_credits where organization_id=p_org and invoice_id=p_invoice$$;
revoke all on function private.invoice_credit_total(uuid,uuid) from public,anon,authenticated,service_role;
create function private.invoice_credit_json(c private.invoice_credits) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('id',c.id,'invoiceId',c.invoice_id,'subtotalCents',c.subtotal_cents,'totalCents',c.total_cents,'taxComponents',c.tax_components,'reason',c.reason,'issuedAt',c.issued_at,'reversesId',c.reverses_id)$$;
revoke all on function private.invoice_credit_json(private.invoice_credits) from public,anon,authenticated,service_role;
create function private.invoice_credit_context(p_org uuid,p_invoice uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare i public.invoices;components jsonb;items jsonb;n integer;subtotal integer;paid bigint;
begin
 select * into i from public.invoices where organization_id=p_org and id=p_invoice;
 if not found then raise exception 'NOT_FOUND' using errcode='42501';end if;
 if auth.role() is distinct from 'service_role' and not private.staff(p_org,array['owner','admin','bookkeeper']) and not private.customer_allowed(p_org,i.customer_id,true,false) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 subtotal:=i.total_cents-coalesce((i.snapshot->>'taxCents')::integer,0);
 select coalesce(jsonb_agg(jsonb_build_object('kind',c->>'kind','label',c->>'label','ratePpm',(c->>'ratePpm')::integer,'taxCents',(c->>'taxCents')::integer) order by ord),'[]') into components from jsonb_array_elements(coalesce(i.snapshot->'tax'->'components','[]')) with ordinality as x(c,ord);
 select coalesce(jsonb_agg(private.invoice_credit_json(c) order by c.sequence),'[]'),count(*) into items,n from private.invoice_credits c where c.organization_id=p_org and c.invoice_id=p_invoice;
 if n>10000 then raise exception 'CREDIT_HISTORY_TOO_LARGE';end if;
 select coalesce(sum(cents::bigint),0) into paid from public.payments where organization_id=p_org and invoice_id=p_invoice;
 return jsonb_build_object('invoiceId',p_invoice,'totalCents',i.total_cents,'subtotalCents',subtotal,'taxComponents',components,'paidCents',paid,'revision',n,'canIssue',private.staff(p_org,array['owner','admin']),'credits',items);
end$$;
create function private.invoice_credit_contexts(p_org uuid,p_invoices uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb:='[]';target uuid;item jsonb;n integer:=0;
begin
 if p_invoices is null or cardinality(p_invoices)>1000 or cardinality(p_invoices)<>(select count(distinct id) from unnest(p_invoices) id) then raise exception 'VALIDATION';end if;
 foreach target in array p_invoices loop item:=private.invoice_credit_context(p_org,target);n:=n+jsonb_array_length(item->'credits');if n>10000 then raise exception 'CREDIT_HISTORY_TOO_LARGE';end if;result:=result||jsonb_build_array(item);end loop;return result;
end$$;
create function public.invoice_credit_contexts(p_org uuid,p_invoices uuid[]) returns jsonb language sql stable security invoker set search_path='' as $$select private.invoice_credit_contexts(p_org,p_invoices)$$;
revoke all on function private.invoice_credit_context(uuid,uuid),private.invoice_credit_contexts(uuid,uuid[]),public.invoice_credit_contexts(uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function private.invoice_credit_contexts(uuid,uuid[]),public.invoice_credit_contexts(uuid,uuid[]) to authenticated,service_role;
create function private.invoice_credit_command(p_org uuid,p_invoice uuid,p_revision integer,p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invoices;prior private.command_receipts;fingerprint text;result jsonb;original private.invoice_credits;fresh private.invoice_credits;context jsonb;tax jsonb:='[]';c jsonb;v bigint;available bigint;subtotal bigint;total bigint;n integer;idx integer:=0;tax_total bigint:=0;jid uuid;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_key is null or p_revision is null or p_revision<0 or p_revision>=10000 or jsonb_typeof(p_data) is distinct from 'object' or jsonb_typeof(p_data->'action') is distinct from 'string' or p_data->>'action' not in('issue','reverse') or jsonb_typeof(p_data->'reason') is distinct from 'string' or p_data->'reviewed' is distinct from 'true'::jsonb or length(trim(coalesce(p_data->>'reason',''))) not between 10 and 300 or length(p_data::text)>8000 then raise exception 'VALIDATION';end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in('action','reviewed','reason','subtotalCents','taxCents','credit')) then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_invoice,p_revision,p_data,auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':invoice-credit:'||p_key,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='InvoiceCredit' and key=p_key::text;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into i from public.invoices where organization_id=p_org and id=p_invoice for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if exists(select 1 from private.card_orders where organization_id=p_org and invoice_id=p_invoice and status in('prepared','open')) then raise exception 'CARD_PAYMENT_PENDING';end if;
 context:=private.invoice_credit_context(p_org,p_invoice);n:=(context->>'revision')::integer;
 if p_revision<>n then raise exception 'STALE_REVISION';end if;
 if (context->>'subtotalCents')::bigint<0 or (context->>'subtotalCents')::bigint+(select coalesce(sum((x->>'taxCents')::bigint),0) from jsonb_array_elements(context->'taxComponents') x)<>i.total_cents then raise exception 'INVOICE_TAX_REVIEW_REQUIRED';end if;
 if p_data->>'action'='issue' then
  if jsonb_typeof(p_data->'subtotalCents') is distinct from 'number' or (p_data->>'subtotalCents')!~'^[0-9]{1,9}$' or jsonb_typeof(p_data->'taxCents') is distinct from 'array' or jsonb_array_length(p_data->'taxCents')<>jsonb_array_length(context->'taxComponents') or p_data ? 'credit' then raise exception 'VALIDATION';end if;
  subtotal:=(p_data->>'subtotalCents')::bigint;
  if subtotal>(context->>'subtotalCents')::bigint-(select coalesce(sum(subtotal_cents::bigint),0) from private.invoice_credits where organization_id=p_org and invoice_id=p_invoice) then raise exception 'CREDIT_COMPONENT_EXCEEDED';end if;
  for c in select value from jsonb_array_elements(context->'taxComponents') loop
   if jsonb_typeof(p_data->'taxCents'->idx) is distinct from 'number' or (p_data->'taxCents'->>idx)!~'^[0-9]{1,9}$' then raise exception 'VALIDATION';end if;
   v:=(p_data->'taxCents'->>idx)::bigint;
   select (c->>'taxCents')::bigint-coalesce(sum((ic.tax_components->idx->>'taxCents')::bigint),0) into available from private.invoice_credits ic where ic.organization_id=p_org and ic.invoice_id=p_invoice;
   if v>available then raise exception 'CREDIT_COMPONENT_EXCEEDED';end if;
   tax:=tax||jsonb_build_array(jsonb_set(c,'{taxCents}',to_jsonb(v)));tax_total:=tax_total+v;idx:=idx+1;
  end loop;
  total:=subtotal+tax_total;
  if total<=0 or total>i.total_cents-private.invoice_credit_total(p_org,p_invoice)-(context->>'paidCents')::bigint then raise exception 'CREDIT_EXCEEDS_BALANCE';end if;
 else
  if p_data ? 'subtotalCents' or p_data ? 'taxCents' or jsonb_typeof(p_data->'credit') is distinct from 'string' then raise exception 'VALIDATION';end if;
  select * into original from private.invoice_credits where organization_id=p_org and invoice_id=p_invoice and id=(p_data->>'credit')::uuid;
  if not found or original.reverses_id is not null then raise exception 'NOT_FOUND';end if;
  if exists(select 1 from private.invoice_credits where organization_id=p_org and reverses_id=original.id) then raise exception 'ALREADY_REVERSED';end if;
  subtotal:=-original.subtotal_cents;total:=-original.total_cents;
  select coalesce(jsonb_agg(jsonb_set(t,'{taxCents}',to_jsonb(-(t->>'taxCents')::integer)) order by ord),'[]') into tax from jsonb_array_elements(original.tax_components) with ordinality x(t,ord);
  tax_total:=total-subtotal;
 end if;
 insert into private.invoice_credits(organization_id,invoice_id,sequence,subtotal_cents,total_cents,tax_components,reason,actor_id,reverses_id) values(p_org,p_invoice,n+1,subtotal,total,tax,trim(p_data->>'reason'),auth.uid(),original.id) returning * into fresh;
 insert into public.journal_entries(organization_id,source_kind,source_id) values(p_org,'credit',fresh.id) returning id into jid;
 insert into public.journal_lines(organization_id,entry_id,account,debit_cents,credit_cents) values(p_org,jid,'receivable',greatest(-total,0),greatest(total,0));
 if subtotal<>0 then insert into public.journal_lines(organization_id,entry_id,account,debit_cents,credit_cents) values(p_org,jid,'labor_revenue',greatest(subtotal,0),greatest(-subtotal,0));end if;
 if tax_total<>0 then insert into public.journal_lines(organization_id,entry_id,account,debit_cents,credit_cents) values(p_org,jid,'tax_payable',greatest(tax_total,0),greatest(-tax_total,0));end if;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),case when fresh.reverses_id is null then 'invoice.credited' else 'invoice.credit_corrected' end,p_invoice,n+1,p_key);
 update public.outbox set status='suppressed',lease_token=null,lease_until=null where organization_id=p_org and object_id=p_invoice and kind='invoice.paid' and status in('pending','failed','leased') and not private.paid_notice_current(p_org,id);
 result:=jsonb_build_object('revision',n+1,'credit',private.invoice_credit_json(fresh));
 insert into private.command_receipts values(p_org,'InvoiceCredit',p_key::text,fingerprint,result,now());return result;
end$$;
create function public.invoice_credit_command(p_org uuid,p_invoice uuid,p_revision integer,p_data jsonb,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select private.invoice_credit_command(p_org,p_invoice,p_revision,p_data,p_key)$$;
revoke all on function private.invoice_credit_command(uuid,uuid,integer,jsonb,uuid),public.invoice_credit_command(uuid,uuid,integer,jsonb,uuid) from public,anon,service_role;
grant execute on function private.invoice_credit_command(uuid,uuid,integer,jsonb,uuid),public.invoice_credit_command(uuid,uuid,integer,jsonb,uuid) to authenticated;
-- Consequential commands serialize on the same immutable invoice row. Net
-- receivables are original charges minus retained credits, never fake receipts.
do $$declare d text;s regprocedure;begin
 foreach s in array array['private.record_payment(uuid,uuid,integer,text,text,timestamptz,boolean,text)'::regprocedure,'private.reverse_recorded_payment(uuid,uuid,uuid,text,text)'::regprocedure,'private.prepare_card_payment(uuid,uuid,integer,text)'::regprocedure] loop
  d:=pg_get_functiondef(s);if position('i.total_cents' in d)=0 then raise exception 'INVOICE_BALANCE_BASELINE_CHANGED';end if;
  execute replace(d,'i.total_cents','(i.total_cents-private.invoice_credit_total(p_org,p_invoice))');
 end loop;
 d:=pg_get_functiondef('private.paid_notice_current(uuid,uuid)'::regprocedure);if position('i.total_cents' in d)=0 then raise exception 'PAID_NOTICE_BASELINE_CHANGED';end if;execute replace(d,'i.total_cents','(i.total_cents-private.invoice_credit_total(p_org,i.id))');
end$$;

create or replace function private.financial_reconciliation(p_org uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text;start_at timestamptz;end_at timestamptz;opening bigint;closing bigint;events jsonb;n integer;
begin
 if not private.staff(p_org,array['owner','admin','bookkeeper']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 or p_from<date '0001-01-01' or p_to>=date '9999-12-31' then raise exception 'VALIDATION';end if;
 select timezone into tz from public.organizations where id=p_org;
 start_at:=p_from::timestamp at time zone tz;end_at:=(p_to+1)::timestamp at time zone tz;
 select coalesce((select sum(i.total_cents::bigint) from public.invoices i where i.organization_id=p_org and i.issued_at<start_at),0)-coalesce((select sum(p.cents::bigint) from public.payments p where p.organization_id=p_org and p.received_at<start_at),0)-coalesce((select sum(c.total_cents::bigint) from private.invoice_credits c where c.organization_id=p_org and c.issued_at<start_at),0) into opening;
 select coalesce((select sum(i.total_cents::bigint) from public.invoices i where i.organization_id=p_org and i.issued_at<end_at),0)-coalesce((select sum(p.cents::bigint) from public.payments p where p.organization_id=p_org and p.received_at<end_at),0)-coalesce((select sum(c.total_cents::bigint) from private.invoice_credits c where c.organization_id=p_org and c.issued_at<end_at),0) into closing;
 with activity as (
  select 'invoice'::text kind,i.id::text id,i.id related_id,i.number::text reference,(i.issued_at at time zone tz)::date business_date,i.total_cents::bigint invoice_cents,0::bigint receipt_cents,0::bigint expense_cents,0::bigint fee_cents
  from public.invoices i where i.organization_id=p_org and i.issued_at>=start_at and i.issued_at<end_at
  union all
  select case when p.cents<0 then 'receipt_correction' else 'receipt' end,p.id::text,p.invoice_id,i.number::text,(p.received_at at time zone tz)::date,0,p.cents::bigint,0,0
  from public.payments p join public.invoices i on i.organization_id=p.organization_id and i.id=p.invoice_id where p.organization_id=p_org and p.received_at>=start_at and p.received_at<end_at
  union all
  select case when c.reverses_id is null then 'invoice_credit' else 'credit_correction' end,c.id::text,c.invoice_id,i.number::text,(c.issued_at at time zone tz)::date,-c.total_cents::bigint,0,0,0 from private.invoice_credits c join public.invoices i on i.organization_id=c.organization_id and i.id=c.invoice_id where c.organization_id=p_org and c.issued_at>=start_at and c.issued_at<end_at
  union all
  select 'expense',e.id::text,e.id,e.vendor,e.expense_date,0,0,e.amount_cents::bigint,0 from public.business_expenses e where e.organization_id=p_org and e.expense_date between p_from and p_to
  union all
  select 'expense_correction',r.expense_id::text,r.expense_id,e.vendor,(r.reversed_at at time zone tz)::date,0,0,-e.amount_cents::bigint,0
  from public.business_expense_reversals r join public.business_expenses e on e.organization_id=r.organization_id and e.id=r.expense_id where r.organization_id=p_org and r.reversed_at>=start_at and r.reversed_at<end_at
  union all
  select 'processor_fee',t.provider_id,o.invoice_id,i.number::text,(t.occurred_at at time zone tz)::date,0,0,0,t.fee_cents::bigint
  from private.card_transactions t join private.card_orders o on o.organization_id=t.organization_id and o.id=t.order_id join public.invoices i on i.organization_id=o.organization_id and i.id=o.invoice_id
  where t.organization_id=p_org and t.kind in('payment','refund') and t.fee_cents<>0 and t.occurred_at>=start_at and t.occurred_at<end_at
 ), bounded as (select * from activity order by business_date,kind,id limit 10001)
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'relatedId',related_id,'reference',reference,'businessDate',business_date,'invoiceCents',invoice_cents,'receiptCents',receipt_cents,'expenseCents',expense_cents,'feeCents',fee_cents) order by business_date,kind,id),'[]'),count(*) into events,n from bounded;
 if n>10000 then raise exception 'EXPORT_RANGE_TOO_LARGE';end if;
 return jsonb_build_object('organization',p_org,'from',p_from,'to',p_to,'timezone',tz,'complete',true,'openingReceivableCents',opening,'closingReceivableCents',closing,'rows',events);
end$$;
-- Preserve dated expense/processor behavior while including dated credits.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('private.finance_activity(uuid,date,date)'::regprocedure);
 needle:='select coalesce(sum(i.total_cents::bigint),0) into issued from public.invoices i where i.organization_id=p_org and timezone(tz,i.issued_at)::date between p_from and p_to;';
 if position(needle in d)=0 then raise exception 'FINANCE_CREDIT_BASELINE_CHANGED';end if;
 d:=replace(d,needle,needle||' issued:=issued-(select coalesce(sum(c.total_cents::bigint),0) from private.invoice_credits c where c.organization_id=p_org and timezone(tz,c.issued_at)::date between p_from and p_to);');
 needle:='return jsonb_build_object(';
 d:=replace(d,needle,'outstanding:=outstanding-(select coalesce(sum(c.total_cents::bigint),0) from private.invoice_credits c where c.organization_id=p_org and timezone(tz,c.issued_at)::date<=p_to); '||needle);execute d;
 d:=pg_get_functiondef('private.manage_customer_record(uuid,jsonb,text)'::regprocedure);
 if position('i.total_cents>' in d)=0 then raise exception 'CUSTOMER_CREDIT_BASELINE_CHANGED';end if;
 execute replace(d,'i.total_cents>','(i.total_cents-private.invoice_credit_total(p_org,i.id))>');
end$$;
-- Credit events retain their actual business dates and issued tax evidence.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('private.tax_workspace(uuid,integer)'::regprocedure);
 d:=replace(d,'invoices jsonb;','invoices jsonb;credits jsonb;');
 needle:='''paidCents'',coalesce';if position(needle in d)=0 then raise exception 'TAX_CREDIT_BASELINE_CHANGED';end if;
 d:=replace(d,needle,'''creditedCents'',private.invoice_credit_total(p_org,i.id),'||needle);
 needle:='return jsonb_build_object(''profile''';if position(needle in d)=0 then raise exception 'TAX_CREDIT_RESULT_BASELINE_CHANGED';end if;
 d:=replace(d,needle,'select coalesce(jsonb_agg(private.invoice_credit_json(c)||jsonb_build_object(''invoiceNumber'',i.number) order by c.issued_at,c.id),''[]'') into credits from private.invoice_credits c join public.invoices i on i.organization_id=c.organization_id and i.id=c.invoice_id where c.organization_id=p_org and extract(year from timezone(tz,c.issued_at))=p_year; '||needle);
 d:=replace(d,'''invoices'',invoices,','''invoices'',invoices,''credits'',credits,');execute d;
end$$;
