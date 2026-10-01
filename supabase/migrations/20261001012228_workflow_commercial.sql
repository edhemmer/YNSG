-- Private command implementation, exposed security-invoker API wrapper.
alter function public.review_service_request(uuid,uuid,integer,text,text) set schema private;
create function public.review_service_request(p_org uuid,p_id uuid,p_revision integer,p_status text,p_key text) returns jsonb
language sql security invoker set search_path='' as $$select private.review_service_request(p_org,p_id,p_revision,p_status,p_key)$$;
revoke all on function public.review_service_request(uuid,uuid,integer,text,text) from public,anon;
grant execute on function public.review_service_request(uuid,uuid,integer,text,text) to authenticated;

create table public.contacts (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), customer_id uuid not null,
 name text not null, email text, phone text, relationship text not null,
 primary key(organization_id,id), foreign key(organization_id,customer_id) references public.customers(organization_id,id)
);
create index contacts_customer on public.contacts(organization_id,customer_id);
create table public.quotes (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), request_id uuid not null,
 customer_id uuid not null, current_version integer not null default 1 check(current_version>0),
 revision integer not null default 1 check(revision>0), status text not null default 'sent' check(status in ('sent','accepted','declined','expired')),
 created_at timestamptz not null default now(), primary key(organization_id,id),
 foreign key(organization_id,request_id) references public.service_requests(organization_id,id),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id)
);
create index quotes_request on public.quotes(organization_id,request_id);
create index quotes_customer on public.quotes(organization_id,customer_id);
create table public.quote_versions (
 organization_id uuid not null, quote_id uuid not null, version integer not null check(version>0),
 scope text not null check(length(scope) between 10 and 5000), labor_cents integer not null check(labor_cents between 0 and 999999999),
 duration_minutes integer not null check(duration_minutes>=120 and duration_minutes%30=0),
 snapshot jsonb not null, created_at timestamptz not null default now(),
 primary key(organization_id,quote_id,version), foreign key(organization_id,quote_id) references public.quotes(organization_id,id)
);
create table public.approvals (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), quote_id uuid not null, version integer not null,
 actor_id uuid not null references auth.users(id), evidence text not null, method text not null check(method in ('portal','recorded_by_staff')),
 created_at timestamptz not null default now(), primary key(organization_id,id), unique(organization_id,quote_id,version),
 foreign key(organization_id,quote_id,version) references public.quote_versions(organization_id,quote_id,version)
);
create table public.jobs (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), quote_id uuid not null,
 approved_version integer not null, customer_id uuid not null, revision integer not null default 1 check(revision>0),
 status text not null default 'approved' check(status in ('approved','scheduled','en_route','arrived','working','paused','completed','canceled')),
 created_at timestamptz not null default now(), primary key(organization_id,id), unique(organization_id,quote_id),
 foreign key(organization_id,quote_id,approved_version) references public.quote_versions(organization_id,quote_id,version),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id)
);
create index jobs_customer on public.jobs(organization_id,customer_id);
create table public.invoices (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), job_id uuid not null,
 customer_id uuid not null, number bigint not null, total_cents integer not null check(total_cents between 0 and 999999999),
 snapshot jsonb not null, issued_at timestamptz not null default now(),
 primary key(organization_id,id), unique(organization_id,job_id), unique(organization_id,number),
 foreign key(organization_id,job_id) references public.jobs(organization_id,id),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id)
);
create index invoices_customer on public.invoices(organization_id,customer_id);
create table public.payments (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), invoice_id uuid not null,
 cents integer not null check(cents>0), method text not null check(method in ('cash','zelle')),
 collector uuid not null references auth.users(id), reference text not null check(length(reference) between 1 and 300),
 received_at timestamptz not null, recorded_at timestamptz not null default now(),
 primary key(organization_id,id), foreign key(organization_id,invoice_id) references public.invoices(organization_id,id)
);
create index payments_invoice on public.payments(organization_id,invoice_id);
-- Current payment command allocates to exactly one invoice; multi-invoice allocations/reversals are later commands.
create table public.journal_entries (
 organization_id uuid not null references public.organizations(id), id uuid not null default gen_random_uuid(),
 source_kind text not null check(source_kind in ('invoice','payment','reversal','expense')),
 source_id uuid not null, posted_at timestamptz not null default now(),
 primary key(organization_id,id), unique(organization_id,source_kind,source_id)
);
create table public.journal_lines (
 organization_id uuid not null, id uuid not null default gen_random_uuid(), entry_id uuid not null,
 account text not null check(account in ('receivable','labor_revenue','cash','reimbursements','expenses','tax_payable')),
 debit_cents integer not null default 0 check(debit_cents>=0),credit_cents integer not null default 0 check(credit_cents>=0),
 primary key(organization_id,id), foreign key(organization_id,entry_id) references public.journal_entries(organization_id,id),
 check((debit_cents>0 and credit_cents=0) or (credit_cents>0 and debit_cents=0))
);
create index journal_entry_lines on public.journal_lines(organization_id,entry_id);
create function private.immutable_record() returns trigger language plpgsql set search_path='' as $$begin raise exception 'IMMUTABLE_RECORD';end$$;
create function private.assert_balanced() returns trigger language plpgsql set search_path='' as $$
begin
 if (select count(*)<2 or coalesce(sum(debit_cents::bigint-credit_cents),0)<>0 from public.journal_lines where organization_id=new.organization_id and entry_id=new.id) then raise exception 'UNBALANCED_JOURNAL';end if;
 return null;
