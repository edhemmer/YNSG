-- Reviewed tenant tax rules, append-only records, and immutable invoice tax snapshots.
-- No default tax rate, registration, personal filing status or payment is inferred.
create table private.tax_profiles(
 organization_id uuid not null references public.organizations(id),version integer not null check(version>0),
 data jsonb not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(organization_id,version));
create index tax_profiles_actor on private.tax_profiles(created_by);
create table private.tax_records(
 organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(),
 record_type text not null check(record_type in ('deadline','payment','reversal')),data jsonb not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(organization_id,id));
create index tax_records_actor on private.tax_records(created_by);
create table private.invoice_tax_assessments(
 organization_id uuid not null,job_id uuid not null,job_revision integer not null,profile_version integer not null,
 data jsonb not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(organization_id,job_id),foreign key(organization_id,job_id) references public.jobs(organization_id,id),
 foreign key(organization_id,profile_version) references private.tax_profiles(organization_id,version));
create index invoice_tax_assessments_actor on private.invoice_tax_assessments(created_by);
alter table private.tax_profiles enable row level security;
alter table private.tax_records enable row level security;
alter table private.invoice_tax_assessments enable row level security;
revoke all on private.tax_profiles,private.tax_records,private.invoice_tax_assessments from public,anon,authenticated,service_role;
create policy tax_profiles_deny on private.tax_profiles to anon,authenticated using(false) with check(false);
create policy tax_records_deny on private.tax_records to anon,authenticated using(false) with check(false);
create policy invoice_taxes_deny on private.invoice_tax_assessments to anon,authenticated using(false) with check(false);

create function private.tax_workspace(p_org uuid,p_year integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare profile jsonb;items jsonb;invoices jsonb;tz text;
begin
 if not private.staff(p_org,array['owner','admin','bookkeeper']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_year not between 2026 and 2100 then raise exception 'VALIDATION';end if;
 select timezone into tz from public.organizations where id=p_org;
 select jsonb_build_object('version',version,'data',data) into profile from private.tax_profiles where organization_id=p_org order by version desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'recordType',record_type,'data',data,'recordedAt',created_at) order by created_at,id),'[]') into items from private.tax_records where organization_id=p_org and (data->>'year')::integer=p_year;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'number',i.number,'issuedAt',i.issued_at,'subtotalCents',i.total_cents-coalesce((i.snapshot->>'taxCents')::integer,0),'taxCents',coalesce((i.snapshot->>'taxCents')::integer,0),'totalCents',i.total_cents,'tax',i.snapshot->'tax','paidCents',coalesce((select sum(p.cents) from public.payments p where p.organization_id=p_org and p.invoice_id=i.id),0)) order by i.issued_at,i.id),'[]') into invoices from public.invoices i where i.organization_id=p_org and extract(year from timezone(tz,i.issued_at))=p_year;
 return jsonb_build_object('profile',profile,'records',items,'invoices',invoices,'timezone',tz,'today',timezone(tz,now())::date,'canEdit',private.staff(p_org,array['owner','admin']));
end$$;
create function public.tax_workspace(p_org uuid,p_year integer) returns jsonb language sql security invoker set search_path='' as $$select private.tax_workspace(p_org,p_year)$$;

