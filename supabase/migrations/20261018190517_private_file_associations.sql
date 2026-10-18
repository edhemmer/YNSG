-- File organization is append-only evidence; commercial records and bytes are unchanged.
create table private.customer_file_links(
 organization_id uuid not null,file_id uuid not null,revision integer not null check(revision between 1 and 100),
 kind text not null check(kind in('customer','job','invoice','expense')),
 job_id uuid,invoice_id uuid,expense_id uuid,
 reason text not null check(length(trim(reason)) between 10 and 300),target_label text not null check(length(target_label) between 1 and 300),
 actor_id uuid not null references auth.users(id),linked_at timestamptz not null default now(),
 primary key(organization_id,file_id,revision),
 foreign key(organization_id,file_id) references private.customer_supporting_files(organization_id,id),
 foreign key(organization_id,job_id) references public.jobs(organization_id,id),
 foreign key(organization_id,invoice_id) references public.invoices(organization_id,id),
 foreign key(organization_id,expense_id) references public.business_expenses(organization_id,id),
 check((kind='customer' and num_nonnulls(job_id,invoice_id,expense_id)=0) or
 (kind='job' and job_id is not null and num_nonnulls(job_id,invoice_id,expense_id)=1) or
 (kind='invoice' and invoice_id is not null and num_nonnulls(job_id,invoice_id,expense_id)=1) or
 (kind='expense' and expense_id is not null and num_nonnulls(job_id,invoice_id,expense_id)=1))
);
create index customer_file_job_links on private.customer_file_links(organization_id,job_id) where job_id is not null;
create index customer_file_invoice_links on private.customer_file_links(organization_id,invoice_id) where invoice_id is not null;
create index customer_file_expense_links on private.customer_file_links(organization_id,expense_id) where expense_id is not null;
create index customer_file_link_actor on private.customer_file_links(actor_id,organization_id);
alter table private.customer_file_links enable row level security;
create policy file_links_deny on private.customer_file_links to anon,authenticated using(false) with check(false);
revoke all on private.customer_file_links from public,anon,authenticated,service_role;
create trigger immutable_record before update or delete on private.customer_file_links for each row execute function private.immutable_record();
create function private.link_customer_file(p_org uuid,p_customer uuid,p_file uuid,p_revision integer,p_kind text,p_target uuid,p_reason text,p_reviewed boolean,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f private.customer_supporting_files;current_revision integer;old private.command_receipts;fingerprint text;result jsonb;label text;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_revision is null or p_revision not between 0 and 99 or p_kind is null or p_kind not in('customer','job','invoice','expense') or p_target is null or p_key is null or p_reviewed is distinct from true or p_reason is null or length(trim(p_reason)) not between 10 and 300 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_customer,p_file,p_revision,p_kind,p_target,trim(p_reason),auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':file-link:'||p_key::text,0));
 select * into old from private.command_receipts where organization_id=p_org and command='LinkCustomerFile' and key=p_key::text;
 if found then if old.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return old.result;end if;
 select * into f from private.customer_supporting_files where organization_id=p_org and customer_id=p_customer and id=p_file and status='ready' for update;
 if not found then raise exception 'NOT_FOUND' using errcode='42501';end if;
 if not exists(select 1 from public.customers where organization_id=p_org and id=p_customer and archived_at is null) then raise exception 'CUSTOMER_ARCHIVED';end if;
 select coalesce(max(revision),0) into current_revision from private.customer_file_links where organization_id=p_org and file_id=p_file;
 if current_revision<>p_revision then raise exception 'STALE_REVISION';end if;
 if p_kind='customer' and p_target<>p_customer or p_kind='job' and not exists(select 1 from public.jobs where organization_id=p_org and customer_id=p_customer and id=p_target) or p_kind='invoice' and not exists(select 1 from public.invoices where organization_id=p_org and customer_id=p_customer and id=p_target) or p_kind='expense' and not exists(select 1 from public.business_expenses where organization_id=p_org and id=p_target) then raise exception 'TARGET_NOT_AVAILABLE' using errcode='42501';end if;
 if p_kind='expense' and not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_kind='expense' and f.purpose<>'receipt' then raise exception 'RECEIPT_REQUIRED';end if;
 if exists(select 1 from private.customer_file_links where organization_id=p_org and file_id=p_file and revision=current_revision and kind=p_kind and coalesce(job_id,invoice_id,expense_id,p_customer)=p_target) then raise exception 'ALREADY_LINKED';end if;
 if p_kind='customer' then select 'Customer record · '||display_name into label from public.customers where organization_id=p_org and id=p_customer;
 elsif p_kind='job' then select 'Job · '||left(v.scope,200) into label from public.jobs j join public.quote_versions v on v.organization_id=j.organization_id and v.quote_id=j.quote_id and v.version=j.approved_version where j.organization_id=p_org and j.id=p_target;
 elsif p_kind='invoice' then select 'Invoice '||(case when number<100001000000 then number::text else (number/1000000)::text||'-'||lpad((number%1000000)::text,greatest(4,length((number%1000000)::text)),'0') end) into label from public.invoices where organization_id=p_org and id=p_target;
 else select 'Expense · '||vendor||' · '||expense_date::text into label from public.business_expenses where organization_id=p_org and id=p_target;end if;
 insert into private.customer_file_links(organization_id,file_id,revision,kind,job_id,invoice_id,expense_id,reason,actor_id,target_label)
 values(p_org,p_file,current_revision+1,p_kind,case when p_kind='job' then p_target end,case when p_kind='invoice' then p_target end,case when p_kind='expense' then p_target end,trim(p_reason),auth.uid(),label);
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'customer.file_linked',p_file,current_revision+1,p_key);
 result:=jsonb_build_object('file',p_file,'revision',current_revision+1,'kind',p_kind,'target',p_target);
 insert into private.command_receipts values(p_org,'LinkCustomerFile',p_key::text,fingerprint,result,now());return result;