end$$;
create constraint trigger journal_balanced after insert on public.journal_entries deferrable initially deferred for each row execute function private.assert_balanced();
do $$declare t text;begin
 foreach t in array array['quote_versions','approvals','invoices','payments','journal_entries','journal_lines','configuration_versions','audit_events'] loop
 execute format('create trigger immutable_record before update or delete on public.%I for each row execute function private.immutable_record()',t);
 end loop;
 foreach t in array array['contacts','quotes','quote_versions','approvals','jobs','invoices','payments','journal_entries','journal_lines'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end$$;
revoke all on function private.immutable_record(),private.assert_balanced() from public;
create policy contact_read on public.contacts for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher']) or private.customer_allowed(organization_id,customer_id));
create policy quote_read on public.quotes for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher']) or private.customer_allowed(organization_id,customer_id));
create policy quote_version_read on public.quote_versions for select to authenticated using(exists(select 1 from public.quotes q where q.organization_id=quote_versions.organization_id and q.id=quote_id));
create policy approval_read on public.approvals for select to authenticated using(exists(select 1 from public.quotes q where q.organization_id=approvals.organization_id and q.id=quote_id));
create policy job_read on public.jobs for select to authenticated using(private.staff(organization_id,array['owner','admin','dispatcher']) or private.customer_allowed(organization_id,customer_id));
create policy invoice_read on public.invoices for select to authenticated using(private.staff(organization_id,array['owner','admin','bookkeeper']) or private.customer_allowed(organization_id,customer_id,true));
create policy payment_read on public.payments for select to authenticated using(exists(select 1 from public.invoices i where i.organization_id=payments.organization_id and i.id=invoice_id));
create policy journal_read on public.journal_entries for select to authenticated using(private.staff(organization_id,array['owner','admin','bookkeeper']));
create policy lines_read on public.journal_lines for select to authenticated using(private.staff(organization_id,array['owner','admin','bookkeeper']));

create function private.publish_hourly_quote(p_org uuid,p_request uuid,p_revision integer,p_scope text,p_minutes integer,p_community boolean,p_eligibility_reviewed boolean,p_customer uuid,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.service_requests; cfg public.configuration_versions; q public.quotes; c uuid; prop uuid; cents integer; fingerprint text; previous private.command_receipts; result jsonb;
begin
 if not private.staff(p_org,array['owner','admin','dispatcher']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_scope is null or length(p_scope) not between 10 and 5000 or p_minutes is null or p_minutes<120 or p_minutes>1440 or p_minutes%30<>0 or p_key is null or length(p_key) not between 16 and 128 or p_community is null then raise exception 'VALIDATION';end if;
 if p_community and p_eligibility_reviewed is distinct from true then raise exception 'ELIGIBILITY_REVIEW_REQUIRED';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_request,p_revision,p_scope,p_minutes,p_community,p_eligibility_reviewed,p_customer,auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':quote:'||p_key,0));
 select * into previous from private.command_receipts where organization_id=p_org and command='PublishQuote' and key=p_key;
 if found then if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return previous.result;end if;
 select * into r from public.service_requests where organization_id=p_org and id=p_request for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if r.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 if r.status not in ('reviewing','quoted') then raise exception 'TRANSITION';end if;
 if not exists(select 1 from public.catalog_services where organization_id=p_org and id=r.service_id and compliance='approved' and pricing_mode='hourly') then raise exception 'SERVICE_REVIEW_REQUIRED';end if;
 select * into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 if cfg.settings->'hourly' is null or cfg.settings->>'policyVersion' is null then raise exception 'SETUP_REQUIRED';end if;
 cents:=case when p_community then (cfg.settings->'hourly'->>'communityCents')::integer else (cfg.settings->'hourly'->>'standardCents')::integer end;
 if cents is null or cents<=0 or cents%2<>0 then raise exception 'SETUP_REQUIRED';end if;
 cents:=cents*(p_minutes/30)/2;
 c:=coalesce(r.customer_id,p_customer);
 if r.customer_id is not null and p_customer is not null and r.customer_id<>p_customer then raise exception 'CUSTOMER_CONFLICT';end if;
 if c is null then
  insert into public.customers(organization_id,display_name) values(p_org,r.original_submission->>'name') returning id into c;
  insert into public.contacts(organization_id,customer_id,name,email,phone,relationship) values(p_org,c,r.original_submission->>'name',r.original_submission->>'email',r.original_submission->>'phone','requester');
 elsif not exists(select 1 from public.customers where organization_id=p_org and id=c) then raise exception 'NOT_FOUND';end if;
 prop:=r.property_id;
 if cfg.settings->>'region' is null then raise exception 'SETUP_REQUIRED';end if;
 if prop is null then insert into public.properties(organization_id,customer_id,street,city,region) values(p_org,c,r.original_submission->>'street',r.original_submission->>'city',cfg.settings->>'region') returning id into prop;end if;
 select * into q from public.quotes where organization_id=p_org and request_id=p_request for update;
 if found then
  if q.status='accepted' then raise exception 'CHANGE_ORDER_REQUIRED';end if;
  update public.quotes set current_version=current_version+1,revision=revision+1,status='sent' where organization_id=p_org and id=q.id returning * into q;
 else insert into public.quotes(organization_id,request_id,customer_id) values(p_org,p_request,c) returning * into q;end if;
 insert into public.quote_versions(organization_id,quote_id,version,scope,labor_cents,duration_minutes,snapshot)
 values(p_org,q.id,q.current_version,p_scope,cents,p_minutes,jsonb_build_object('schemaVersion',1,'configurationVersion',cfg.version,'policyVersion',cfg.settings->>'policyVersion','program',case when p_community then 'community' else 'standard' end,'eligibilityReviewed',p_eligibility_reviewed,'configuration',cfg.settings,'propertyId',prop,'customerId',c,'materials','Not included; separate approval required'));
 update public.service_requests set customer_id=c,property_id=prop,status='quoted',revision=revision+1 where organization_id=p_org and id=p_request;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'quote.published',q.id,q.current_version,gen_random_uuid());
 result:=jsonb_build_object('id',q.id,'version',q.current_version,'laborCents',cents,'requestRevision',r.revision+1);
 insert into private.command_receipts values(p_org,'PublishQuote',p_key,fingerprint,result,now());return result;
