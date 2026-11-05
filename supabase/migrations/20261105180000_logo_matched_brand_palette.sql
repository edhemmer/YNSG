-- Match the licensed YNSG brand palette to the approved logo artwork.
-- Logo navy #042440, logo green #416833, logo sun #f3ac39; cream ground unchanged.
-- The guard still locks the licensed palette; it now allows exactly one move:
-- from the original palette (or an unset field) to the logo-matched palette.
create or replace function private.guard_licensed_brand() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous jsonb; registered_name text; field text; expected text; prior text;
begin
 select settings into previous from public.configuration_versions
 where organization_id=new.organization_id order by version desc limit 1;
 select display_name into registered_name from public.organizations where id=new.organization_id;
 if previous->>'displayName'='Your Neighborhood Service Guy' or registered_name='Your Neighborhood Service Guy' then
  if new.settings->>'displayName' is distinct from 'Your Neighborhood Service Guy' then raise exception 'LICENSED_BRAND_PROTECTED';end if;
  foreach field in array array['navy','forest','gold','cream'] loop
   prior:=previous->'brand'->>field;
   expected:=case
    when prior is null
      or (field='navy' and lower(prior)='#10283c')
      or (field='forest' and lower(prior)='#315842')
      or (field='gold' and lower(prior)='#edbd6b')
    then case field when 'navy' then '#042440' when 'forest' then '#416833' when 'gold' then '#f3ac39' when 'cream' then coalesce(prior,'#f8f6ef') end
    else prior end;
   if lower(new.settings->'brand'->>field) is distinct from lower(expected) then raise exception 'LICENSED_BRAND_PROTECTED';end if;
  end loop;
  expected:=coalesce(previous->'brand'->>'logoUrl','https://www.yourneighborhoodserviceguy.com/assets/logo.jpg');
  if new.settings->'brand'->>'logoUrl' is distinct from expected then raise exception 'LICENSED_BRAND_PROTECTED';end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_licensed_brand() from public,anon,authenticated,service_role;

-- Publish one new configuration version per licensed organization with the logo palette.
insert into public.configuration_versions(organization_id,version,schema_version,settings,published_by)
select c.organization_id, c.version+1, c.schema_version,
 jsonb_set(c.settings,'{brand}',coalesce(c.settings->'brand','{}'::jsonb)||jsonb_build_object(
  'navy','#042440','forest','#416833','gold','#f3ac39','cream',coalesce(c.settings->'brand'->>'cream','#f8f6ef'),
  'logoUrl',coalesce(c.settings->'brand'->>'logoUrl','https://www.yourneighborhoodserviceguy.com/assets/logo.jpg'))),
 null
from (
 select distinct on (v.organization_id) v.* from public.configuration_versions v
 order by v.organization_id, v.version desc
) c
join public.organizations o on o.id=c.organization_id
where (c.settings->>'displayName'='Your Neighborhood Service Guy' or o.display_name='Your Neighborhood Service Guy')
 and (coalesce(lower(c.settings->'brand'->>'navy'),'#10283c')='#10283c'
   or coalesce(lower(c.settings->'brand'->>'forest'),'#315842')='#315842'
   or coalesce(lower(c.settings->'brand'->>'gold'),'#edbd6b')='#edbd6b');
