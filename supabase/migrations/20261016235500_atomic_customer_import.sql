-- WEB-06: one-transaction confirmed CRM import of explicitly selected new records.
create table private.customer_import_receipts(
 organization_id uuid not null,actor_id uuid not null,request_key uuid not null,
 customer_id uuid not null,expected_revision integer not null,requested jsonb not null,
 result jsonb not null,created_at timestamptz not null default now(),
 primary key(organization_id,actor_id,request_key)
);
alter table private.customer_import_receipts enable row level security;
revoke all on private.customer_import_receipts from public,anon,authenticated,service_role;
create policy customer_import_no_direct_access on private.customer_import_receipts to authenticated using(false) with check(false);

create function public.apply_customer_import(p_org uuid,p_customer uuid,p_revision integer,p_key uuid,p_contacts jsonb,p_properties jsonb)
returns jsonb language plpgsql security definer set search_path='' as $import$
declare c public.customers%rowtype; receipt private.customer_import_receipts%rowtype;
 item jsonb; created jsonb; n integer; i integer:=0; count_contacts integer;count_properties integer;payload jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_customer is null or p_revision is null or p_revision<1 or p_key is null or jsonb_typeof(p_contacts)<>'array' or jsonb_typeof(p_properties)<>'array'
   or jsonb_array_length(p_contacts)>50 or jsonb_array_length(p_properties)>50
   or jsonb_array_length(p_contacts)+jsonb_array_length(p_properties)=0 then raise exception 'VALIDATION';end if;
 payload:=jsonb_build_object('customer',p_customer,'revision',p_revision,'contacts',p_contacts,'properties',p_properties);
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||auth.uid()::text||p_key::text,0));
 select * into receipt from private.customer_import_receipts where organization_id=p_org and actor_id=auth.uid() and request_key=p_key;
 if found then
  if receipt.requested<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return receipt.result;
 end if;
 select * into c from public.customers where organization_id=p_org and id=p_customer for update;
 if not found then raise exception 'NOT_FOUND' using errcode='42501';end if;
 if c.revision<>p_revision then raise exception 'STALE_REVISION';end if;
 if c.archived_at is not null then raise exception 'CUSTOMER_ARCHIVED';end if;
 if exists(select 1 from (select lower(trim(v->>'name')) name,lower(trim(coalesce(v->>'email',''))) email,regexp_replace(coalesce(v->>'phone',''),'[^0-9]','','g') phone,count(*) n from jsonb_array_elements(p_contacts) as e(v) group by 1,2,3 having count(*)>1) duplicates) then raise exception 'DUPLICATE_CONTACT';end if;
 if exists(select 1 from (select lower(trim(v->>'street')) street,lower(trim(v->>'city')) city,v->>'state' region,coalesce(v->>'postalCode','') postal,count(*) n from jsonb_array_elements(p_properties) as e(v) group by 1,2,3,4 having count(*)>1) duplicates) then raise exception 'DUPLICATE_PROPERTY';end if;
 count_contacts:=(select count(*) from public.contacts where organization_id=p_org and customer_id=p_customer);
 count_properties:=(select count(*) from public.properties where organization_id=p_org and customer_id=p_customer);
 if count_contacts+jsonb_array_length(p_contacts)>100 or count_properties+jsonb_array_length(p_properties)>100 then raise exception 'DETAIL_LIMIT';end if;
 for item in select value from jsonb_array_elements(p_contacts) loop
  if jsonb_typeof(item)<>'object' then raise exception 'VALIDATION';end if;
  if exists(select 1 from public.contacts t where t.organization_id=p_org and t.customer_id=p_customer and
   lower(trim(t.name))=lower(trim(item->>'name')) and coalesce(lower(trim(t.email)),'')=coalesce(lower(trim(item->>'email')),'')
   and regexp_replace(coalesce(t.phone,''),'[^0-9]','','g')=regexp_replace(coalesce(item->>'phone',''),'[^0-9]','','g')) then
   raise exception 'DUPLICATE_CONTACT';
  end if;
  i:=i+1;
  created:=private.manage_customer_record(p_org,jsonb_build_object('action','save_contact','customer',p_customer,'revision',c.revision,'record',null,'recordRevision',null,'reason','Approved customer import','value',item),p_key::text||':contact:'||i::text);
  c.revision:=(created->>'revision')::integer;
 end loop;
 i:=0;
 for item in select value from jsonb_array_elements(p_properties) loop
  if jsonb_typeof(item)<>'object' then raise exception 'VALIDATION';end if;
  if exists(select 1 from public.properties t where t.organization_id=p_org and t.customer_id=p_customer and
   lower(trim(t.street))=lower(trim(item->>'street')) and lower(trim(t.city))=lower(trim(item->>'city'))
   and t.region=item->>'state' and coalesce(t.postal_code,'')=coalesce(item->>'postalCode',''))
    then raise exception 'DUPLICATE_PROPERTY';end if;
  i:=i+1;
  created:=private.manage_customer_record(p_org,jsonb_build_object('action','save_property','customer',p_customer,'revision',c.revision,'record',null,'recordRevision',null,'reason','Approved customer import','value',item),p_key::text||':property:'||i::text);
  c.revision:=(created->>'revision')::integer;
 end loop;
 created:=jsonb_build_object('saved',true,'customer',p_customer,'revision',c.revision,'contactsAdded',jsonb_array_length(p_contacts),'propertiesAdded',jsonb_array_length(p_properties));
 insert into private.customer_import_receipts(organization_id,actor_id,request_key,customer_id,expected_revision,requested,result)
 values(p_org,auth.uid(),p_key,p_customer,p_revision,payload,created);
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
 values(p_org,auth.uid(),'customer.import_approved',p_customer,c.revision,p_key);
 return created;
end$import$;
revoke all on function public.apply_customer_import(uuid,uuid,integer,uuid,jsonb,jsonb) from public,anon,service_role;
grant execute on function public.apply_customer_import(uuid,uuid,integer,uuid,jsonb,jsonb) to authenticated;
