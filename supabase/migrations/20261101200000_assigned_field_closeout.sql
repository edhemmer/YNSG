-- Deferred ledger validation must inspect canonical lines even when a scoped
-- technician issues an invoice. This trigger returns no data and has no client
-- EXECUTE grant; ledger reads remain restricted by their existing RLS policies.
alter function private.assert_balanced() security definer;
revoke all on function private.assert_balanced() from public,anon,authenticated,service_role;

-- Office owns commercial agreements, scheduling and tax setup. A primary assigned
-- technician may execute the approved visit, issue its reviewed invoice and record
-- actual cash/Zelle receipts. Additional labor-review delegation is not this authority.
create function private.field_job_access(p_org uuid,p_job uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.staff(p_org,array['owner','admin']) or (private.staff(p_org,array['technician']) and exists(
 select 1 from public.jobs j join public.quotes q on q.organization_id=j.organization_id and q.id=j.quote_id
 join private.lead_assignments a on a.organization_id=q.organization_id and a.request_id=q.request_id
 join private.team_technicians t on t.organization_id=a.organization_id and t.id=a.technician_id
 where j.organization_id=p_org and j.id=p_job and t.user_id=auth.uid() and not t.archived))
$$;
revoke all on function private.field_job_access(uuid,uuid) from public,anon,authenticated,service_role;
create function private.field_invoice_access(p_org uuid,p_invoice uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.invoices where organization_id=p_org and id=p_invoice and private.field_job_access(p_org,job_id))
$$;
revoke all on function private.field_invoice_access(uuid,uuid) from public,anon,authenticated,service_role;
do $migration$
declare definition text;signature regprocedure;old text;begin
 foreach signature in array array[
 'private.complete_owner_visit(uuid,uuid,integer,jsonb,boolean,text)'::regprocedure,
 'private.complete_service_call(uuid,uuid,integer,text)'::regprocedure,
 'private.approve_invoice(uuid,uuid,integer,integer,boolean,text)'::regprocedure,
 'private.complete_and_invoice(uuid,uuid,integer)'::regprocedure,
 'private.current_invoice_tax(uuid,uuid,integer)'::regprocedure] loop
  definition:=pg_get_functiondef(signature);old:='if not private.staff(p_org,array[''owner'',''admin'']) then';
  if strpos(definition,old)=0 then raise exception 'field closeout permission baseline changed: %',signature;end if;
  definition:=replace(definition,old,'if not private.field_job_access(p_org,p_job) then');
  -- Re-check a delegation after waiting on the job lock, before any consequential write.
  old:='select * into j from public.jobs where organization_id=p_org and id=p_job for update;';
  if strpos(definition,old)>0 then definition:=replace(definition,old,old||' if not private.field_job_access(p_org,p_job) then raise exception ''FORBIDDEN'' using errcode=''42501'';end if;');end if;
  execute definition;
 end loop;
 definition:=pg_get_functiondef('private.job_action(uuid,uuid,integer,text,text,text)'::regprocedure);
 old:='if not private.staff(p_org,array[''owner'',''admin'',''technician'']) then';if strpos(definition,old)=0 then raise exception 'field timer permission baseline changed';end if;
 definition:=replace(definition,old,'if not private.field_job_access(p_org,p_id) then');
 old:='select * into j from public.jobs where organization_id=p_org and id=p_id for update;';if strpos(definition,old)=0 then raise exception 'field timer lock baseline changed';end if;
 execute replace(definition,old,old||' if not private.field_job_access(p_org,p_id) then raise exception ''FORBIDDEN'' using errcode=''42501'';end if;');
 definition:=pg_get_functiondef('private.record_payment(uuid,uuid,integer,text,text,timestamp with time zone,boolean,text)'::regprocedure);
 old:='if not private.staff(p_org,array[''owner'',''admin'',''bookkeeper'']) then';if strpos(definition,old)=0 then raise exception 'field payment permission baseline changed';end if;
 definition:=replace(definition,old,'if not private.staff(p_org,array[''owner'',''admin'',''bookkeeper'']) and not private.field_invoice_access(p_org,p_invoice) then');
 -- Lock job before invoice, matching assignment/issuance lock order. Owner and
 -- bookkeeper receipt behavior is unchanged; technician access is revalidated.
 old:='select * into i from public.invoices where organization_id=p_org and id=p_invoice for update;';if strpos(definition,old)=0 then raise exception 'field receipt lock baseline changed';end if;
 execute replace(definition,old,'perform 1 from public.jobs j join public.invoices fi on fi.organization_id=j.organization_id and fi.job_id=j.id where fi.organization_id=p_org and fi.id=p_invoice for update of j; if not private.staff(p_org,array[''owner'',''admin'',''bookkeeper'']) and not private.field_invoice_access(p_org,p_invoice) then raise exception ''FORBIDDEN'' using errcode=''42501'';end if; '||old);
end $migration$;
create table private.field_job_notes(
 organization_id uuid not null,job_id uuid not null,id uuid not null,actor_id uuid not null references auth.users(id),body text not null check(length(body) between 2 and 3000),created_at timestamptz not null default clock_timestamp(),primary key(organization_id,id),foreign key(organization_id,job_id) references public.jobs(organization_id,id)
);
create index field_notes_job on private.field_job_notes(organization_id,job_id,created_at,id);
alter table private.field_job_notes enable row level security;revoke all on private.field_job_notes from public,anon,authenticated,service_role;
create policy field_notes_deny on private.field_job_notes to anon,authenticated using(false) with check(false);
create function private.field_invoice_summary(p_org uuid,p_job uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',i.id,'number',i.number,'totalCents',i.total_cents,'paidCents',coalesce((select sum(cents) from public.payments where organization_id=p_org and invoice_id=i.id),0),'creditedCents',private.invoice_credit_total(p_org,i.id),'balanceCents',i.total_cents-private.invoice_credit_total(p_org,i.id)-coalesce((select sum(cents) from public.payments where organization_id=p_org and invoice_id=i.id),0),'issuedAt',i.issued_at,'lines',coalesce(i.snapshot->'recordedWork','[]')) from public.invoices i where i.organization_id=p_org and i.job_id=p_job
$$;
revoke all on function private.field_invoice_summary(uuid,uuid) from public,anon,authenticated,service_role;
create function public.field_work_workspace(p_org uuid,p_job uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare items jsonb;item jsonb;details jsonb;notes jsonb;zone text;n integer;begin
 if not private.staff(p_org,array['owner','admin','technician']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_job is not null and not private.field_job_access(p_org,p_job) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select timezone into zone from public.organizations where id=p_org;
 select count(*) into n from public.jobs j where j.organization_id=p_org and private.field_job_access(p_org,j.id) and (p_job is null or j.id=p_job) and j.status in('approved','scheduled','en_route','arrived','working','paused','completed') and (p_job is not null or not exists(select 1 from public.invoices i where i.organization_id=p_org and i.job_id=j.id and i.total_cents-private.invoice_credit_total(p_org,i.id)-coalesce((select sum(cents) from public.payments where organization_id=p_org and invoice_id=i.id),0)=0));
 if n>100 then raise exception 'CAPACITY_REVIEW';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'revision',j.revision,'status',j.status,'customer',c.display_name,'start',a.start_at,'end',a.end_at,'arrival',a.arrival_at,'invoice',private.field_invoice_summary(p_org,j.id)) order by a.start_at nulls last,j.id),'[]') into items from public.jobs j join public.customers c on c.organization_id=j.organization_id and c.id=j.customer_id left join lateral(select start_at,end_at,arrival_at from public.appointments where organization_id=p_org and job_id=j.id and status='reserved' order by start_at desc,id limit 1) a on true where j.organization_id=p_org and private.field_job_access(p_org,j.id) and (p_job is null or j.id=p_job) and j.status in('approved','scheduled','en_route','arrived','working','paused','completed') and (p_job is not null or not exists(select 1 from public.invoices i where i.organization_id=p_org and i.job_id=j.id and i.total_cents-private.invoice_credit_total(p_org,i.id)-coalesce((select sum(cents) from public.payments where organization_id=p_org and invoice_id=i.id),0)=0));
 if p_job is null then return jsonb_build_object('organization',p_org,'actor',auth.uid(),'timezone',zone,'checkedAt',clock_timestamp(),'items',items);end if;
 if jsonb_array_length(items)<>1 then raise exception 'NOT_FOUND';end if;item:=items->0;
 select jsonb_build_object('scope',qv.scope,'address',concat_ws(', ',p.street,p.city,p.region,p.postal_code)) into details from public.jobs j join public.quote_versions qv on qv.organization_id=j.organization_id and qv.quote_id=j.quote_id and qv.version=j.approved_version join public.properties p on p.organization_id=j.organization_id and p.id=(qv.snapshot->>'propertyId')::uuid where j.organization_id=p_org and j.id=p_job;
 if (select count(*) from private.field_job_notes where organization_id=p_org and job_id=p_job)>100 then raise exception 'CAPACITY_REVIEW';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'body',body,'at',created_at,'actor',actor_id) order by created_at,id),'[]') into notes from private.field_job_notes where organization_id=p_org and job_id=p_job;
 return jsonb_build_object('organization',p_org,'actor',auth.uid(),'timezone',zone,'checkedAt',clock_timestamp(),'job',item,'scope',details->>'scope','address',details->>'address','notes',notes);