create function private.tax_command(p_org uuid,p_action text,p_version integer,p_data jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior private.command_receipts;fingerprint text;result jsonb;v integer;rule jsonb;c jsonb;ids text[]:=array[]::text[];rate bigint;today date;row_id uuid;target private.tax_records;profile jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_action not in ('profile','deadline','payment','reversal') or p_key is null or length(p_key) not between 16 and 128 or jsonb_typeof(p_data) is distinct from 'object' or length(p_data::text)>100000 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_action,p_version,p_data)::text,'UTF8')),'hex');
 -- One tenant lock serializes profile publication, assessments and invoice issuance.
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':tax',0));
 select * into prior from private.command_receipts where organization_id=p_org and command='TaxWorkspace' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select timezone(timezone,now())::date into today from public.organizations where id=p_org;
 select version,data into v,profile from private.tax_profiles where organization_id=p_org order by version desc limit 1;
 v:=coalesce(v,0);
 if p_version is distinct from v then raise exception 'TAX_PROFILE_CHANGED';end if;
 if jsonb_typeof(p_data->'year') is distinct from 'number' or coalesce(p_data->>'year','')!~'^[0-9]{4}$' or (p_data->>'year')::integer not between 2026 and 2100 then raise exception 'VALIDATION';end if;
 if p_action='profile' then
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('year','state','entity','federalAnnualPaymentCents','stateAnnualPaymentCents','federalSource','stateSource','reviewedOn','reviewNote','rules'))
   or coalesce(p_data->>'state','')!~'^[A-Z]{2}$' or coalesce(p_data->>'entity','') not in ('individual_calendar','other')
   or length(trim(coalesce(p_data->>'reviewNote','')))<2 or length(p_data->>'reviewNote')>500
   or coalesce(p_data->>'federalSource','')!~'^https://[^[:space:]]+$' or length(p_data->>'federalSource')>1000
   or coalesce(p_data->>'stateSource','')!~'^https://[^[:space:]]+$' or length(p_data->>'stateSource')>1000
   or coalesce(p_data->>'reviewedOn','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (p_data->>'reviewedOn')::date>today
   or jsonb_typeof(p_data->'rules') is distinct from 'array' or jsonb_array_length(p_data->'rules')>50 then raise exception 'VALIDATION';end if;
  for c in select value from jsonb_each(p_data) where key in ('federalAnnualPaymentCents','stateAnnualPaymentCents') loop
   if c<>'null'::jsonb and (jsonb_typeof(c)<>'number' or c::text!~'^[0-9]+$' or c::text::bigint>999999999) then raise exception 'VALIDATION';end if;
  end loop;
  if not (p_data ? 'federalAnnualPaymentCents' and p_data ? 'stateAnnualPaymentCents') then raise exception 'VALIDATION';end if;
  for rule in select value from jsonb_array_elements(p_data->'rules') loop
   if jsonb_typeof(rule) is distinct from 'object' or exists(select 1 from jsonb_object_keys(rule) k where k not in ('id','label','state','county','city','jurisdictionEvidence','scope','effectiveFrom','effectiveTo','reviewedOn','sourceUrl','components','rounding','reviewed'))
    or rule->'reviewed' is distinct from 'true'::jsonb or coalesce(rule->>'rounding','')<>'component_half_up'
    or rule->>'state' is distinct from p_data->>'state' or coalesce(rule->>'sourceUrl','')!~'^https://[^[:space:]]+$' or length(rule->>'sourceUrl')>1000
    or coalesce(rule->>'effectiveFrom','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(rule->>'effectiveTo','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(rule->>'reviewedOn','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or (rule->>'effectiveFrom')::date>(rule->>'effectiveTo')::date or (rule->>'reviewedOn')::date>today
    or jsonb_typeof(rule->'components') is distinct from 'array' or jsonb_array_length(rule->'components') not between 1 and 8 then raise exception 'VALIDATION';end if;
   row_id:=(rule->>'id')::uuid;
   if row_id is null or row_id::text=any(ids) then raise exception 'VALIDATION';end if;ids:=array_append(ids,row_id::text);
   for c in select value from jsonb_each(rule) where key in ('label','county','city','jurisdictionEvidence','scope') loop
    if jsonb_typeof(c)<>'string' or length(trim(c#>>'{}')) not between 2 and 500 then raise exception 'VALIDATION';end if;
   end loop;
   if not (rule ?& array['label','county','city','jurisdictionEvidence','scope']) then raise exception 'VALIDATION';end if;
   rate:=0;
   for c in select value from jsonb_array_elements(rule->'components') loop
    if jsonb_typeof(c) is distinct from 'object' or exists(select 1 from jsonb_object_keys(c) k where k not in ('kind','label','ratePpm'))
     or coalesce(c->>'kind','') not in ('state','county','city','district') or length(trim(coalesce(c->>'label',''))) not between 2 and 500
     or jsonb_typeof(c->'ratePpm') is distinct from 'number' or coalesce(c->>'ratePpm','')!~'^[0-9]+$' or (c->>'ratePpm')::bigint>250000 then raise exception 'VALIDATION';end if;
    rate:=rate+(c->>'ratePpm')::bigint;
   end loop;
   if rate>250000 then raise exception 'VALIDATION';end if;
  end loop;
  insert into private.tax_profiles values(p_org,v+1,p_data,auth.uid(),now());
  result:=jsonb_build_object('version',v+1);
 elsif p_action='reversal' then
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('year','recordId','reason')) or length(trim(coalesce(p_data->>'reason',''))) not between 2 and 500 then raise exception 'VALIDATION';end if;
  select * into target from private.tax_records where organization_id=p_org and id=(p_data->>'recordId')::uuid;
  if not found or target.record_type='reversal' or target.data->>'year' is distinct from p_data->>'year' then raise exception 'NOT_FOUND';end if;
  if exists(select 1 from private.tax_records where organization_id=p_org and record_type='reversal' and data->>'recordId'=target.id::text) then raise exception 'ALREADY_REVERSED';end if;
  insert into private.tax_records(organization_id,record_type,data,created_by) values(p_org,p_action,p_data,auth.uid()) returning id into row_id;
  result:=jsonb_build_object('id',row_id);
 else
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('year','kind','label','period','date','amountCents','sourceUrl','paymentUrl','reference','reviewed','deadlineId'))
   or coalesce(p_data->>'kind','') not in ('federal_estimated','state_income','sales_tax','use_tax','other')
   or length(trim(coalesce(p_data->>'label',''))) not between 2 and 500 or length(trim(coalesce(p_data->>'period',''))) not between 2 and 500
   or coalesce(p_data->>'amountCents','')!~'^[0-9]+$' or (p_data->>'amountCents')::bigint>999999999
   or coalesce(p_data->>'date','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   or coalesce(p_data->>'sourceUrl','')!~'^https://[^[:space:]]+$' or length(p_data->>'sourceUrl')>1000
   or coalesce(p_data->>'paymentUrl','')!~'^https://[^[:space:]]+$' or length(p_data->>'paymentUrl')>1000
   or p_data->'reviewed' is distinct from 'true'::jsonb then raise exception 'VALIDATION';end if;
  perform (p_data->>'date')::date;
  if p_action='payment' and ((p_data->>'amountCents')::bigint=0 or (p_data->>'date')::date>today or length(trim(coalesce(p_data->>'reference',''))) not between 2 and 500) then raise exception 'VALIDATION';end if;
  if p_action='payment' then
   -- If allocated to a saved deadline, enforce the tenant, year and category relationship.
   if length(coalesce(p_data->>'deadlineId',''))>0 and p_data->>'deadlineId' not like 'federal_estimated:%' and p_data->>'deadlineId' not like 'state_income:%' then
    select * into target from private.tax_records where organization_id=p_org and id=(p_data->>'deadlineId')::uuid and record_type='deadline';
    if not found or target.data->>'year' is distinct from p_data->>'year' or target.data->>'kind' is distinct from p_data->>'kind' then raise exception 'VALIDATION';end if;
   elsif length(coalesce(p_data->>'deadlineId',''))>0 then
    if profile->>'year' is distinct from p_data->>'year' or profile->>'entity'<>'individual_calendar' or p_data->>'year'<>'2026'
     or p_data->>'deadlineId' !~ ('^'||(p_data->>'kind')||':2026:[1-4]$') or (p_data->>'kind'='state_income' and profile->>'state'<>'IL') then raise exception 'VALIDATION';end if;
   end if;
  end if;
  insert into private.tax_records(organization_id,record_type,data,created_by) values(p_org,p_action,p_data,auth.uid()) returning id into row_id;
  result:=jsonb_build_object('id',row_id);
 end if;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'tax.'||p_action,coalesce(row_id,p_org),coalesce(v,0)+case when p_action='profile' then 1 else 0 end,gen_random_uuid());
 insert into private.command_receipts values(p_org,'TaxWorkspace',p_key,fingerprint,result,now());return result;
end$$;
create function public.tax_command(p_org uuid,p_action text,p_version integer,p_data jsonb,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.tax_command(p_org,p_action,p_version,p_data,p_key)$$;

create function private.current_invoice_tax(p_org uuid,p_job uuid,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v integer;profile jsonb;a private.invoice_tax_assessments;q public.quote_versions;prop public.properties;today date;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':tax',0));
 select version,data into v,profile from private.tax_profiles where organization_id=p_org order by version desc limit 1;
 if v is null then return jsonb_build_object('taxCents',0,'components','[]'::jsonb);end if;
 select timezone(timezone,now())::date into today from public.organizations where id=p_org;
 select * into a from private.invoice_tax_assessments where organization_id=p_org and job_id=p_job;
 if not found or a.job_revision<>p_revision or a.profile_version<>v or a.data->>'assessedOn'<>today::text or profile->>'year'<>extract(year from today)::text then raise exception 'TAX_REVIEW_REQUIRED';end if;
 select qv.* into q from public.jobs j join public.quote_versions qv on qv.organization_id=j.organization_id and qv.quote_id=j.quote_id and qv.version=j.approved_version where j.organization_id=p_org and j.id=p_job;
 select * into prop from public.properties where organization_id=p_org and id=(q.snapshot->>'propertyId')::uuid;
 if a.data->'address' is distinct from jsonb_build_object('street',prop.street,'city',prop.city,'state',prop.region,'postalCode',coalesce(prop.postal_code,'')) then raise exception 'TAX_REVIEW_REQUIRED';end if;
 return a.data;
end$$;

create function private.assess_invoice_tax(p_org uuid,p_job uuid,p_revision integer,p_rule uuid,p_evidence text,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.jobs;q public.quote_versions;prop public.properties;v integer;profile jsonb;rule jsonb;c jsonb;base bigint;tax bigint:=0;part bigint;components jsonb:='[]';today date;prior private.command_receipts;fingerprint text;result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or length(p_key) not between 16 and 128 or length(trim(coalesce(p_evidence,''))) not between 2 and 1000 then raise exception 'VALIDATION';end if;
 select * into j from public.jobs where organization_id=p_org and id=p_job for update;
 if not found then raise exception 'NOT_FOUND';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':tax',0));
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_job,p_revision,p_rule,p_evidence)::text,'UTF8')),'hex');
 select * into prior from private.command_receipts where organization_id=p_org and command='InvoiceTax' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if j.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 if j.status<>'completed' or exists(select 1 from public.invoices where organization_id=p_org and job_id=p_job) then raise exception 'TRANSITION';end if;
 select version,data into v,profile from private.tax_profiles where organization_id=p_org order by version desc limit 1;
 select timezone(timezone,now())::date into today from public.organizations where id=p_org;
 if v is null or profile->>'year'<>extract(year from today)::text then raise exception 'TAX_REVIEW_REQUIRED';end if;
 select value into rule from jsonb_array_elements(profile->'rules') where value->>'id'=p_rule::text;
 if rule is null or today not between (rule->>'effectiveFrom')::date and (rule->>'effectiveTo')::date then raise exception 'TAX_REVIEW_REQUIRED';end if;
 select * into q from public.quote_versions where organization_id=p_org and quote_id=j.quote_id and version=j.approved_version;
 select * into prop from public.properties where organization_id=p_org and id=(q.snapshot->>'propertyId')::uuid and customer_id=j.customer_id;
 if prop.id is null or lower(trim(prop.city))<>lower(trim(rule->>'city')) or upper(trim(prop.region))<>rule->>'state' then raise exception 'TAX_JURISDICTION_MISMATCH';end if;
 select sum((value->>'chargedCents')::bigint) into base from private.invoice_labor_drafts d cross join lateral jsonb_array_elements(d.lines) where d.organization_id=p_org and d.job_id=p_job and d.job_revision=p_revision;
 if base is null then raise exception 'INVOICE_DRAFT_REQUIRED';end if;
 for c in select value from jsonb_array_elements(rule->'components') loop
  part:=(base*(c->>'ratePpm')::bigint+500000)/1000000;
  tax:=tax+part;components:=components||jsonb_build_array(c||jsonb_build_object('baseCents',base,'taxCents',part));
 end loop;
 if base+tax>999999999 then raise exception 'VALIDATION';end if;
 update public.jobs set revision=revision+1 where organization_id=p_org and id=p_job returning * into j;
 update private.invoice_labor_drafts set job_revision=j.revision where organization_id=p_org and job_id=p_job;
 result:=jsonb_build_object('profileVersion',v,'rule',rule,'address',jsonb_build_object('street',prop.street,'city',prop.city,'state',prop.region,'postalCode',coalesce(prop.postal_code,'')),
 'assessedOn',today,'subtotalCents',base,'taxCents',tax,'totalCents',base+tax,'components',components,'customerApprovalEvidence',p_evidence,'reviewedBy',auth.uid());
 insert into private.invoice_tax_assessments values(p_org,p_job,j.revision,v,result,auth.uid(),now()) on conflict(organization_id,job_id) do update set job_revision=excluded.job_revision,profile_version=excluded.profile_version,data=excluded.data,created_by=excluded.created_by,created_at=now();
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'invoice.tax_reviewed',p_job,j.revision,gen_random_uuid());
 result:=jsonb_build_object('revision',j.revision,'tax',result);
 insert into private.command_receipts values(p_org,'InvoiceTax',p_key,fingerprint,result,now());return result;