end$$;
create function public.publish_hourly_quote(p_org uuid,p_request uuid,p_revision integer,p_scope text,p_minutes integer,p_community boolean,p_eligibility_reviewed boolean,p_customer uuid,p_key text) returns jsonb
language sql security invoker set search_path='' as $$select private.publish_hourly_quote(p_org,p_request,p_revision,p_scope,p_minutes,p_community,p_eligibility_reviewed,p_customer,p_key)$$;

create function private.approve_quote(p_org uuid,p_quote uuid,p_version integer,p_evidence text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.quotes; j uuid; staff boolean;
begin
 select * into q from public.quotes where organization_id=p_org and id=p_quote for update;
 if not found then raise exception 'NOT_FOUND';end if;
 staff:=private.staff(p_org,array['owner','admin']);
 if not staff and not private.customer_allowed(p_org,q.customer_id,false,true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if q.current_version is distinct from p_version then raise exception 'STALE_REVISION';end if;
 if q.status='accepted' then select id into j from public.jobs where organization_id=p_org and quote_id=p_quote;return jsonb_build_object('id',j,'status','approved');end if;
 if q.status<>'sent' then raise exception 'TRANSITION';end if;
 if p_evidence is null or length(p_evidence) not between 10 and 2000 then raise exception 'APPROVAL_EVIDENCE_REQUIRED';end if;
 insert into public.approvals(organization_id,quote_id,version,actor_id,evidence,method) values(p_org,p_quote,p_version,auth.uid(),p_evidence,case when staff then 'recorded_by_staff' else 'portal' end);
 update public.quotes set status='accepted',revision=revision+1 where organization_id=p_org and id=p_quote;
 insert into public.jobs(organization_id,quote_id,approved_version,customer_id) values(p_org,p_quote,p_version,q.customer_id) returning id into j;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'quote.accepted',p_quote,p_version,gen_random_uuid());
 return jsonb_build_object('id',j,'status','approved');
end$$;
create function public.approve_quote(p_org uuid,p_quote uuid,p_version integer,p_evidence text) returns jsonb language sql security invoker set search_path='' as $$select private.approve_quote(p_org,p_quote,p_version,p_evidence)$$;

create function private.complete_and_invoice(p_org uuid,p_job uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.jobs; q public.quote_versions; cfg jsonb; inv public.invoices; entry uuid; n bigint;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 select * into j from public.jobs where organization_id=p_org and id=p_job for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into inv from public.invoices where organization_id=p_org and job_id=p_job;
 if found then return jsonb_build_object('id',inv.id,'number',inv.number,'totalCents',inv.total_cents);end if;
 if j.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 if j.status not in ('working','paused') then raise exception 'TRANSITION';end if;
 select * into q from public.quote_versions where organization_id=p_org and quote_id=j.quote_id and version=j.approved_version;
 if not exists(select 1 from public.approvals where organization_id=p_org and quote_id=j.quote_id and version=j.approved_version) then raise exception 'APPROVAL_REQUIRED';end if;
 cfg:=q.snapshot->'configuration';
 -- This slice handles explicitly reviewed non-taxable labor only; taxable/mixed lines remain gated.
 if cfg->>'sellerVerified' is distinct from 'true' or cfg->>'taxTreatmentVerified' is distinct from 'true'
 or cfg->>'laborTaxTreatment' is distinct from 'reviewed_non_taxable' or length(coalesce(cfg->>'sellerLegalName',''))<2
 or length(coalesce(cfg->>'invoiceTerms',''))<2 then raise exception 'SETUP_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':invoice-number',0));
 select coalesce(max(number),0)+1 into n from public.invoices where organization_id=p_org;
 insert into public.invoices(organization_id,job_id,customer_id,number,total_cents,snapshot)
 values(p_org,p_job,j.customer_id,n,q.labor_cents,q.snapshot||jsonb_build_object('scope',q.scope,'laborCents',q.labor_cents,'totalCents',q.labor_cents,'taxCents',0,'quoteId',q.quote_id,'quoteVersion',q.version)) returning * into inv;
 insert into public.journal_entries(organization_id,source_kind,source_id) values(p_org,'invoice',inv.id) returning id into entry;
 insert into public.journal_lines(organization_id,entry_id,account,debit_cents,credit_cents) values(p_org,entry,'receivable',inv.total_cents,0),(p_org,entry,'labor_revenue',0,inv.total_cents);
 update public.jobs set status='completed',revision=revision+1 where organization_id=p_org and id=p_job;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'invoice.issued',inv.id,1,gen_random_uuid());
 insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,'invoice:'||inv.id||':issued','invoice.issued',inv.id,jsonb_build_object('schemaVersion',1));
 return jsonb_build_object('id',inv.id,'number',inv.number,'totalCents',inv.total_cents);