end $$;
create function public.field_work_command(p_org uuid,p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;action_n text;k uuid;target uuid;f text;ns text;prior private.command_receipts;saved jsonb;r jsonb;begin
 if p_body is null or octet_length(p_body)>12000 then raise exception 'VALIDATION';end if;d:=p_body::jsonb;action_n:=d->>'action';k:=(d->>'key')::uuid;target:=case when action_n='payment' then (d->>'invoice')::uuid else (d->>'job')::uuid end;
 if k is null or target is null or (d->>'organization')::uuid is distinct from p_org or action_n is null or action_n not in('timer','note','payment') then raise exception 'VALIDATION';end if;
 if (action_n='payment' and not private.field_invoice_access(p_org,target)) or (action_n<>'payment' and not private.field_job_access(p_org,target)) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 ns:='FieldWork:'||auth.uid()::text;f:=encode(sha256(convert_to(p_body,'UTF8')),'hex');perform pg_advisory_xact_lock(hashtextextended(p_org::text||ns||k::text,0));select * into prior from private.command_receipts where organization_id=p_org and command=ns and key=k::text;
 if found then if prior.fingerprint<>f then raise exception 'IDEMPOTENCY_CONFLICT';end if;if prior.result->>'outcome'='not_applied' then raise exception 'ATTEMPT_CLOSED';end if;return prior.result;end if;
 if action_n='timer' then
  if (select count(*) from jsonb_object_keys(d))<>6 or exists(select 1 from jsonb_object_keys(d) x where x not in('organization','key','action','job','revision','operation')) or jsonb_typeof(d->'revision') is distinct from 'number' then raise exception 'VALIDATION';end if;
  saved:=private.job_action(p_org,target,(d->>'revision')::integer,d->>'operation','',k::text);
 elsif action_n='payment' then
  if (select count(*) from jsonb_object_keys(d))<>9 or exists(select 1 from jsonb_object_keys(d) x where x not in('organization','key','action','invoice','cents','method','reference','receivedAt','confirmed')) or d->'confirmed' is distinct from 'true'::jsonb or jsonb_typeof(d->'cents') is distinct from 'number' then raise exception 'VALIDATION';end if;
  saved:=private.record_payment(p_org,target,(d->>'cents')::integer,d->>'method',d->>'reference',(d->>'receivedAt')::timestamptz,true,k::text);
 else
  if (select count(*) from jsonb_object_keys(d))<>5 or exists(select 1 from jsonb_object_keys(d) x where x not in('organization','key','action','job','body')) or jsonb_typeof(d->'body') is distinct from 'string' or length(btrim(d->>'body')) not between 2 and 3000 then raise exception 'VALIDATION';end if;
  perform 1 from public.jobs where organization_id=p_org and id=target for update;if not found then raise exception 'NOT_FOUND';end if;
  if not private.field_job_access(p_org,target) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if (select count(*) from private.field_job_notes where organization_id=p_org and job_id=target)>=100 then raise exception 'CAPACITY_REVIEW';end if;
  insert into private.field_job_notes(organization_id,job_id,id,actor_id,body) values(p_org,target,k,auth.uid(),btrim(d->>'body'));
  insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'job.field_note_added',target,1,k);saved:=jsonb_build_object('id',k,'job',target);
 end if;
 r:=jsonb_build_object('organization',p_org,'key',k,'target',target,'action',action_n,'fingerprint',f,'outcome','saved','result',saved);insert into private.command_receipts values(p_org,ns,k::text,f,r,now());return r;