end$$;
create function public.assess_invoice_tax(p_org uuid,p_job uuid,p_revision integer,p_rule uuid,p_evidence text,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.assess_invoice_tax(p_org,p_job,p_revision,p_rule,p_evidence,p_key)$$;
create function private.invoice_tax_context(p_org uuid,p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v integer;profile jsonb;j public.jobs;tax jsonb;valid boolean:=true;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into j from public.jobs where organization_id=p_org and id=p_job;if not found then raise exception 'NOT_FOUND';end if;
 select version,data into v,profile from private.tax_profiles where organization_id=p_org order by version desc limit 1;
 begin tax:=private.current_invoice_tax(p_org,p_job,j.revision);exception when raise_exception then if sqlerrm<>'TAX_REVIEW_REQUIRED' then raise;end if;valid:=false;end;
 return jsonb_build_object('required',v is not null,'profileVersion',v,'rules',coalesce(profile->'rules','[]'),'valid',valid,'tax',tax);
end$$;
create function public.invoice_tax_context(p_org uuid,p_job uuid) returns jsonb language sql security invoker set search_path='' as $$select private.invoice_tax_context(p_org,p_job)$$;

-- Extend the existing guarded approval/issuance functions, fail loudly on baseline drift.
do $migration$
declare d text;old text;
begin
 d:=pg_get_functiondef('private.approve_invoice(uuid,uuid,integer,integer,boolean,text)'::regprocedure);
 old:='if total is distinct from p_total::bigint then';
 if strpos(d,old)=0 then raise exception 'invoice total baseline changed';end if;
 execute replace(d,old,'total:=total+coalesce((private.current_invoice_tax(p_org,p_job,p_revision)->>''taxCents'')::bigint,0); if total is distinct from p_total::bigint then');
 d:=pg_get_functiondef('private.complete_and_invoice(uuid,uuid,integer)'::regprocedure);
 old:='work_lines jsonb;';if strpos(d,old)=0 then raise exception 'invoice declaration baseline changed';end if;
 d:=replace(d,old,'work_lines jsonb; tax_snapshot jsonb; tax_cents integer;');
 old:='cfg:=q.snapshot->''configuration'';';if strpos(d,old)=0 then raise exception 'invoice config baseline changed';end if;
 d:=replace(d,old,old||' tax_snapshot:=private.current_invoice_tax(p_org,p_job,p_revision); tax_cents:=coalesce((tax_snapshot->>''taxCents'')::integer,0);');
 old:='cfg->>''taxTreatmentVerified'' is distinct from ''true''';d:=replace(d,old,'(not exists(select 1 from private.tax_profiles where organization_id=p_org) and '||old||')');
 old:='cfg->>''laborTaxTreatment'' is distinct from ''reviewed_non_taxable''';d:=replace(d,old,'(not exists(select 1 from private.tax_profiles where organization_id=p_org) and '||old||')');
 old:='values(p_org,p_job,j.customer_id,n,charged,q.snapshot||';if strpos(d,old)=0 then raise exception 'invoice amount baseline changed';end if;
 d:=replace(d,old,'values(p_org,p_job,j.customer_id,n,charged+tax_cents,q.snapshot||jsonb_build_object(''tax'',tax_snapshot)||');
 old:='''totalCents'',charged';d:=replace(d,old,'''totalCents'',charged+tax_cents');
 old:='''taxCents'',0';d:=replace(d,old,'''taxCents'',tax_cents');
 old:='(p_org,entry,''labor_revenue'',0,inv.total_cents);';if strpos(d,old)=0 then raise exception 'invoice ledger baseline changed';end if;
 d:=replace(d,old,'(p_org,entry,''labor_revenue'',0,charged); if tax_cents>0 then insert into public.journal_lines(organization_id,entry_id,account,debit_cents,credit_cents) values(p_org,entry,''tax_payable'',0,tax_cents);end if;');
 execute d;
end $migration$;
revoke all on function private.tax_workspace(uuid,integer),public.tax_workspace(uuid,integer),private.tax_command(uuid,text,integer,jsonb,text),public.tax_command(uuid,text,integer,jsonb,text),private.current_invoice_tax(uuid,uuid,integer),private.assess_invoice_tax(uuid,uuid,integer,uuid,text,text),public.assess_invoice_tax(uuid,uuid,integer,uuid,text,text),private.invoice_tax_context(uuid,uuid),public.invoice_tax_context(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.tax_workspace(uuid,integer),public.tax_workspace(uuid,integer),private.tax_command(uuid,text,integer,jsonb,text),public.tax_command(uuid,text,integer,jsonb,text),private.assess_invoice_tax(uuid,uuid,integer,uuid,text,text),public.assess_invoice_tax(uuid,uuid,integer,uuid,text,text),private.invoice_tax_context(uuid,uuid),public.invoice_tax_context(uuid,uuid) to authenticated;

-- One owner action atomically reviews the rule and issues the invoice. A failure rolls both back.
create function private.approve_taxed_invoice(p_org uuid,p_job uuid,p_revision integer,p_rule uuid,p_evidence text,p_total integer,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare assessed jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 assessed:=private.assess_invoice_tax(p_org,p_job,p_revision,p_rule,p_evidence,p_key||':tax');
 return private.approve_invoice(p_org,p_job,(assessed->>'revision')::integer,p_total,true,p_key||':issue');
end$$;
create function public.approve_taxed_invoice(p_org uuid,p_job uuid,p_revision integer,p_rule uuid,p_evidence text,p_total integer,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.approve_taxed_invoice(p_org,p_job,p_revision,p_rule,p_evidence,p_total,p_key)$$;
revoke all on function private.approve_taxed_invoice(uuid,uuid,integer,uuid,text,integer,text),public.approve_taxed_invoice(uuid,uuid,integer,uuid,text,integer,text) from public,anon,authenticated,service_role;
grant execute on function private.approve_taxed_invoice(uuid,uuid,integer,uuid,text,integer,text),public.approve_taxed_invoice(uuid,uuid,integer,uuid,text,integer,text) to authenticated;

-- Card payments are provider-confirmed only. Manual forms remain cash / Zelle only.
alter table public.payments drop constraint payments_method_check;
alter table public.payments add constraint payments_method_check check(method in ('cash','zelle','stripe','stripe_refund'));
alter table public.payments drop constraint payments_cents_check;
alter table public.payments add constraint payments_cents_check check((method='stripe_refund' and cents<0) or (method<>'stripe_refund' and cents>0));
alter table public.journal_lines drop constraint journal_lines_account_check;
alter table public.journal_lines add constraint journal_lines_account_check check(account in ('receivable','labor_revenue','cash','reimbursements','expenses','tax_payable','stripe_clearing'));
create table private.card_orders(
 organization_id uuid not null,id uuid not null default gen_random_uuid(),invoice_id uuid not null,cents integer not null check(cents>0),
 actor_id uuid not null references auth.users(id),account_id text not null,status text not null default 'prepared' check(status in ('prepared','open','paid','expired','failed')),
 session_id text unique,payment_intent text,charge_id text,url text,expires_at bigint not null,created_at timestamptz not null default now(),primary key(organization_id,id),foreign key(organization_id,invoice_id) references public.invoices(organization_id,id));
create unique index card_order_pending on private.card_orders(organization_id,invoice_id) where status in ('prepared','open');
create index card_orders_actor on private.card_orders(actor_id);
create table private.card_transactions(
 organization_id uuid not null,provider_id text not null,order_id uuid not null,kind text not null check(kind in ('payment','refund','alert')),
 amount_cents integer not null,fee_cents integer not null,net_cents integer not null,occurred_at timestamptz not null,details jsonb not null,
 primary key(organization_id,provider_id),foreign key(organization_id,order_id) references private.card_orders(organization_id,id));
create table private.invoice_admin(
 organization_id uuid not null,invoice_id uuid not null,due_date date,archived boolean not null default false,
 revision integer not null default 1,updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 primary key(organization_id,invoice_id),foreign key(organization_id,invoice_id) references public.invoices(organization_id,id));
create index invoice_admin_actor on private.invoice_admin(updated_by);
alter table private.card_orders enable row level security;
alter table private.card_transactions enable row level security;
alter table private.invoice_admin enable row level security;
revoke all on private.card_orders,private.card_transactions,private.invoice_admin from public,anon,authenticated,service_role;
create policy card_orders_deny on private.card_orders to anon,authenticated using(false) with check(false);
create policy card_transactions_deny on private.card_transactions to anon,authenticated using(false) with check(false);
create policy invoice_admin_deny on private.invoice_admin to anon,authenticated using(false) with check(false);

create function private.invoice_payment_context(p_org uuid,p_invoice uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invoices;orders jsonb;admin jsonb;payments jsonb;
begin
 select * into i from public.invoices where organization_id=p_org and id=p_invoice;
 if not found then raise exception 'NOT_FOUND';end if;
 if not private.staff(p_org,array['owner','admin','bookkeeper']) and not private.customer_allowed(p_org,i.customer_id,false,true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select jsonb_build_object('revision',revision,'dueDate',due_date,'archived',archived) into admin from private.invoice_admin where organization_id=p_org and invoice_id=p_invoice;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'cents',cents,'status',status,'url',case when status='open' then url else null end) order by created_at desc),'[]') into orders from private.card_orders where organization_id=p_org and invoice_id=p_invoice;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'cents',cents,'method',method,'reference',reference,'receivedAt',received_at) order by received_at,id),'[]') into payments from public.payments where organization_id=p_org and invoice_id=p_invoice;
 return jsonb_build_object('admin',coalesce(admin,'{"revision":0,"dueDate":null,"archived":false}'), 'orders',orders,'payments',payments,
 'canManage',private.staff(p_org,array['owner','admin','bookkeeper']), 'cardTransactions',coalesce((select jsonb_agg(jsonb_build_object('id',t.provider_id,'kind',t.kind,'amountCents',t.amount_cents,'feeCents',t.fee_cents,'netCents',t.net_cents,'date',t.occurred_at,'details',case when t.kind='alert' then t.details else '{}'::jsonb end)) from private.card_transactions t join private.card_orders o on o.organization_id=t.organization_id and o.id=t.order_id where t.organization_id=p_org and o.invoice_id=p_invoice and private.staff(p_org,array['owner','admin','bookkeeper'])),'[]'));
end$$;
create function public.invoice_payment_context(p_org uuid,p_invoice uuid) returns jsonb language sql security invoker set search_path='' as $$select private.invoice_payment_context(p_org,p_invoice)$$;
create function private.manage_invoice(p_org uuid,p_invoice uuid,p_revision integer,p_due date,p_archived boolean,p_reason text,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.invoice_admin;prior private.command_receipts;fingerprint text;result jsonb;
begin
 if not private.staff(p_org,array['owner','admin','bookkeeper']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_archived is null or length(trim(coalesce(p_reason,''))) not between 2 and 500 or p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_invoice,p_revision,p_due,p_archived,p_reason)::text,'UTF8')),'hex');
 perform 1 from public.invoices where organization_id=p_org and id=p_invoice for update;if not found then raise exception 'NOT_FOUND';end if;
 select * into prior from private.command_receipts where organization_id=p_org and command='InvoiceAdmin' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into a from private.invoice_admin where organization_id=p_org and invoice_id=p_invoice;
 if coalesce(a.revision,0) is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 insert into private.invoice_admin values(p_org,p_invoice,p_due,p_archived,p_revision+1,auth.uid(),now()) on conflict(organization_id,invoice_id) do update set due_date=excluded.due_date,archived=excluded.archived,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now();
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'invoice.admin_updated',p_invoice,p_revision+1,gen_random_uuid());
 result:=jsonb_build_object('revision',p_revision+1,'dueDate',p_due,'archived',p_archived,'reason',p_reason);
 insert into private.command_receipts values(p_org,'InvoiceAdmin',p_key,fingerprint,result,now());return result;
