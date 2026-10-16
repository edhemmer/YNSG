-- Reconcile an interrupted private upload only after rereading exact saved bytes.
create or replace function private.customer_file_object_permission(p_path text,p_mode text) returns boolean
language sql stable security definer set search_path='' as $permission$
 select exists(select 1 from private.customer_supporting_files f
 where f.object_path=p_path
 and ((p_mode='insert' and f.status='pending' and f.actor_id=auth.uid())
   or (p_mode='verify' and f.status='pending' and f.actor_id=auth.uid())
   or (p_mode='select' and f.status='ready'))
 and private.staff(f.organization_id,array['owner','admin']))
$permission$;
create policy ynsg_customer_file_verify_pending on storage.objects
for select to authenticated using(
 bucket_id='ynsg-customer-files' and private.customer_file_object_permission(name,'verify')
);
