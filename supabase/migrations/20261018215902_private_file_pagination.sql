-- Additive read API: retain the old bounded workspace for older deployments.
create index customer_supporting_files_page on private.customer_supporting_files(organization_id,customer_id,created_at desc,id desc) where status='ready';
create function private.customer_file_page(p_org uuid,p_customer uuid,p_after_created timestamptz default null,p_after_id uuid default null,p_job uuid default null,p_invoice uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;more boolean;last_row jsonb;cursor jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.customers where organization_id=p_org and id=p_customer) then raise exception 'NOT_FOUND' using errcode='42501';end if;
 if (p_after_created is null)<>(p_after_id is null) or not coalesce(isfinite(p_after_created),true) then raise exception 'VALIDATION';end if;
 if p_job is not null and not exists(select 1 from public.jobs where organization_id=p_org and customer_id=p_customer and id=p_job) or p_invoice is not null and not exists(select 1 from public.invoices where organization_id=p_org and customer_id=p_customer and id=p_invoice) then raise exception 'NOT_FOUND' using errcode='42501';end if;
 with page as (
  select f.*,l.revision,l.kind,l.job_id,l.invoice_id,l.expense_id,l.reason,l.target_label,l.linked_at
  from private.customer_supporting_files f left join lateral(select * from private.customer_file_links where organization_id=f.organization_id and file_id=f.id order by revision desc limit 1) l on true
  where f.organization_id=p_org and f.customer_id=p_customer and f.status='ready'
  and (p_after_created is null or (f.created_at,f.id)<(p_after_created,p_after_id))
  and (p_job is null and p_invoice is null or l.job_id=p_job or l.invoice_id=p_invoice)
  order by f.created_at desc,f.id desc limit 51
 ), numbered as (select *,row_number() over(order by created_at desc,id desc) as n from page)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',original_name,'purpose',purpose,'mime',mime,'bytes',bytes,'createdAt',created_at,'link',case when revision is not null then jsonb_build_object('revision',revision,'kind',kind,'target',coalesce(job_id,invoice_id,expense_id,p_customer),'reason',reason,'label',target_label,'linkedAt',linked_at) end) order by created_at desc,id desc) filter(where n<=50),'[]'),count(*)>50 into rows,more from numbered;
 last_row=rows->(jsonb_array_length(rows)-1);
 cursor=case when p_after_id is not null then jsonb_build_object('createdAt',p_after_created,'id',p_after_id) end;
 return jsonb_build_object('organization',p_org,'customer',p_customer,'cursor',cursor,'job',p_job,'invoice',p_invoice,'files',rows,'hasMore',more,'nextCursor',case when more then jsonb_build_object('createdAt',last_row->>'createdAt','id',last_row->>'id') end);
end$$;
create function public.customer_file_page(p_org uuid,p_customer uuid,p_after_created timestamptz default null,p_after_id uuid default null,p_job uuid default null,p_invoice uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.customer_file_page(p_org,p_customer,p_after_created,p_after_id,p_job,p_invoice)$$;
revoke all on function private.customer_file_page(uuid,uuid,timestamptz,uuid,uuid,uuid),public.customer_file_page(uuid,uuid,timestamptz,uuid,uuid,uuid) from public,anon,service_role;
grant execute on function private.customer_file_page(uuid,uuid,timestamptz,uuid,uuid,uuid),public.customer_file_page(uuid,uuid,timestamptz,uuid,uuid,uuid) to authenticated;
