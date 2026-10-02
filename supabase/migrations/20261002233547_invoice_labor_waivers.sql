create table private.invoice_labor_drafts(organization_id uuid not null,job_id uuid not null,lines jsonb not null,job_revision integer not null,created_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),primary key(organization_id,job_id),foreign key(organization_id,job_id) references public.jobs(organization_id,id));
create index invoice_labor_drafts_creator on private.invoice_labor_drafts(created_by);
alter table private.invoice_labor_drafts enable row level security;
revoke all on private.invoice_labor_drafts from public,anon,authenticated,service_role;
create policy invoice_draft_deny on private.invoice_labor_drafts to anon,authenticated using(false) with check(false);
create function private.save_invoice_labor(p_org uuid,p_job uuid,p_revision integer,p_lines jsonb,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.jobs; q public.quote_versions;line jsonb;total bigint:=0;prior private.command_receipts;fingerprint text;result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_key is null or length(p_key) not between 16 and 128 or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 50 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_job,p_revision,p_lines)::text,'UTF8')),'hex');
 select * into j from public.jobs where organization_id=p_org and id=p_job for update;if not found then raise exception 'NOT_FOUND';end if;
 select * into prior from private.command_receipts where organization_id=p_org and command='InvoiceLaborDraft' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if j.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 if j.status not in ('working','paused') or exists(select 1 from public.invoices where organization_id=p_org and job_id=p_job) then raise exception 'TRANSITION';end if;
 select * into q from public.quote_versions where organization_id=p_org and quote_id=j.quote_id and version=j.approved_version;
 for line in select value from jsonb_array_elements(p_lines) loop
  if jsonb_typeof(line) is distinct from 'object' or exists(select 1 from jsonb_object_keys(line) k where k not in ('description','recordedMinutes','chargedCents','waiverReason'))
   or jsonb_typeof(line->'description') is distinct from 'string' or length(trim(line->>'description')) not between 2 and 1000
   or coalesce(line->>'recordedMinutes','')!~'^[0-9]+$' or (line->>'recordedMinutes')::bigint>1440
   or coalesce(line->>'chargedCents','')!~'^[0-9]+$' or (line->>'chargedCents')::bigint>999999999
   or jsonb_typeof(line->'waiverReason') is distinct from 'string' or length(line->>'waiverReason')>1000
   or ((line->>'chargedCents')::bigint=0 and length(trim(line->>'waiverReason'))<2) then raise exception 'VALIDATION';end if;
  total:=total+(line->>'chargedCents')::bigint;
 end loop;
 if total>q.labor_cents then raise exception 'CHANGE_ORDER_REQUIRED';end if;
 update public.jobs set revision=revision+1 where organization_id=p_org and id=p_job returning * into j;
 insert into private.invoice_labor_drafts(organization_id,job_id,lines,job_revision,created_by) values(p_org,p_job,p_lines,j.revision,auth.uid()) on conflict(organization_id,job_id) do update set lines=excluded.lines,job_revision=excluded.job_revision,created_by=excluded.created_by,updated_at=now();
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'invoice.labor_draft_saved',p_job,j.revision,gen_random_uuid());
 result:=jsonb_build_object('revision',j.revision,'totalCents',total);insert into private.command_receipts values(p_org,'InvoiceLaborDraft',p_key,fingerprint,result,now());return result;
end$$;
create function public.save_invoice_labor(p_org uuid,p_job uuid,p_revision integer,p_lines jsonb,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.save_invoice_labor(p_org,p_job,p_revision,p_lines,p_key)$$;
create function private.invoice_labor_draft(p_org uuid,p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;return (select jsonb_build_object('lines',lines,'jobRevision',job_revision) from private.invoice_labor_drafts where organization_id=p_org and job_id=p_job);end$$;
create function public.invoice_labor_draft(p_org uuid,p_job uuid) returns jsonb language sql security invoker set search_path='' as $$select private.invoice_labor_draft(p_org,p_job)$$;
revoke all on function private.save_invoice_labor(uuid,uuid,integer,jsonb,text),public.save_invoice_labor(uuid,uuid,integer,jsonb,text),private.invoice_labor_draft(uuid,uuid),public.invoice_labor_draft(uuid,uuid) from public,anon,service_role;
grant execute on function private.save_invoice_labor(uuid,uuid,integer,jsonb,text),public.save_invoice_labor(uuid,uuid,integer,jsonb,text),private.invoice_labor_draft(uuid,uuid),public.invoice_labor_draft(uuid,uuid) to authenticated;

create or replace function private.complete_and_invoice(p_org uuid,p_job uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.jobs; q public.quote_versions; cfg jsonb; inv public.invoices; entry uuid; n bigint; charged integer; work_lines jsonb;
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
 select lines into work_lines from private.invoice_labor_drafts where organization_id=p_org and job_id=p_job;
 charged:=case when work_lines is null then q.labor_cents else (select sum((value->>'chargedCents')::bigint)::integer from jsonb_array_elements(work_lines)) end;
 if charged>q.labor_cents or charged<0 then raise exception 'CHANGE_ORDER_REQUIRED';end if;
 cfg:=q.snapshot->'configuration';
 -- This slice handles explicitly reviewed non-taxable labor only; taxable/mixed lines remain gated.
 if cfg->>'sellerVerified' is distinct from 'true' or cfg->>'taxTreatmentVerified' is distinct from 'true'
 or cfg->>'laborTaxTreatment' is distinct from 'reviewed_non_taxable' or length(coalesce(cfg->>'sellerLegalName',''))<2
 or length(coalesce(cfg->>'invoiceTerms',''))<2 then raise exception 'SETUP_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':invoice-number',0));
 select coalesce(max(number),0)+1 into n from public.invoices where organization_id=p_org;
 insert into public.invoices(organization_id,job_id,customer_id,number,total_cents,snapshot)
 values(p_org,p_job,j.customer_id,n,charged,q.snapshot||jsonb_build_object('scope',q.scope,'laborCents',charged,'totalCents',charged,'approvedLaborCents',q.labor_cents,'recordedWork',work_lines,'taxCents',0,'quoteId',q.quote_id,'quoteVersion',q.version)) returning * into inv;
 if charged>0 then
 insert into public.journal_entries(organization_id,source_kind,source_id) values(p_org,'invoice',inv.id) returning id into entry;
 insert into public.journal_lines(organization_id,entry_id,account,debit_cents,credit_cents) values(p_org,entry,'receivable',inv.total_cents,0),(p_org,entry,'labor_revenue',0,inv.total_cents);
 end if;
 update public.jobs set status='completed',revision=revision+1 where organization_id=p_org and id=p_job;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'invoice.issued',inv.id,1,gen_random_uuid());
 insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,'invoice:'||inv.id||':issued','invoice.issued',inv.id,jsonb_build_object('schemaVersion',1));
 return jsonb_build_object('id',inv.id,'number',inv.number,'totalCents',inv.total_cents);
end$$;