end$$;
create function public.manage_invoice(p_org uuid,p_invoice uuid,p_revision integer,p_due date,p_archived boolean,p_reason text,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.manage_invoice(p_org,p_invoice,p_revision,p_due,p_archived,p_reason,p_key)$$;

create table private.stripe_merchants(organization_id uuid primary key references public.organizations(id),account_id text not null,verified_at timestamptz not null);
alter table private.stripe_merchants enable row level security;
revoke all on private.stripe_merchants from public,anon,authenticated,service_role;
create policy stripe_merchants_deny on private.stripe_merchants to anon,authenticated using(false) with check(false);
create function private.prepare_card_payment(p_org uuid,p_invoice uuid,p_cents integer,p_account text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invoices;o private.card_orders;paid bigint;
begin
 select * into i from public.invoices where organization_id=p_org and id=p_invoice for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if not private.staff(p_org,array['owner','admin','bookkeeper']) and not private.customer_allowed(p_org,i.customer_id,false,true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_cents is null or p_cents<=0 or coalesce(p_account,'')!~'^acct_[A-Za-z0-9]+$' then raise exception 'VALIDATION';end if;
 if not exists(select 1 from private.stripe_merchants where organization_id=p_org and account_id=p_account and verified_at>now()-interval '1 hour') then raise exception 'STRIPE_MERCHANT_REQUIRED';end if;
 select * into o from private.card_orders where organization_id=p_org and invoice_id=p_invoice and status in ('prepared','open');
 if found then if o.cents<>p_cents or o.account_id<>p_account then raise exception 'CARD_PAYMENT_PENDING';end if;return to_jsonb(o);end if;
 select coalesce(sum(cents),0) into paid from public.payments where organization_id=p_org and invoice_id=p_invoice;
 if paid+p_cents>i.total_cents then raise exception 'OVERPAYMENT_REQUIRES_REVIEW';end if;
 insert into private.card_orders(organization_id,invoice_id,cents,actor_id,account_id,expires_at) values(p_org,p_invoice,p_cents,auth.uid(),p_account,extract(epoch from now())::bigint+3600) returning * into o;
 return to_jsonb(o);
end$$;
create function public.prepare_card_payment(p_org uuid,p_invoice uuid,p_cents integer,p_account text) returns jsonb language sql security invoker set search_path='' as $$select private.prepare_card_payment(p_org,p_invoice,p_cents,p_account)$$;

-- Only the server holding the service credential can save signed, retrieved provider facts.
create function private.stripe_store(p_org uuid,p_order uuid,p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o private.card_orders;i public.invoices;pid uuid;entry uuid;paid bigint;amount integer;fee integer;net integer;provider text;occurred timestamptz;
begin
 if auth.role()<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_action='merchant' then
  if coalesce(p_data->>'accountId','')!~'^acct_[A-Za-z0-9]+$' then raise exception 'VALIDATION';end if;
  insert into private.stripe_merchants values(p_org,p_data->>'accountId',now()) on conflict(organization_id) do update set account_id=excluded.account_id,verified_at=now();return jsonb_build_object('ok',true);
 end if;
 select * into o from private.card_orders where organization_id=p_org and id=p_order;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into i from public.invoices where organization_id=p_org and id=o.invoice_id for update;
 select * into o from private.card_orders where organization_id=p_org and id=p_order for update;
 if p_action='read' then return to_jsonb(o);end if;
 if p_data->>'accountId' is distinct from o.account_id then raise exception 'PROVIDER_MISMATCH';end if;
 if p_action='session' then
  if o.status not in ('prepared','open','paid') or p_data->>'sessionId' !~'^cs_[A-Za-z0-9_]+$' or (p_data->>'url' is not null and p_data->>'url' !~'^https://checkout.stripe.com/') then raise exception 'VALIDATION';end if;
  if o.session_id is not null and o.session_id<>p_data->>'sessionId' then raise exception 'PROVIDER_MISMATCH';end if;
  update private.card_orders set session_id=p_data->>'sessionId',url=p_data->>'url',status=case when status='paid' then status else 'open' end where organization_id=p_org and id=p_order;
 elsif p_action='failed' then
  if o.status<>'prepared' or o.session_id is not null then raise exception 'PROVIDER_MISMATCH';end if;
  update private.card_orders set status='failed' where organization_id=p_org and id=p_order;
 elsif p_action='expired' then
  if o.session_id is not null and o.session_id is distinct from p_data->>'sessionId' then raise exception 'PROVIDER_MISMATCH';end if;
  if o.status<>'paid' then update private.card_orders set status='expired' where organization_id=p_org and id=p_order;end if;
 elsif p_action in ('payment','refund','alert') then
  provider:=p_data->>'providerId';
  if length(coalesce(provider,'')) not between 5 and 200 then raise exception 'VALIDATION';end if;
  if exists(select 1 from private.card_transactions where organization_id=p_org and provider_id=provider and order_id<>p_order) then raise exception 'PROVIDER_MISMATCH';end if;
  if exists(select 1 from private.card_transactions where organization_id=p_org and provider_id=provider) then return jsonb_build_object('replay',true);end if;
  if p_action='alert' then
   insert into private.card_transactions values(p_org,provider,p_order,'alert',0,0,0,now(),p_data);
  else
   amount:=(p_data->>'amountCents')::integer;fee:=(p_data->>'feeCents')::integer;net:=(p_data->>'netCents')::integer;occurred:=(p_data->>'occurredAt')::timestamptz;
   if amount is null or fee is null or net is null or occurred is null or occurred>now()+interval '5 minutes' or p_data->>'currency'<>'usd' or net<>amount-fee then raise exception 'VALIDATION';end if;
   if p_action='payment' then
    if o.status='paid' or amount<>o.cents or fee<0 or net<0 or p_data->>'sessionId' is distinct from o.session_id or coalesce(p_data->>'paymentIntent','')!~'^pi_' or coalesce(p_data->>'chargeId','')!~'^ch_' then raise exception 'PROVIDER_MISMATCH';end if;
    select coalesce(sum(cents),0) into paid from public.payments where organization_id=p_org and invoice_id=i.id;
    if paid+amount>i.total_cents then raise exception 'OVERPAYMENT_REQUIRES_REVIEW';end if;
    update private.card_orders set status='paid',payment_intent=p_data->>'paymentIntent',charge_id=p_data->>'chargeId' where organization_id=p_org and id=p_order;
   else
    if o.status<>'paid' or amount>=0 or p_data->>'chargeId' is distinct from o.charge_id or -amount+coalesce((select -sum(amount_cents) from private.card_transactions where organization_id=p_org and order_id=p_order and kind='refund'),0)>o.cents then raise exception 'PROVIDER_MISMATCH';end if;
   end if;
   insert into public.payments(organization_id,invoice_id,cents,method,collector,reference,received_at) values(p_org,i.id,amount,case when p_action='payment' then 'stripe' else 'stripe_refund' end,o.actor_id,provider,occurred) returning id into pid;
   insert into private.card_transactions values(p_org,provider,p_order,p_action,amount,fee,net,occurred,p_data);
   insert into public.journal_entries(organization_id,source_kind,source_id) values(p_org,case when p_action='refund' then 'reversal' else 'payment' end,pid) returning id into entry;
   insert into public.journal_lines(organization_id,entry_id,account,debit_cents,credit_cents) values(p_org,entry,'receivable',greatest(-amount,0),greatest(amount,0)),(p_org,entry,'stripe_clearing',greatest(net,0),greatest(-net,0));
   if fee<>0 then insert into public.journal_lines(organization_id,entry_id,account,debit_cents,credit_cents) values(p_org,entry,'expenses',greatest(fee,0),greatest(-fee,0));end if;
   insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,o.actor_id,'stripe.'||p_action,pid,1,gen_random_uuid());
   if p_action='payment' and paid+amount=i.total_cents then
    insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(p_org,'invoice:'||i.id||':paid','invoice.paid',i.id,jsonb_build_object('schemaVersion',1,'paymentId',pid)) on conflict do nothing;
   end if;
  end if;
 else raise exception 'VALIDATION';end if;
 return jsonb_build_object('ok',true);
end$$;
create function public.stripe_store(p_org uuid,p_order uuid,p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.stripe_store(p_org,p_order,p_action,p_data)$$;
revoke all on function private.invoice_payment_context(uuid,uuid),public.invoice_payment_context(uuid,uuid),private.manage_invoice(uuid,uuid,integer,date,boolean,text,text),public.manage_invoice(uuid,uuid,integer,date,boolean,text,text),private.prepare_card_payment(uuid,uuid,integer,text),public.prepare_card_payment(uuid,uuid,integer,text),private.stripe_store(uuid,uuid,text,jsonb),public.stripe_store(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.invoice_payment_context(uuid,uuid),public.invoice_payment_context(uuid,uuid),private.manage_invoice(uuid,uuid,integer,date,boolean,text,text),public.manage_invoice(uuid,uuid,integer,date,boolean,text,text),private.prepare_card_payment(uuid,uuid,integer,text),public.prepare_card_payment(uuid,uuid,integer,text) to authenticated;
grant execute on function private.stripe_store(uuid,uuid,text,jsonb),public.stripe_store(uuid,uuid,text,jsonb) to service_role;
do $migration$
declare d text;old text;
begin
 d:=pg_get_functiondef('private.record_payment(uuid,uuid,integer,text,text,timestamp with time zone,boolean,text)'::regprocedure);
 old:='select coalesce(sum(cents),0) into paid from public.payments';
 if strpos(d,old)=0 then raise exception 'manual payment baseline changed';end if;
 execute replace(d,old,'if exists(select 1 from private.card_orders where organization_id=p_org and invoice_id=p_invoice and status in (''prepared'',''open'')) then raise exception ''CARD_PAYMENT_PENDING'';end if; '||old);
end $migration$;
-- Preserve an explicit billed-time/rate or fixed amount. Never infer a rate from the total.
do $migration$
declare d text;old text;
begin
 d:=pg_get_functiondef('private.save_invoice_labor(uuid,uuid,integer,jsonb,text)'::regprocedure);
 old:='''description'',''recordedMinutes'',''chargedCents'',''waiverReason''';
 if strpos(d,old)=0 then raise exception 'invoice line baseline changed';end if;
 d:=replace(d,old,old||',''billingBasis'',''billingMinutes'',''unitRateCents''');
 old:='total:=total+(line->>''chargedCents'')::bigint;';
 if strpos(d,old)=0 then raise exception 'invoice charge baseline changed';end if;
 execute replace(d,old,'if jsonb_typeof(line->''recordedMinutes'') is distinct from ''number'' or jsonb_typeof(line->''chargedCents'') is distinct from ''number'' then raise exception ''VALIDATION'';end if; if line ? ''billingBasis'' and coalesce(line->>''billingBasis'','''') not in (''hourly'',''fixed'') then raise exception ''VALIDATION'';end if;
 if line->>''billingBasis''=''hourly'' then
  if jsonb_typeof(line->''billingMinutes'') is distinct from ''number'' or jsonb_typeof(line->''unitRateCents'') is distinct from ''number'' or coalesce(line->>''billingMinutes'','''')!~''^[0-9]+$'' or coalesce(line->>''unitRateCents'','''')!~''^[0-9]+$'' or (line->>''billingMinutes'')::bigint>1440 or (line->>''unitRateCents'')::bigint>999999999 then raise exception ''VALIDATION'';end if;
  if ((line->>''billingMinutes'')::bigint*(line->>''unitRateCents'')::bigint+30)/60<>(line->>''chargedCents'')::bigint then raise exception ''INVOICE_TOTAL_CHANGED'';end if;
 end if; '||old);
end $migration$;
-- Actual provider fees are separate from customer payments and business expenses.
do $migration$
declare d text;old text;
begin
 d:=pg_get_functiondef('private.finance_activity(uuid,date,date)'::regprocedure);
 old:='payment_count bigint;';if strpos(d,old)=0 then raise exception 'finance declaration baseline changed';end if;
 d:=replace(d,old,'payment_count bigint; card_fees bigint;');
 old:='return jsonb_build_object(''from'',p_from';if strpos(d,old)=0 then raise exception 'finance return baseline changed';end if;
 d:=replace(d,old,'select coalesce(sum(fee_cents),0) into card_fees from private.card_transactions where organization_id=p_org and kind in (''payment'',''refund'') and timezone(tz,occurred_at)::date between p_from and p_to; '||old);
 old:='''expenseCents'',spent';d:=replace(d,old,'''expenseCents'',spent,''cardFeeCents'',card_fees,''netRecordedReceiptsCents'',receipts-card_fees');
 old:='''cashAfterExpensesCents'',receipts-spent';d:=replace(d,old,'''cashAfterExpensesCents'',receipts-spent-card_fees');
 execute d;
end $migration$;
create function private.invoice_admin_summary(p_org uuid,p_invoices uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not private.staff(p_org,array['owner','admin','bookkeeper']) then return '{}'::jsonb;end if;
 if cardinality(p_invoices)>1000 then raise exception 'VALIDATION';end if;
 return coalesce((select jsonb_object_agg(i.id,jsonb_build_object('dueDate',a.due_date,'archived',coalesce(a.archived,false),'cardPending',exists(select 1 from private.card_orders o where o.organization_id=p_org and o.invoice_id=i.id and o.status in ('prepared','open')))) from public.invoices i left join private.invoice_admin a on a.organization_id=i.organization_id and a.invoice_id=i.id where i.organization_id=p_org and i.id=any(p_invoices)),'{}');
end$$;
create function public.invoice_admin_summary(p_org uuid,p_invoices uuid[]) returns jsonb language sql security invoker set search_path='' as $$select private.invoice_admin_summary(p_org,p_invoices)$$;
revoke all on function private.invoice_admin_summary(uuid,uuid[]),public.invoice_admin_summary(uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function private.invoice_admin_summary(uuid,uuid[]),public.invoice_admin_summary(uuid,uuid[]) to authenticated;
create function private.invoice_mail_admin(p_org uuid,p_invoice uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.role()<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return jsonb_build_object('dueDate',(select due_date from private.invoice_admin where organization_id=p_org and invoice_id=p_invoice));
end$$;
create function public.invoice_mail_admin(p_org uuid,p_invoice uuid) returns jsonb language sql security invoker set search_path='' as $$select private.invoice_mail_admin(p_org,p_invoice)$$;
revoke all on function private.invoice_mail_admin(uuid,uuid),public.invoice_mail_admin(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.invoice_mail_admin(uuid,uuid),public.invoice_mail_admin(uuid,uuid) to service_role;