end $$;
create function public.field_work_resolve(p_org uuid,p_key uuid,p_target uuid,p_operation text,p_fingerprint text) returns jsonb language plpgsql security definer set search_path='' as $$
declare prior private.command_receipts;ns text;r jsonb;begin
 if p_key is null or p_target is null or p_operation is null or p_operation not in('timer','note','payment') or p_fingerprint is null or p_fingerprint!~'^[a-f0-9]{64}$' then raise exception 'VALIDATION';end if;
 if (p_operation='payment' and not private.field_invoice_access(p_org,p_target)) or (p_operation<>'payment' and not private.field_job_access(p_org,p_target)) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 ns:='FieldWork:'||auth.uid()::text;perform pg_advisory_xact_lock(hashtextextended(p_org::text||ns||p_key::text,0));select * into prior from private.command_receipts where organization_id=p_org and command=ns and key=p_key::text;
 if found then if prior.fingerprint<>p_fingerprint or prior.result->>'target'<>p_target::text or prior.result->>'action'<>p_operation then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 r:=jsonb_build_object('organization',p_org,'key',p_key,'target',p_target,'action',p_operation,'fingerprint',p_fingerprint,'outcome','not_applied','result',null);insert into private.command_receipts values(p_org,ns,p_key::text,p_fingerprint,r,now());return r;
