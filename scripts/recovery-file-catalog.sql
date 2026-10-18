-- Run only against an authorized isolated restored database, with workers off.
-- No mutation, object download, credentials or customer contact fields.
-- One statement gives counts and rows from the same database snapshot.
-- The 10001st row deliberately makes over-limit catalogs fail validation.
select jsonb_build_object(
 'format','ynsg-recovery-file-catalog-v1',
 'readyCount',(select count(*) from private.customer_supporting_files where status='ready'),
 'pendingCount',(select count(*) from private.customer_supporting_files where status='pending'),
 'files',coalesce((select jsonb_agg(jsonb_build_object(
  'organization',f.organization_id,'id',f.id,'path',f.object_path,
  'bytes',f.bytes,'mime',f.mime,'sha256',f.sha256
 ) order by f.organization_id,f.id) from (
  select organization_id,id,object_path,bytes,mime,sha256
  from private.customer_supporting_files where status='ready'
  order by organization_id,id limit 10001
 ) f),'[]'::jsonb)
)::text;
