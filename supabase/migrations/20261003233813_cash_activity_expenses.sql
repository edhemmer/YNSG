-- Confirmed external business expenses, immutable correction, and exact date-bounded totals.
create table public.business_expenses (
 organization_id uuid not null references public.organizations(id),
 id uuid not null default gen_random_uuid(),
 expense_date date not null,
 vendor text not null check(length(trim(vendor)) between 2 and 160),
 category text not null check(category in ('tools','fuel','supplies','vehicle','insurance','marketing','software','other')),
 description text not null check(length(trim(description)) between 3 and 500),
 amount_cents integer not null check(amount_cents between 1 and 999999999),
 payment_method text not null check(payment_method in ('cash','zelle','external_card','external_transfer','other')),
 reference text not null check(length(trim(reference)) between 1 and 160),
 recorded_by uuid not null references auth.users(id), recorded_at timestamptz not null default now(),
 primary key(organization_id,id)
);
create index business_expense_dates on public.business_expenses(organization_id,expense_date desc,id);
create table public.business_expense_reversals (
 organization_id uuid not null, expense_id uuid not null, reason text not null check(length(trim(reason)) between 5 and 500),
 reversed_by uuid not null references auth.users(id), reversed_at timestamptz not null default now(),
 primary key(organization_id,expense_id),
 foreign key(organization_id,expense_id) references public.business_expenses(organization_id,id)
);
create trigger immutable_record before update or delete on public.business_expenses for each row execute function private.immutable_record();
create trigger immutable_record before update or delete on public.business_expense_reversals for each row execute function private.immutable_record();
alter table public.business_expenses enable row level security;
alter table public.business_expense_reversals enable row level security;
revoke all on public.business_expenses,public.business_expense_reversals from anon,authenticated;
grant select on public.business_expenses,public.business_expense_reversals to authenticated;
create policy finance_expenses_read on public.business_expenses for select to authenticated using(private.staff(organization_id,array['owner','admin','bookkeeper']));
create policy finance_reversals_read on public.business_expense_reversals for select to authenticated using(private.staff(organization_id,array['owner','admin','bookkeeper']));

create function private.record_business_expense(p_org uuid,p_date date,p_vendor text,p_category text,p_description text,p_cents integer,p_method text,p_reference text,p_confirmed boolean,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare eid uuid; jid uuid; previous private.command_receipts; fingerprint text; result jsonb; tz text;
begin
 if not private.staff(p_org,array['owner','admin','bookkeeper']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 select timezone into tz from public.organizations where id=p_org;
 if p_confirmed is distinct from true or p_date is null or p_date>timezone(tz,now())::date or p_date<'2000-01-01'::date or p_vendor is null or length(trim(p_vendor)) not between 2 and 160 or p_category is null or p_category not in ('tools','fuel','supplies','vehicle','insurance','marketing','software','other') or p_description is null or length(trim(p_description)) not between 3 and 500 or p_cents is null or p_cents not between 1 and 999999999 or p_method is null or p_method not in ('cash','zelle','external_card','external_transfer','other') or p_reference is null or length(trim(p_reference)) not between 1 and 160 or p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_date,trim(p_vendor),p_category,trim(p_description),p_cents,p_method,trim(p_reference),auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':expense:'||p_key,0));
 select * into previous from private.command_receipts where organization_id=p_org and command='RecordBusinessExpense' and key=p_key;
 if found then if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return previous.result;end if;
 insert into public.business_expenses(organization_id,expense_date,vendor,category,description,amount_cents,payment_method,reference,recorded_by)
 values(p_org,p_date,trim(p_vendor),p_category,trim(p_description),p_cents,p_method,trim(p_reference),auth.uid()) returning id into eid;
 insert into public.journal_entries(organization_id,source_kind,source_id) values(p_org,'expense',eid) returning id into jid;
 insert into public.journal_lines(organization_id,entry_id,account,debit_cents,credit_cents) values
 (p_org,jid,'expenses',p_cents,0),(p_org,jid,'cash',0,p_cents);
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'expense.recorded',eid,1,gen_random_uuid());
 result:=jsonb_build_object('id',eid);
 insert into private.command_receipts values(p_org,'RecordBusinessExpense',p_key,fingerprint,result,now());return result;
