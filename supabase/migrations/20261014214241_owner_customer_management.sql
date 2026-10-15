-- Owner-managed current records; original submissions and financial snapshots remain immutable.
alter table public.customers add column archived_at timestamptz;
alter table public.contacts add column revision integer not null default 1 check(revision>0);
create index customers_directory on public.customers(organization_id,display_name,id);
create table private.customer_record_changes(
 organization_id uuid not null, id uuid not null default gen_random_uuid(), customer_id uuid not null,
 kind text not null check(kind in('customer','contact','property')), record_id uuid not null,
 actor_id uuid not null references auth.users(id),session_id uuid not null,reason text not null,
 before_value jsonb,after_value jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,id),foreign key(organization_id,customer_id) references public.customers(organization_id,id)
);
create index customer_record_changes_history on private.customer_record_changes(organization_id,customer_id,created_at desc,id);
alter table private.customer_record_changes enable row level security;
create policy customer_record_changes_deny on private.customer_record_changes to anon,authenticated using(false) with check(false);
revoke all on private.customer_record_changes from public,anon,authenticated,service_role;
create trigger customer_record_changes_immutable before update or delete on private.customer_record_changes for each row execute function private.immutable_record();

create function private.owner_customer_records(p_org uuid,p_customer uuid default null,p_query text default '',p_filter text default 'active',p_page integer default 0,p_requests_page integer default 0,p_history_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare record_customer public.customers;items jsonb;contacts jsonb;properties jsonb;requests jsonb;history jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_query is null or length(p_query)>100 or p_filter is null or p_filter not in('active','archived','all') or p_page is null or p_page not between 0 and 10000 or p_requests_page is null or p_requests_page not between 0 and 10000 or p_history_page is null or p_history_page not between 0 and 10000 then raise exception 'VALIDATION';end if;
 if p_customer is null then
  select coalesce(jsonb_agg(x.data order by x.display_name,x.id),'[]'::jsonb) into items from(
   select c.display_name,c.id,jsonb_build_object('id',c.id,'displayName',c.display_name,'revision',c.revision,'archivedAt',c.archived_at,
    'contactCount',(select count(*) from public.contacts t where t.organization_id=p_org and t.customer_id=c.id),
    'addressCount',(select count(*) from public.properties t where t.organization_id=p_org and t.customer_id=c.id)) data
   from public.customers c where c.organization_id=p_org and (p_filter='all' or (p_filter='active' and c.archived_at is null) or (p_filter='archived' and c.archived_at is not null))
   and (trim(p_query)='' or position(lower(trim(p_query)) in lower(c.display_name))>0
    or exists(select 1 from public.contacts t where t.organization_id=p_org and t.customer_id=c.id and position(lower(trim(p_query)) in lower(concat_ws(' ',t.name,t.email,t.phone)))>0)
    or exists(select 1 from public.properties t where t.organization_id=p_org and t.customer_id=c.id and position(lower(trim(p_query)) in lower(concat_ws(' ',t.street,t.city,t.region,t.postal_code)))>0))
   order by c.display_name,c.id offset p_page*20 limit 21
  ) x;
  return jsonb_build_object('items',(select coalesce(jsonb_agg(v),'[]'::jsonb) from jsonb_array_elements(items) with ordinality t(v,n) where n<=20),'hasMore',jsonb_array_length(items)>20,'page',p_page);
 end if;
 select * into record_customer from public.customers where organization_id=p_org and id=p_customer;
 if not found then raise exception 'NOT_FOUND';end if;
 if (select count(*) from public.contacts where organization_id=p_org and customer_id=p_customer)>100 or (select count(*) from public.properties where organization_id=p_org and customer_id=p_customer)>100 then raise exception 'DETAIL_LIMIT';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'revision',t.revision,'name',t.name,'email',t.email,'phone',t.phone,'relationship',t.relationship) order by t.name,t.id),'[]'::jsonb) into contacts from public.contacts t where t.organization_id=p_org and t.customer_id=p_customer;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'revision',t.revision,'street',t.street,'city',t.city,'state',t.region,'postalCode',t.postal_code) order by t.created_at,t.id),'[]'::jsonb) into properties from public.properties t where t.organization_id=p_org and t.customer_id=p_customer;
 select coalesce(jsonb_agg(x.data order by x.created_at desc,x.id),'[]'::jsonb) into requests from(
  select r.id,r.created_at,jsonb_build_object('id',r.id,'status',r.status,'createdAt',r.created_at,'summary',coalesce(nullif(r.original_submission->>'service',''),r.original_submission->'services'->0->>'service','Service request'),'address',concat_ws(', ',r.original_submission->>'street',r.original_submission->>'city')) data
  from public.service_requests r where r.organization_id=p_org and r.customer_id=p_customer order by r.created_at desc,r.id offset p_requests_page*20 limit 21
 ) x;
 select coalesce(jsonb_agg(x.data order by x.created_at desc,x.id),'[]'::jsonb) into history from(
  select h.id,h.created_at,jsonb_build_object('id',h.id,'kind',h.kind,'at',h.created_at,'reason',h.reason,'before',h.before_value,'after',h.after_value) data
  from private.customer_record_changes h where h.organization_id=p_org and h.customer_id=p_customer order by h.created_at desc,h.id offset p_history_page*20 limit 21
 ) x;
 return jsonb_build_object('customer',jsonb_build_object('id',record_customer.id,'displayName',record_customer.display_name,'revision',record_customer.revision,'archivedAt',record_customer.archived_at),'contacts',contacts,'properties',properties,
  'requests',(select coalesce(jsonb_agg(v),'[]'::jsonb) from jsonb_array_elements(requests) with ordinality t(v,n) where n<=20),'requestsMore',jsonb_array_length(requests)>20,
  'history',(select coalesce(jsonb_agg(v),'[]'::jsonb) from jsonb_array_elements(history) with ordinality t(v,n) where n<=20),'historyMore',jsonb_array_length(history)>20);