end$$;
create function public.complete_and_invoice(p_org uuid,p_job uuid,p_revision integer) returns jsonb language sql security invoker set search_path='' as $$select private.complete_and_invoice(p_org,p_job,p_revision)$$;

create function private.record_payment(p_org uuid,p_invoice uuid,p_cents integer,p_method text,p_reference text,p_received_at timestamptz,p_confirmed boolean,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.invoices; paid bigint; pid uuid; entry uuid; previous private.command_receipts; fingerprint text; result jsonb;
begin
 if not private.staff(p_org,array['owner','admin','bookkeeper']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_confirmed is distinct from true then raise exception 'PAYMENT_CONFIRMATION_REQUIRED';end if;
 if p_cents is null or p_cents<=0 or p_method is null or p_method not in ('cash','zelle') or p_reference is null or length(p_reference) not between 1 and 300 or p_received_at is null or p_received_at>now() or p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_invoice,p_cents,p_method,p_reference,p_received_at,auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':payment:'||p_key,0));
 select * into previous from private.command_receipts where organization_id=p_org and command='RecordPayment' and key=p_key;
 if found then if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return previous.result;end if;
 select * into i from public.invoices where organization_id=p_org and id=p_invoice for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select coalesce(sum(cents),0) into paid from public.payments where organization_id=p_org and invoice_id=p_invoice;
 if paid+p_cents>i.total_cents then raise exception 'OVERPAYMENT_REQUIRES_REVIEW';end if;
 insert into public.payments(organization_id,invoice_id,cents,method,collector,reference,received_at) values(p_org,p_invoice,p_cents,p_method,auth.uid(),p_reference,p_received_at) returning id into pid;
 insert into public.journal_entries(organization_id,source_kind,source_id) values(p_org,'payment',pid) returning id into entry;
 insert into public.journal_lines(organization_id,entry_id,account,debit_cents,credit_cents) values(p_org,entry,'cash',p_cents,0),(p_org,entry,'receivable',0,p_cents);
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'payment.recorded',pid,1,gen_random_uuid());
 if paid+p_cents=i.total_cents then
 insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,'invoice:'||p_invoice||':paid','invoice.paid',p_invoice,jsonb_build_object('schemaVersion',1,'paymentId',pid));
 end if;
 result:=jsonb_build_object('id',pid,'balanceCents',i.total_cents-paid-p_cents);
 insert into private.command_receipts values(p_org,'RecordPayment',p_key,fingerprint,result,now());return result;
end$$;
create function public.record_payment(p_org uuid,p_invoice uuid,p_cents integer,p_method text,p_reference text,p_received_at timestamptz,p_confirmed boolean,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.record_payment(p_org,p_invoice,p_cents,p_method,p_reference,p_received_at,p_confirmed,p_key)$$;

do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname in ('publish_hourly_quote','approve_quote','complete_and_invoice','record_payment') loop
 execute format('revoke all on function %s from public,anon',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end$$;
