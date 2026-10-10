-- Protect the licensed identity at the write boundary, including direct RPC calls.
-- Owner name, sender/contact details, cities and service catalog remain editable.
create function private.guard_licensed_brand() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous jsonb; registered_name text; field text; expected text;
begin
 select settings into previous from public.configuration_versions
 where organization_id=new.organization_id order by version desc limit 1;
 select display_name into registered_name from public.organizations where id=new.organization_id;
 if previous->>'displayName'='Your Neighborhood Service Guy' or registered_name='Your Neighborhood Service Guy' then
  if new.settings->>'displayName' is distinct from 'Your Neighborhood Service Guy' then raise exception 'LICENSED_BRAND_PROTECTED';end if;
  foreach field in array array['navy','forest','gold','cream'] loop
   expected:=coalesce(previous->'brand'->>field,case field when 'navy' then '#10283c' when 'forest' then '#315842' when 'gold' then '#edbd6b' when 'cream' then '#f8f6ef' end);
   if new.settings->'brand'->>field is distinct from expected then raise exception 'LICENSED_BRAND_PROTECTED';end if;
  end loop;
  expected:=coalesce(previous->'brand'->>'logoUrl','https://www.yourneighborhoodserviceguy.com/assets/logo.jpg');
  if new.settings->'brand'->>'logoUrl' is distinct from expected then raise exception 'LICENSED_BRAND_PROTECTED';end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_licensed_brand() from public,anon,authenticated,service_role;
create trigger configuration_licensed_brand before insert on public.configuration_versions
for each row execute function private.guard_licensed_brand();