end$$;
create function public.link_customer_file(p_org uuid,p_customer uuid,p_file uuid,p_revision integer,p_kind text,p_target uuid,p_reason text,p_reviewed boolean,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select private.link_customer_file(p_org,p_customer,p_file,p_revision,p_kind,p_target,p_reason,p_reviewed,p_key)$$;
create function private.customer_file_workspace(p_org uuid,p_customer uuid,p_file uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare files jsonb;events jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.customers where organization_id=p_org and id=p_customer) then raise exception 'NOT_FOUND' using errcode='42501';end if;
 if p_file is not null then
  if not exists(select 1 from private.customer_supporting_files where organization_id=p_org and customer_id=p_customer and id=p_file and status='ready') then raise exception 'NOT_FOUND' using errcode='42501';end if;
  select coalesce(jsonb_agg(jsonb_build_object('revision',l.revision,'kind',l.kind,'target',coalesce(l.job_id,l.invoice_id,l.expense_id,p_customer),'reason',l.reason,'label',l.target_label,'linkedAt',l.linked_at) order by l.revision desc),'[]') into events from private.customer_file_links l where l.organization_id=p_org and l.file_id=p_file;
  return jsonb_build_object('organization',p_org,'customer',p_customer,'file',p_file,'complete',true,'events',events);
 end if;
 if (select count(*) from (select 1 from private.customer_supporting_files where organization_id=p_org and customer_id=p_customer and status='ready' limit 251) q)>250 then raise exception 'FILE_LIST_TOO_LARGE';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.original_name,'purpose',f.purpose,'mime',f.mime,'bytes',f.bytes,'createdAt',f.created_at,'link',case when l.revision is not null then jsonb_build_object('revision',l.revision,'kind',l.kind,'target',coalesce(l.job_id,l.invoice_id,l.expense_id,p_customer),'reason',l.reason,'label',l.target_label,'linkedAt',l.linked_at) end) order by f.created_at desc,f.id),'[]') into files
 from private.customer_supporting_files f left join lateral(select * from private.customer_file_links where organization_id=f.organization_id and file_id=f.id order by revision desc limit 1) l on true where f.organization_id=p_org and f.customer_id=p_customer and f.status='ready';
 return jsonb_build_object('organization',p_org,'customer',p_customer,'complete',true,'files',files);