end$$;
create function public.owner_customer_records(p_org uuid,p_customer uuid default null,p_query text default '',p_filter text default 'active',p_page integer default 0,p_requests_page integer default 0,p_history_page integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$select private.owner_customer_records(p_org,p_customer,p_query,p_filter,p_page,p_requests_page,p_history_page)$$;

create function private.manage_customer_record(p_org uuid,p_input jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare action text:=p_input->>'action';v jsonb:=p_input->'value';c public.customers;t public.contacts;p public.properties;prior private.command_receipts;
 fingerprint text;result jsonb;before_value jsonb;after_value jsonb;record_id uuid;record_revision integer;kind text;reason text:=trim(coalesce(p_input->>'reason',''));allowed text[];moment timestamptz:=clock_timestamp();
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 -- Serialize membership revocation and entitlement changes with a permitted save.
 perform 1 from public.memberships where organization_id=p_org and user_id=auth.uid() and revoked_at is null and role in('owner','admin') for share;
 if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform 1 from public.entitlements where organization_id=p_org and module='crm' and enabled for share;
 if not found then raise exception 'SETUP_REQUIRED';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or length(p_input::text)>8000 or action is null or action not in('create_customer','update_customer','save_contact','save_property','set_archived') or length(reason)>500 or reason~'[[:cntrl:]<>]' or p_key is null or p_key!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'VALIDATION';end if;
 allowed:=case action when 'create_customer' then array['action','value','reason'] when 'update_customer' then array['action','customer','revision','value','reason'] when 'set_archived' then array['action','customer','revision','archived','reason'] else array['action','customer','revision','record','recordRevision','value','reason'] end;
 if exists(select 1 from jsonb_object_keys(p_input) k where not k=any(allowed)) or not p_input ?& allowed then raise exception 'VALIDATION';end if;
 p_key:=lower(p_key);fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_input,auth.uid(),auth.jwt()->>'session_id')::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':customer-record:'||p_key,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='ManageCustomerRecord' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if action<>'create_customer' then
  if jsonb_typeof(p_input->'revision') is distinct from 'number' or ((p_input->>'revision')::numeric<>trunc((p_input->>'revision')::numeric) or (p_input->>'revision')::numeric not between 1 and 2147483647) then raise exception 'VALIDATION';end if;
  select * into c from public.customers where organization_id=p_org and id=(p_input->>'customer')::uuid for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if c.revision<>(p_input->>'revision')::integer then raise exception 'STALE_REVISION';end if;
  if c.archived_at is not null and action<>'set_archived' then raise exception 'CUSTOMER_ARCHIVED';end if;
 end if;
 if action in('create_customer','update_customer') then
  if jsonb_typeof(v) is distinct from 'object' or not v?'displayName' or exists(select 1 from jsonb_object_keys(v) k where k<>'displayName') or jsonb_typeof(v->'displayName') is distinct from 'string' or length(trim(v->>'displayName')) not between 2 and 160 or (v->>'displayName')~'[[:cntrl:]<>]' then raise exception 'VALIDATION';end if;
  kind:='customer';before_value:=case when action='update_customer' then to_jsonb(c)-'organization_id'-'created_at' end;
  if action='create_customer' then insert into public.customers(organization_id,display_name) values(p_org,trim(v->>'displayName')) returning * into c;
  else update public.customers set display_name=trim(v->>'displayName'),revision=revision+1 where organization_id=p_org and id=c.id returning * into c;end if;
  record_id:=c.id;record_revision:=c.revision;after_value:=to_jsonb(c)-'organization_id'-'created_at';
 elsif action='set_archived' then
  if jsonb_typeof(p_input->'archived') is distinct from 'boolean' then raise exception 'VALIDATION';end if;
  if (p_input->>'archived')::boolean and (
   exists(select 1 from public.service_requests r where r.organization_id=p_org and r.customer_id=c.id and r.status in('submitted','reviewing'))
   or exists(select 1 from public.quotes q where q.organization_id=p_org and q.customer_id=c.id and q.status='sent')
   or exists(select 1 from public.jobs j where j.organization_id=p_org and j.customer_id=c.id and j.status not in('completed','canceled'))
   or exists(select 1 from public.appointments a join public.service_requests r on r.organization_id=a.organization_id and r.id=a.request_id where r.organization_id=p_org and r.customer_id=c.id and a.status in('held','proposal','needs_review','reserved') and a.end_at>moment)
   or exists(select 1 from public.invoices i where i.organization_id=p_org and i.customer_id=c.id and i.total_cents>(select coalesce(sum(m.cents),0) from public.payments m where m.organization_id=p_org and m.invoice_id=i.id))
  ) then raise exception 'CUSTOMER_HAS_OPEN_WORK';end if;
  kind:='customer';before_value:=to_jsonb(c)-'organization_id'-'created_at';
  update public.customers set archived_at=case when (p_input->>'archived')::boolean then coalesce(archived_at,moment) end,revision=revision+1 where organization_id=p_org and id=c.id returning * into c;
  record_id:=c.id;record_revision:=c.revision;after_value:=to_jsonb(c)-'organization_id'-'created_at';
 else
  if jsonb_typeof(v) is distinct from 'object' or (jsonb_typeof(p_input->'record')='null') is distinct from (jsonb_typeof(p_input->'recordRevision')='null') or (jsonb_typeof(p_input->'record') not in('null','string')) or (jsonb_typeof(p_input->'recordRevision') not in('null','number')) then raise exception 'VALIDATION';end if;
  if jsonb_typeof(p_input->'recordRevision')='number' and ((p_input->>'recordRevision')::numeric<>trunc((p_input->>'recordRevision')::numeric) or (p_input->>'recordRevision')::numeric not between 1 and 2147483647) then raise exception 'VALIDATION';end if;
  record_id:=(p_input->>'record')::uuid;
  if action='save_contact' then
   if not v ?& array['name','email','phone','relationship'] or exists(select 1 from jsonb_object_keys(v) k where k not in('name','email','phone','relationship')) or exists(select 1 from jsonb_each(v) x where jsonb_typeof(x.value)<>'string')
    or length(trim(v->>'name')) not between 2 and 160 or length(trim(v->>'relationship')) not between 2 and 80 or length(v->>'email')>254 or ((v->>'email')<>'' and (v->>'email')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or ((v->>'phone')<>'' and ((v->>'phone')!~*'^[+0-9() .x#-]{7,35}$' or length(regexp_replace(v->>'phone','[^0-9]','','g'))<7)) or ((v->>'email')='' and (v->>'phone')='') or concat(v->>'name',v->>'relationship',v->>'email',v->>'phone')~'[[:cntrl:]<>]' then raise exception 'VALIDATION';end if;
   kind:='contact';
   if record_id is not null then
    select * into t from public.contacts where organization_id=p_org and customer_id=c.id and id=record_id for update;if not found then raise exception 'NOT_FOUND';end if;
    if t.revision<>(p_input->>'recordRevision')::integer then raise exception 'STALE_REVISION';end if;
    before_value:=to_jsonb(t)-'organization_id'-'customer_id';
    update public.contacts set name=trim(v->>'name'),email=nullif(v->>'email',''),phone=nullif(v->>'phone',''),relationship=trim(v->>'relationship'),revision=revision+1 where organization_id=p_org and id=t.id returning * into t;
   else
    if (select count(*) from public.contacts where organization_id=p_org and customer_id=c.id)>=100 then raise exception 'DETAIL_LIMIT';end if;
    insert into public.contacts(organization_id,customer_id,name,email,phone,relationship) values(p_org,c.id,trim(v->>'name'),nullif(v->>'email',''),nullif(v->>'phone',''),trim(v->>'relationship')) returning * into t;
   end if;
   record_id:=t.id;record_revision:=t.revision;after_value:=to_jsonb(t)-'organization_id'-'customer_id';
  else
   if not v ?& array['street','city','state','postalCode'] or exists(select 1 from jsonb_object_keys(v) k where k not in('street','city','state','postalCode')) or exists(select 1 from jsonb_each(v) x where jsonb_typeof(x.value)<>'string')
    or length(trim(v->>'street')) not between 5 and 200 or length(trim(v->>'city')) not between 2 and 80 or (v->>'state') not in('AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY') or ((v->>'postalCode')<>'' and (v->>'postalCode')!~'^[0-9]{5}(-[0-9]{4})?$') or concat(v->>'street',v->>'city')~'[[:cntrl:]<>]' then raise exception 'VALIDATION';end if;
   kind:='property';
   if record_id is not null then
    select * into p from public.properties where organization_id=p_org and customer_id=c.id and id=record_id for update;if not found then raise exception 'NOT_FOUND';end if;
    if p.revision<>(p_input->>'recordRevision')::integer then raise exception 'STALE_REVISION';end if;
    if exists(select 1 from public.service_requests r where r.organization_id=p_org and r.property_id=p.id and (
     exists(select 1 from public.appointments a where a.organization_id=p_org and a.request_id=r.id and a.status in('held','proposal','needs_review','reserved') and a.end_at>moment)
     or exists(select 1 from public.jobs j join public.quotes q on q.organization_id=j.organization_id and q.id=j.quote_id where q.organization_id=p_org and q.request_id=r.id and j.status not in('completed','canceled'))
    )) then raise exception 'ADDRESS_HAS_OPEN_WORK';end if;
    before_value:=to_jsonb(p)-'organization_id'-'customer_id'-'created_at';
    update public.properties set street=trim(v->>'street'),city=trim(v->>'city'),region=v->>'state',postal_code=nullif(v->>'postalCode',''),revision=revision+1 where organization_id=p_org and id=p.id returning * into p;
   else
    if (select count(*) from public.properties where organization_id=p_org and customer_id=c.id)>=100 then raise exception 'DETAIL_LIMIT';end if;
    insert into public.properties(organization_id,customer_id,street,city,region,postal_code) values(p_org,c.id,trim(v->>'street'),trim(v->>'city'),v->>'state',nullif(v->>'postalCode','')) returning * into p;
   end if;
   record_id:=p.id;record_revision:=p.revision;after_value:=to_jsonb(p)-'organization_id'-'customer_id'-'created_at';
  end if;
  update public.customers set revision=revision+1 where organization_id=p_org and id=c.id returning * into c;
 end if;
 insert into private.customer_record_changes(organization_id,customer_id,kind,record_id,actor_id,session_id,reason,before_value,after_value)
 values(p_org,c.id,kind,record_id,auth.uid(),(auth.jwt()->>'session_id')::uuid,reason,before_value,after_value);
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'customer_record.'||action,c.id,c.revision,gen_random_uuid());
 result:=jsonb_build_object('saved',true,'customerId',c.id,'revision',c.revision,'recordId',record_id,'recordRevision',record_revision);
 insert into private.command_receipts values(p_org,'ManageCustomerRecord',p_key,fingerprint,result,moment);return result;
end$$;
create function public.manage_customer_record(p_org uuid,p_input jsonb,p_key text) returns jsonb
language sql security invoker set search_path='' as $$select private.manage_customer_record(p_org,p_input,p_key)$$;
revoke all on function private.owner_customer_records(uuid,uuid,text,text,integer,integer,integer),public.owner_customer_records(uuid,uuid,text,text,integer,integer,integer),private.manage_customer_record(uuid,jsonb,text),public.manage_customer_record(uuid,jsonb,text) from public,anon,service_role;
grant execute on function private.owner_customer_records(uuid,uuid,text,text,integer,integer,integer),public.owner_customer_records(uuid,uuid,text,text,integer,integer,integer),private.manage_customer_record(uuid,jsonb,text),public.manage_customer_record(uuid,jsonb,text) to authenticated;