end $$;
revoke all on function public.field_work_workspace(uuid,uuid),public.field_work_command(uuid,text),public.field_work_resolve(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.field_work_workspace(uuid,uuid),public.field_work_command(uuid,text),public.field_work_resolve(uuid,uuid,uuid,text,text) to authenticated;
create function public.field_labor_context(p_org uuid,p_job uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j public.jobs;q public.quote_versions;draft jsonb;begin
 if not private.labor_editor(p_org,p_job) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into j from public.jobs where organization_id=p_org and id=p_job;if not found then raise exception 'NOT_FOUND';end if;
 if j.status not in('working','paused','completed') or exists(select 1 from public.invoices where organization_id=p_org and job_id=p_job) then raise exception 'TRANSITION';end if;
 select * into q from public.quote_versions where organization_id=p_org and quote_id=j.quote_id and version=j.approved_version;
 select jsonb_build_object('lines',lines,'jobRevision',job_revision) into draft from private.invoice_labor_drafts where organization_id=p_org and job_id=p_job;
 return jsonb_build_object('organization',p_org,'job',p_job,'crew',q.snapshot->'crew','draft',draft);
end $$;
revoke all on function public.field_labor_context(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.field_labor_context(uuid,uuid) to authenticated;
create function public.field_invoice_work_context(p_org uuid,p_job uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb;j public.jobs;q public.quote_versions;cfg jsonb;required_n boolean;valid_n boolean:=true;tax jsonb;can_issue boolean;begin
 base:=public.field_labor_context(p_org,p_job);can_issue:=private.field_job_access(p_org,p_job);
 select * into j from public.jobs where organization_id=p_org and id=p_job;select * into q from public.quote_versions where organization_id=p_org and quote_id=j.quote_id and version=j.approved_version;cfg:=q.snapshot->'configuration';
 required_n:=exists(select 1 from private.tax_profiles where organization_id=p_org);
 if can_issue then begin tax:=private.current_invoice_tax(p_org,p_job,j.revision);exception when raise_exception then if sqlerrm<>'TAX_REVIEW_REQUIRED' then raise;end if;valid_n:=false;end;else valid_n:=false;end if;
 return base||jsonb_build_object('canIssue',can_issue,'configuration',jsonb_build_object('sellerVerified',cfg->'sellerVerified','sellerLegalName',cfg->'sellerLegalName','invoiceTerms',cfg->'invoiceTerms','taxTreatmentVerified',cfg->'taxTreatmentVerified','laborTaxTreatment',cfg->'laborTaxTreatment'),'tax',jsonb_build_object('required',required_n,'valid',valid_n,'tax',case when tax is null then null else jsonb_build_object('taxCents',(tax->>'taxCents')::integer) end));
end $$;
revoke all on function public.field_invoice_work_context(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.field_invoice_work_context(uuid,uuid) to authenticated;
-- Retain a truthful issuer audit and recognize authorized field approval in the
-- existing office delivery/paid-notice guards. Mail configuration is unchanged.
do $migration$
declare d text;old text;begin
 d:=pg_get_functiondef('private.approve_invoice(uuid,uuid,integer,integer,boolean,text)'::regprocedure);old:='''invoice.owner_approved''';if strpos(d,old)=0 then raise exception 'invoice approval audit baseline changed';end if;
 execute replace(d,old,'case when private.staff(p_org,array[''owner'',''admin'']) then ''invoice.owner_approved'' else ''invoice.field_approved'' end');
 d:=pg_get_functiondef('private.request_invoice_delivery(uuid,uuid,boolean,text)'::regprocedure);old:='action=''invoice.owner_approved''';if strpos(d,old)=0 then raise exception 'invoice delivery approval baseline changed';end if;execute replace(d,old,'action in(''invoice.owner_approved'',''invoice.field_approved'')');
 d:=pg_get_functiondef('private.paid_notice_current(uuid,uuid)'::regprocedure);old:='a.action=''invoice.owner_approved''';if strpos(d,old)=0 then raise exception 'paid-notice approval baseline changed';end if;execute replace(d,old,'a.action in(''invoice.owner_approved'',''invoice.field_approved'')');
end $migration$;
