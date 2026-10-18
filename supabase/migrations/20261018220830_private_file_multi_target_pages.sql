-- Add multi-record filtering for complete service-request workflows; prior read RPC remains compatible.
create function private.customer_file_pages(p_org uuid,p_customer uuid,p_after_created timestamptz default null,p_after_id uuid default null,p_jobs uuid[] default '{}',p_invoices uuid[] default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;more boolean;last_row jsonb;cursor jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.customers where organization_id=p_org and id=p_customer) then raise exception 'NOT_FOUND' using errcode='42501';end if;
 if (p_after_created is null)<>(p_after_id is null) or not coalesce(isfinite(p_after_created),true) then raise exception 'VALIDATION';end if;
 if p_jobs is null or p_invoices is null or cardinality(p_jobs)>100 or cardinality(p_invoices)>100 or array_position(p_jobs,null) is not null or array_position(p_invoices,null) is not null then raise exception 'VALIDATION';end if;
 if exists(select 1 from unnest(p_jobs) t(id) where not exists(select 1 from public.jobs where organization_id=p_org and customer_id=p_customer and id=t.id)) or exists(select 1 from unnest(p_invoices) t(id) where not exists(select 1 from public.invoices where organization_id=p_org and customer_id=p_customer and id=t.id)) then raise exception 'NOT_FOUND' using errcode='42501';end if;
 with page as (
  select f.*,l.revision,l.kind,l.job_id,l.invoice_id,l.expense_id,l.reason,l.target_label,l.linked_at
  from private.customer_supporting_files f left join lateral(select * from private.customer_file_links where organization_id=f.organization_id and file_id=f.id order by revision desc limit 1) l on true
  where f.organization_id=p_org and f.customer_id=p_customer and f.status='ready'
  and (p_after_created is null or (f.created_at,f.id)<(p_after_created,p_after_id))
  and (cardinality(p_jobs)=0 and cardinality(p_invoices)=0 or l.job_id=any(p_jobs) or l.invoice_id=any(p_invoices))
  order by f.created_at desc,f.id desc limit 51
 ), numbered as (select *,row_number() over(order by created_at desc,id desc) as n from page)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',original_name,'purpose',purpose,'mime',mime,'bytes',bytes,'createdAt',created_at,'link',case when revision is not null then jsonb_build_object('revision',revision,'kind',kind,'target',coalesce(job_id,invoice_id,expense_id,p_customer),'reason',reason,'label',target_label,'linkedAt',linked_at) end) order by created_at desc,id desc) filter(where n<=50),'[]'),count(*)>50 into rows,more from numbered;
 last_row=rows->(jsonb_array_length(rows)-1);
 cursor=case when p_after_id is not null then jsonb_build_object('createdAt',p_after_created,'id',p_after_id) end;
 return jsonb_build_object('organization',p_org,'customer',p_customer,'cursor',cursor,'jobs',to_jsonb(p_jobs),'invoices',to_jsonb(p_invoices),'files',rows,'hasMore',more,'nextCursor',case when more then jsonb_build_object('createdAt',last_row->>'createdAt','id',last_row->>'id') end);
end$$;
create function public.customer_file_pages(p_org uuid,p_customer uuid,p_after_created timestamptz default null,p_after_id uuid default null,p_jobs uuid[] default '{}',p_invoices uuid[] default '{}') returns jsonb language sql stable security invoker set search_path='' as $$select private.customer_file_pages(p_org,p_customer,p_after_created,p_after_id,p_jobs,p_invoices)$$;
revoke all on function private.customer_file_pages(uuid,uuid,timestamptz,uuid,uuid[],uuid[]),public.customer_file_pages(uuid,uuid,timestamptz,uuid,uuid[],uuid[]) from public,anon,service_role;
grant execute on function private.customer_file_pages(uuid,uuid,timestamptz,uuid,uuid[],uuid[]),public.customer_file_pages(uuid,uuid,timestamptz,uuid,uuid[],uuid[]) to authenticated;