end$$;
create function public.customer_file_workspace(p_org uuid,p_customer uuid,p_file uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.customer_file_workspace(p_org,p_customer,p_file)$$;
create function private.customer_file_targets(p_org uuid,p_customer uuid,p_kind text,p_search text default '',p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;more boolean;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.customers where organization_id=p_org and id=p_customer and archived_at is null) then raise exception 'NOT_FOUND' using errcode='42501';end if;
 if p_kind is null or p_kind not in('job','invoice','expense') or p_search is null or length(p_search)>80 or p_page is null or p_page not between 0 and 10000 then raise exception 'VALIDATION';end if;
 if p_kind='expense' and not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 with candidates as (
  select j.id,'Job '||left(j.id::text,8)||' · '||j.status||' · '||left(v.scope,180) as label,j.created_at as created from public.jobs j join public.quote_versions v on v.organization_id=j.organization_id and v.quote_id=j.quote_id and v.version=j.approved_version where p_kind='job' and j.organization_id=p_org and j.customer_id=p_customer
  union all select i.id,'Invoice '||(case when i.number<100001000000 then i.number::text else (i.number/1000000)::text||'-'||lpad((i.number%1000000)::text,greatest(4,length((i.number%1000000)::text)),'0') end)||' · '||(i.issued_at at time zone (select timezone from public.organizations where id=p_org))::date::text,i.issued_at from public.invoices i where p_kind='invoice' and i.organization_id=p_org and i.customer_id=p_customer
  union all select e.id,e.vendor||' · '||e.expense_date::text||' · $'||(e.amount_cents/100)::text||'.'||lpad((e.amount_cents%100)::text,2,'0')||case when exists(select 1 from public.business_expense_reversals r where r.organization_id=e.organization_id and r.expense_id=e.id) then ' (reversed)' else '' end,e.recorded_at from public.business_expenses e where p_kind='expense' and e.organization_id=p_org
 ), page as(select * from candidates where position(lower(trim(p_search)) in lower(label||' '||id::text))>0 order by created desc,id offset p_page*50 limit 51), numbered as(select *,row_number() over(order by created desc,id) n from page)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label) order by n) filter(where n<=50),'[]'),count(*)>50 into rows,more from numbered;
 return jsonb_build_object('organization',p_org,'customer',p_customer,'kind',p_kind,'search',trim(p_search),'page',p_page,'rows',rows,'hasMore',more);
end$$;
create function public.customer_file_targets(p_org uuid,p_customer uuid,p_kind text,p_search text default '',p_page integer default 0) returns jsonb language sql security invoker set search_path='' as $$select private.customer_file_targets(p_org,p_customer,p_kind,p_search,p_page)$$;
revoke all on function private.link_customer_file(uuid,uuid,uuid,integer,text,uuid,text,boolean,uuid),public.link_customer_file(uuid,uuid,uuid,integer,text,uuid,text,boolean,uuid),private.customer_file_workspace(uuid,uuid,uuid),public.customer_file_workspace(uuid,uuid,uuid),private.customer_file_targets(uuid,uuid,text,text,integer),public.customer_file_targets(uuid,uuid,text,text,integer) from public,anon,service_role;
grant execute on function private.link_customer_file(uuid,uuid,uuid,integer,text,uuid,text,boolean,uuid),public.link_customer_file(uuid,uuid,uuid,integer,text,uuid,text,boolean,uuid),private.customer_file_workspace(uuid,uuid,uuid),public.customer_file_workspace(uuid,uuid,uuid),private.customer_file_targets(uuid,uuid,text,text,integer),public.customer_file_targets(uuid,uuid,text,text,integer) to authenticated;
