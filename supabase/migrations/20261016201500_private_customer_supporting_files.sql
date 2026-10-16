-- Private, tenant-scoped customer supporting photos/receipts.
-- Object bytes live in a private storage bucket; metadata is never public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ynsg-customer-files','ynsg-customer-files',false,8388608,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do nothing;
create table private.customer_supporting_files(
 organization_id uuid not null, id uuid not null default gen_random_uuid(),
 customer_id uuid not null, actor_id uuid not null references auth.users(id),
 request_key uuid not null, purpose text not null check(purpose in('job_photo','receipt','customer_document')),
 original_name text not null check(length(original_name) between 1 and 180),
 mime text not null check(mime in('image/jpeg','image/png','application/pdf')),
 bytes integer not null check(bytes between 1 and 8388608),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 object_path text not null unique,
 status text not null default 'pending' check(status in('pending','ready')),
 created_at timestamptz not null default now(), ready_at timestamptz,
 primary key(organization_id,id),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 unique(organization_id,actor_id,request_key)
);
create index customer_file_listing on private.customer_supporting_files(organization_id,customer_id,created_at desc,id);
create index customer_file_actor on private.customer_supporting_files(actor_id,organization_id);
alter table private.customer_supporting_files enable row level security;
revoke all on private.customer_supporting_files from public,anon,authenticated,service_role;
create policy private_customer_files_deny on private.customer_supporting_files to anon,authenticated using(false) with check(false);
create function public.reserve_customer_file(p_org uuid,p_customer uuid,p_key uuid,p_purpose text,p_name text,p_mime text,p_bytes integer,p_sha text)
returns jsonb language plpgsql security definer set search_path='' as $reserve$
declare f private.customer_supporting_files; fid uuid;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.customers where organization_id=p_org and id=p_customer and archived_at is null) then raise exception 'NOT_FOUND' using errcode='42501';end if;
 if p_key is null or p_purpose not in('job_photo','receipt','customer_document') or p_mime not in('image/jpeg','image/png','application/pdf') or p_bytes is null or p_bytes not between 1 and 8388608 or p_sha !~ '^[a-f0-9]{64}$' or p_name is null or length(p_name) not between 1 and 180 then raise exception 'VALIDATION';end if;
 select * into f from private.customer_supporting_files where organization_id=p_org and actor_id=auth.uid() and request_key=p_key for update;
 if found then
  if f.customer_id<>p_customer or f.purpose<>p_purpose or f.original_name<>p_name or f.mime<>p_mime or f.bytes<>p_bytes or f.sha256<>p_sha then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 else
  fid:=gen_random_uuid();
  insert into private.customer_supporting_files(organization_id,id,customer_id,actor_id,request_key,purpose,original_name,mime,bytes,sha256,object_path)
  values(p_org,fid,p_customer,auth.uid(),p_key,p_purpose,p_name,p_mime,p_bytes,p_sha,p_org::text||'/'||fid::text)
  returning * into f;
 end if;
 return jsonb_build_object('id',f.id,'path',f.object_path,'ready',f.status='ready');
end$reserve$;
create function public.finalize_customer_file(p_org uuid,p_file uuid) returns jsonb
language plpgsql security definer set search_path='' as $finalize$
declare f private.customer_supporting_files;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into f from private.customer_supporting_files where organization_id=p_org and id=p_file and actor_id=auth.uid() for update;
 if not found then raise exception 'NOT_FOUND' using errcode='42501';end if;
 if not exists(select 1 from storage.objects where bucket_id='ynsg-customer-files' and name=f.object_path) then raise exception 'UPLOAD_UNCONFIRMED';end if;
 if f.status='pending' then
  update private.customer_supporting_files set status='ready',ready_at=now() where organization_id=p_org and id=p_file;
  insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
  values(p_org,auth.uid(),'customer.file_uploaded',p_file,1,gen_random_uuid());
 end if;
 return jsonb_build_object('id',p_file,'ready',true);
end$finalize$;
create function public.list_customer_files(p_org uuid,p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $list$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.customers where organization_id=p_org and id=p_customer) then raise exception 'NOT_FOUND' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',original_name,'purpose',purpose,'mime',mime,'bytes',bytes,'createdAt',created_at) order by created_at desc,id)
 from private.customer_supporting_files where organization_id=p_org and customer_id=p_customer and status='ready'),'[]'::jsonb);
end$list$;
create function public.authorize_customer_file(p_org uuid,p_file uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $read$
declare f private.customer_supporting_files;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into f from private.customer_supporting_files where organization_id=p_org and id=p_file and status='ready';
 if not found then raise exception 'NOT_FOUND' using errcode='42501';end if;
 return jsonb_build_object('path',f.object_path,'name',f.original_name,'mime',f.mime);
end$read$;
revoke all on function public.reserve_customer_file(uuid,uuid,uuid,text,text,text,integer,text),public.finalize_customer_file(uuid,uuid),public.list_customer_files(uuid,uuid),public.authorize_customer_file(uuid,uuid) from public,anon,service_role;
grant execute on function public.reserve_customer_file(uuid,uuid,uuid,text,text,text,integer,text),public.finalize_customer_file(uuid,uuid),public.list_customer_files(uuid,uuid),public.authorize_customer_file(uuid,uuid) to authenticated;
create function private.customer_file_object_permission(p_path text,p_mode text) returns boolean
language sql stable security definer set search_path='' as $permission$
 select exists(select 1 from private.customer_supporting_files f
 where f.object_path=p_path
 and ((p_mode='insert' and f.status='pending' and f.actor_id=auth.uid())
      or (p_mode='select' and f.status='ready'))
 and private.staff(f.organization_id,array['owner','admin']))
$permission$;
revoke all on function private.customer_file_object_permission(text,text) from public,anon,service_role;
grant execute on function private.customer_file_object_permission(text,text) to authenticated;
create policy ynsg_customer_file_upload on storage.objects for insert to authenticated with check(
 bucket_id='ynsg-customer-files' and private.customer_file_object_permission(name,'insert')
);
create policy ynsg_customer_file_read on storage.objects for select to authenticated using(
 bucket_id='ynsg-customer-files' and private.customer_file_object_permission(name,'select')
);