end$$;
create function public.record_business_expense(p_org uuid,p_date date,p_vendor text,p_category text,p_description text,p_cents integer,p_method text,p_reference text,p_confirmed boolean,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.record_business_expense(p_org,p_date,p_vendor,p_category,p_description,p_cents,p_method,p_reference,p_confirmed,p_key)$$;

create function private.reverse_business_expense(p_org uuid,p_expense uuid,p_reason text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.business_expenses; jid uuid; previous private.command_receipts; fingerprint text; result jsonb;
begin
 if not private.staff(p_org,array['owner','admin','bookkeeper']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_reason is null or length(trim(p_reason)) not between 5 and 500 or p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_expense,trim(p_reason),auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':expense-reversal:'||p_expense::text,0));
 select * into previous from private.command_receipts where organization_id=p_org and command='ReverseBusinessExpense' and key=p_key;
 if found then if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return previous.result;end if;
 select * into e from public.business_expenses where organization_id=p_org and id=p_expense;
 if not found then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from public.business_expense_reversals where organization_id=p_org and expense_id=p_expense) then raise exception 'ALREADY_REVERSED';end if;
 insert into public.business_expense_reversals(organization_id,expense_id,reason,reversed_by) values(p_org,p_expense,trim(p_reason),auth.uid());
 insert into public.journal_entries(organization_id,source_kind,source_id) values(p_org,'reversal',e.id) returning id into jid;
 insert into public.journal_lines(organization_id,entry_id,account,debit_cents,credit_cents) values
 (p_org,jid,'cash',e.amount_cents,0),(p_org,jid,'expenses',0,e.amount_cents);
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'expense.reversed',e.id,2,gen_random_uuid());
 result:=jsonb_build_object('id',e.id,'reversed',true);
 insert into private.command_receipts values(p_org,'ReverseBusinessExpense',p_key,fingerprint,result,now());return result;
end$$;
create function public.reverse_business_expense(p_org uuid,p_expense uuid,p_reason text,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.reverse_business_expense(p_org,p_expense,p_reason,p_key)$$;

create function private.finance_activity(p_org uuid,p_from date,p_to date) returns jsonb
language plpgsql security definer stable set search_path='' as $$
declare tz text; receipts bigint; spent bigint; issued bigint; outstanding bigint; expense_count bigint; payment_count bigint;
begin
 if not private.staff(p_org,array['owner','admin','bookkeeper']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>3660 then raise exception 'VALIDATION';end if;
 select timezone into tz from public.organizations where id=p_org;
 select coalesce(sum(p.cents::bigint),0),count(*) into receipts,payment_count from public.payments p where p.organization_id=p_org and timezone(tz,p.received_at)::date between p_from and p_to;
 select coalesce(sum(e.amount_cents::bigint),0),count(*) into spent,expense_count from public.business_expenses e where e.organization_id=p_org and e.expense_date between p_from and p_to and not exists(select 1 from public.business_expense_reversals r where r.organization_id=e.organization_id and r.expense_id=e.id);
 select coalesce(sum(i.total_cents::bigint),0) into issued from public.invoices i where i.organization_id=p_org and timezone(tz,i.issued_at)::date between p_from and p_to;
 select coalesce(sum(i.total_cents::bigint-coalesce((select sum(p.cents::bigint) from public.payments p where p.organization_id=i.organization_id and p.invoice_id=i.id and timezone(tz,p.received_at)::date<=p_to),0)),0) into outstanding from public.invoices i where i.organization_id=p_org and timezone(tz,i.issued_at)::date<=p_to;
 return jsonb_build_object('from',p_from,'to',p_to,'timezone',tz,'cashReceivedCents',receipts,'expenseCents',spent,'cashAfterExpensesCents',receipts-spent,'issuedInvoicesCents',issued,'outstandingAsOfEndCents',outstanding,'expenseCount',expense_count,'paymentCount',payment_count);
end$$;
create function public.finance_activity(p_org uuid,p_from date,p_to date) returns jsonb language sql security invoker set search_path='' as $$select private.finance_activity(p_org,p_from,p_to)$$;
revoke all on function private.record_business_expense(uuid,date,text,text,text,integer,text,text,boolean,text),public.record_business_expense(uuid,date,text,text,text,integer,text,text,boolean,text),private.reverse_business_expense(uuid,uuid,text,text),public.reverse_business_expense(uuid,uuid,text,text),private.finance_activity(uuid,date,date),public.finance_activity(uuid,date,date) from public,anon;
grant execute on function private.record_business_expense(uuid,date,text,text,text,integer,text,text,boolean,text),public.record_business_expense(uuid,date,text,text,text,integer,text,text,boolean,text),private.reverse_business_expense(uuid,uuid,text,text),public.reverse_business_expense(uuid,uuid,text,text),private.finance_activity(uuid,date,date),public.finance_activity(uuid,date,date) to authenticated;
