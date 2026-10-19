-- Read-only effective-date invoice/cash bridge. Original financial records stay immutable.
create index if not exists payment_reconciliation_dates on public.payments(organization_id,received_at,id);
create index if not exists invoice_reconciliation_dates on public.invoices(organization_id,issued_at,id);
create index if not exists expense_reversal_dates on public.business_expense_reversals(organization_id,reversed_at,expense_id);
create function private.financial_reconciliation(p_org uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text;start_at timestamptz;end_at timestamptz;opening bigint;closing bigint;events jsonb;n integer;
begin
 if not private.staff(p_org,array['owner','admin','bookkeeper']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 or p_from<date '0001-01-01' or p_to>=date '9999-12-31' then raise exception 'VALIDATION';end if;
 select timezone into tz from public.organizations where id=p_org;
 start_at:=p_from::timestamp at time zone tz;end_at:=(p_to+1)::timestamp at time zone tz;
 select coalesce((select sum(i.total_cents::bigint) from public.invoices i where i.organization_id=p_org and i.issued_at<start_at),0)-coalesce((select sum(p.cents::bigint) from public.payments p where p.organization_id=p_org and p.received_at<start_at),0) into opening;
 select coalesce((select sum(i.total_cents::bigint) from public.invoices i where i.organization_id=p_org and i.issued_at<end_at),0)-coalesce((select sum(p.cents::bigint) from public.payments p where p.organization_id=p_org and p.received_at<end_at),0) into closing;
 with activity as (
  select 'invoice'::text kind,i.id::text id,i.id related_id,i.number::text reference,(i.issued_at at time zone tz)::date business_date,i.total_cents::bigint invoice_cents,0::bigint receipt_cents,0::bigint expense_cents,0::bigint fee_cents
  from public.invoices i where i.organization_id=p_org and i.issued_at>=start_at and i.issued_at<end_at
  union all
  select case when p.cents<0 then 'receipt_correction' else 'receipt' end,p.id::text,p.invoice_id,i.number::text,(p.received_at at time zone tz)::date,0,p.cents::bigint,0,0
  from public.payments p join public.invoices i on i.organization_id=p.organization_id and i.id=p.invoice_id where p.organization_id=p_org and p.received_at>=start_at and p.received_at<end_at
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
create function public.financial_reconciliation(p_org uuid,p_from date,p_to date) returns jsonb language sql stable security invoker set search_path='' as $$select private.financial_reconciliation(p_org,p_from,p_to)$$;
revoke all on function public.financial_reconciliation(uuid,date,date),private.financial_reconciliation(uuid,date,date) from public,anon,service_role;
grant execute on function public.financial_reconciliation(uuid,date,date),private.financial_reconciliation(uuid,date,date) to authenticated;
-- Align the existing money summary with dated correction events. A later
-- correction must not erase an earlier period's original expense.
do $$declare d text;needle text;replacement text;begin
 d:=pg_get_functiondef('private.finance_activity(uuid,date,date)'::regprocedure);
 needle:='select coalesce(sum(e.amount_cents::bigint),0),count(*) into spent,expense_count from public.business_expenses e where e.organization_id=p_org and e.expense_date between p_from and p_to and not exists(select 1 from public.business_expense_reversals r where r.organization_id=e.organization_id and r.expense_id=e.id);';
 replacement:='select coalesce((select sum(e.amount_cents::bigint) from public.business_expenses e where e.organization_id=p_org and e.expense_date between p_from and p_to),0)-coalesce((select sum(e.amount_cents::bigint) from public.business_expense_reversals r join public.business_expenses e on e.organization_id=r.organization_id and e.id=r.expense_id where r.organization_id=p_org and r.reversed_at>=(p_from::timestamp at time zone tz) and r.reversed_at<((p_to+1)::timestamp at time zone tz)),0) into spent;
 select count(*) into expense_count from public.business_expenses e where e.organization_id=p_org and e.expense_date between p_from and p_to and not exists(select 1 from public.business_expense_reversals r where r.organization_id=e.organization_id and r.expense_id=e.id and r.reversed_at<((p_to+1)::timestamp at time zone tz));';
 if position(needle in d)=0 then raise exception 'FINANCE_SUMMARY_BASELINE_CHANGED';end if;
 execute replace(d,needle,replacement);
end$$;
