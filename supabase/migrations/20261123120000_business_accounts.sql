-- Business accounts: landlords, property managers, offices, churches and other organizations are a
-- customer type inside YNSG, not a separate company. Each customer can carry one business profile with
-- billing details, default payment terms, an approval limit (work above it needs written approval
-- first) and where the account sits in the business pipeline. Only the owner/admin command below
-- writes; browser roles cannot read or write the table directly. Every save is revision-checked,
-- replay-safe, and recorded in the customer's immutable change history.
create table public.customer_business_profiles (
 organization_id uuid not null,
 customer_id uuid not null,
 account_type text not null check(account_type in ('landlord','property_manager','office','church_nonprofit','builder','farm','other_business')),
 company_name text check(company_name is null or length(company_name) between 2 and 160),
 billing_name text check(billing_name is null or length(billing_name) between 2 and 160),
 billing_email text check(billing_email is null or (length(billing_email) between 5 and 254 and billing_email ~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$')),
 payment_terms_days integer not null default 0 check(payment_terms_days in (0,15,30)),
 approval_limit_cents integer check(approval_limit_cents is null or approval_limit_cents between 0 and 10000000),
 stage text not null default 'prospect' check(stage in ('prospect','contacted','walkthrough','estimate','won','repeat','not_now','lost')),
 next_action text check(next_action is null or length(next_action) between 2 and 200),
 follow_up_on date,
 lost_reason text check(lost_reason is null or lost_reason in ('price','timing','has_vendor','no_need','other')),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((stage='lost')=(lost_reason is not null)),
 primary key(organization_id,customer_id),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id)
);
create index customer_business_profiles_pipeline on public.customer_business_profiles(organization_id,stage,follow_up_on);
alter table public.customer_business_profiles enable row level security;
revoke all on public.customer_business_profiles from public,anon,authenticated;

create function private.save_business_account(p_org uuid,p_input jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.customers;b public.customer_business_profiles;prior private.command_receipts;v jsonb:=p_input->'value';
 fingerprint text;result jsonb;before_value jsonb;after_value jsonb;reason text:=trim(coalesce(p_input->>'reason',''));moment timestamptz:=clock_timestamp();
 txt text;limit_cents integer;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform 1 from public.memberships where organization_id=p_org and user_id=auth.uid() and revoked_at is null and role in('owner','admin') for share;
 if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform 1 from public.entitlements where organization_id=p_org and module='crm' and enabled for share;
 if not found then raise exception 'SETUP_REQUIRED';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or length(p_input::text)>6000 or length(reason)>500 or reason~'[[:cntrl:]<>]'
  or p_key is null or p_key!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or exists(select 1 from jsonb_object_keys(p_input) k where k not in('customer','revision','value','reason')) or not p_input ?& array['customer','revision','value','reason']
  or jsonb_typeof(p_input->'customer')<>'string' or (p_input->>'customer')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or jsonb_typeof(p_input->'revision') not in('null','number') then raise exception 'VALIDATION';end if;
 if jsonb_typeof(p_input->'revision')='number' and ((p_input->>'revision')::numeric<>trunc((p_input->>'revision')::numeric) or (p_input->>'revision')::numeric not between 1 and 2147483647) then raise exception 'VALIDATION';end if;
 -- Value shape: every key present, strings or null where optional.
 if jsonb_typeof(v) is distinct from 'object' or not v ?& array['accountType','companyName','billingName','billingEmail','paymentTermsDays','approvalLimitCents','stage','nextAction','followUpOn','lostReason']
  or exists(select 1 from jsonb_object_keys(v) k where k not in('accountType','companyName','billingName','billingEmail','paymentTermsDays','approvalLimitCents','stage','nextAction','followUpOn','lostReason'))
  or jsonb_typeof(v->'accountType')<>'string' or (v->>'accountType') not in('landlord','property_manager','office','church_nonprofit','builder','farm','other_business')
  or jsonb_typeof(v->'stage')<>'string' or (v->>'stage') not in('prospect','contacted','walkthrough','estimate','won','repeat','not_now','lost')
  or jsonb_typeof(v->'paymentTermsDays')<>'number' or (v->>'paymentTermsDays') not in('0','15','30')
  or jsonb_typeof(v->'approvalLimitCents') not in('null','number')
  or exists(select 1 from unnest(array['companyName','billingName','billingEmail','nextAction','followUpOn','lostReason']) k where jsonb_typeof(v->k) not in('null','string')) then raise exception 'VALIDATION';end if;
 foreach txt in array array[v->>'companyName',v->>'billingName',v->>'nextAction'] loop
  if txt is not null and (length(trim(txt)) not between 2 and 200 or txt~'[[:cntrl:]<>]') then raise exception 'VALIDATION';end if;
 end loop;
 if length(trim(coalesce(v->>'companyName','')))>160 or length(trim(coalesce(v->>'billingName','')))>160 then raise exception 'VALIDATION';end if;
 if v->>'billingEmail' is not null and (length(v->>'billingEmail') not between 5 and 254 or lower(v->>'billingEmail')!~'^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$') then raise exception 'VALIDATION';end if;
 if v->>'followUpOn' is not null and (v->>'followUpOn')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'VALIDATION';end if;
 if v->>'followUpOn' is not null then begin perform (v->>'followUpOn')::date; exception when others then raise exception 'VALIDATION';end;end if;
 if jsonb_typeof(v->'approvalLimitCents')='number' then
  if (v->>'approvalLimitCents')::numeric<>trunc((v->>'approvalLimitCents')::numeric) or (v->>'approvalLimitCents')::numeric not between 0 and 10000000 then raise exception 'VALIDATION';end if;
  limit_cents:=(v->>'approvalLimitCents')::integer;
 end if;
 if ((v->>'stage')='lost') is distinct from (v->>'lostReason' is not null) or (v->>'lostReason' is not null and (v->>'lostReason') not in('price','timing','has_vendor','no_need','other')) then raise exception 'VALIDATION';end if;
 p_key:=lower(p_key);fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_input,auth.uid(),auth.jwt()->>'session_id')::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':business-account:'||p_key,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='SaveBusinessAccount' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into c from public.customers where organization_id=p_org and id=(p_input->>'customer')::uuid for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if c.archived_at is not null then raise exception 'CUSTOMER_ARCHIVED';end if;
 select * into b from public.customer_business_profiles where organization_id=p_org and customer_id=c.id for update;
 -- A new profile is saved with revision null; an existing one needs its exact current revision.
 if found then
  if jsonb_typeof(p_input->'revision')<>'number' or b.revision<>(p_input->>'revision')::integer then raise exception 'STALE_REVISION';end if;
  before_value:=jsonb_build_object('businessAccount',to_jsonb(b)-'organization_id'-'customer_id'-'created_at');
  update public.customer_business_profiles set account_type=v->>'accountType',company_name=nullif(trim(v->>'companyName'),''),billing_name=nullif(trim(v->>'billingName'),''),
   billing_email=lower(nullif(trim(v->>'billingEmail'),'')),payment_terms_days=(v->>'paymentTermsDays')::integer,approval_limit_cents=limit_cents,stage=v->>'stage',
   next_action=nullif(trim(v->>'nextAction'),''),follow_up_on=(v->>'followUpOn')::date,lost_reason=v->>'lostReason',revision=revision+1,updated_at=moment
   where organization_id=p_org and customer_id=c.id returning * into b;
 else
  if jsonb_typeof(p_input->'revision')<>'null' then raise exception 'STALE_REVISION';end if;
  insert into public.customer_business_profiles(organization_id,customer_id,account_type,company_name,billing_name,billing_email,payment_terms_days,approval_limit_cents,stage,next_action,follow_up_on,lost_reason,updated_at)
  values(p_org,c.id,v->>'accountType',nullif(trim(v->>'companyName'),''),nullif(trim(v->>'billingName'),''),lower(nullif(trim(v->>'billingEmail'),'')),(v->>'paymentTermsDays')::integer,limit_cents,v->>'stage',
   nullif(trim(v->>'nextAction'),''),(v->>'followUpOn')::date,v->>'lostReason',moment) returning * into b;
 end if;
 after_value:=jsonb_build_object('businessAccount',to_jsonb(b)-'organization_id'-'customer_id'-'created_at');
 insert into private.customer_record_changes(organization_id,customer_id,kind,record_id,actor_id,session_id,reason,before_value,after_value)
 values(p_org,c.id,'customer',c.id,auth.uid(),(auth.jwt()->>'session_id')::uuid,coalesce(nullif(reason,''),'Business account updated'),before_value,after_value);
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'business_account.save',c.id,b.revision,gen_random_uuid());
 result:=jsonb_build_object('saved',true,'customerId',c.id,'revision',b.revision);
 insert into private.command_receipts values(p_org,'SaveBusinessAccount',p_key,fingerprint,result,moment);return result;
end$$;
create function public.save_business_account(p_org uuid,p_input jsonb,p_key text) returns jsonb
language sql security invoker set search_path='' as $$select private.save_business_account(p_org,p_input,p_key)$$;

-- One customer's business profile, or the business pipeline: follow-ups due first, then by stage.
create function private.owner_business_accounts(p_org uuid,p_customer uuid default null,p_stage text default null,p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb;today date:=(now() at time zone 'America/Chicago')::date;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_page is null or p_page not between 0 and 10000 or (p_stage is not null and p_stage not in('prospect','contacted','walkthrough','estimate','won','repeat','not_now','lost','open','due')) then raise exception 'VALIDATION';end if;
 if p_customer is not null then
  perform 1 from public.customers where organization_id=p_org and id=p_customer;
  if not found then raise exception 'NOT_FOUND';end if;
  return jsonb_build_object('account',(select private.business_account_json(b,null) from public.customer_business_profiles b where b.organization_id=p_org and b.customer_id=p_customer));
 end if;
 select coalesce(jsonb_agg(x.data order by x.n),'[]'::jsonb) into items from(
  select row_number() over(order by (b.follow_up_on is null),b.follow_up_on,array_position(array['walkthrough','estimate','contacted','prospect','won','repeat','not_now','lost'],b.stage),c.display_name,c.id) n,
   private.business_account_json(b,c.display_name) data
  from public.customer_business_profiles b join public.customers c on c.organization_id=b.organization_id and c.id=b.customer_id
  where b.organization_id=p_org and c.archived_at is null
   and (p_stage is null or b.stage=p_stage or (p_stage='open' and b.stage not in('not_now','lost')) or (p_stage='due' and b.follow_up_on<=today and b.stage not in('lost')))
  order by n offset p_page*20 limit 21
 ) x;
 return jsonb_build_object(
  'items',(select coalesce(jsonb_agg(v),'[]'::jsonb) from jsonb_array_elements(items) with ordinality t(v,n) where n<=20),
  'hasMore',jsonb_array_length(items)>20,'page',p_page,
  'counts',(select jsonb_build_object(
    'open',count(*) filter(where b.stage not in('not_now','lost')),
    'due',count(*) filter(where b.follow_up_on<=today and b.stage<>'lost'),
    'won',count(*) filter(where b.stage in('won','repeat')),
    'total',count(*))
   from public.customer_business_profiles b join public.customers c on c.organization_id=b.organization_id and c.id=b.customer_id where b.organization_id=p_org and c.archived_at is null));
end$$;
create function private.business_account_json(b public.customer_business_profiles,p_name text) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object('customerId',b.customer_id,'displayName',p_name))||jsonb_build_object(
  'accountType',b.account_type,'companyName',b.company_name,'billingName',b.billing_name,'billingEmail',b.billing_email,
  'paymentTermsDays',b.payment_terms_days,'approvalLimitCents',b.approval_limit_cents,'stage',b.stage,'nextAction',b.next_action,
  'followUpOn',b.follow_up_on,'lostReason',b.lost_reason,'revision',b.revision,'updatedAt',b.updated_at)
$$;
create function public.owner_business_accounts(p_org uuid,p_customer uuid default null,p_stage text default null,p_page integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$select private.owner_business_accounts(p_org,p_customer,p_stage,p_page)$$;
revoke all on function private.save_business_account(uuid,jsonb,text),public.save_business_account(uuid,jsonb,text),private.owner_business_accounts(uuid,uuid,text,integer),public.owner_business_accounts(uuid,uuid,text,integer),private.business_account_json(public.customer_business_profiles,text) from public,anon,service_role;
grant execute on function private.save_business_account(uuid,jsonb,text),public.save_business_account(uuid,jsonb,text),private.owner_business_accounts(uuid,uuid,text,integer),public.owner_business_accounts(uuid,uuid,text,integer) to authenticated;

-- Which claimed marketing sends go to a business contact, so the worker can use the business series.
-- A contact is business when it came in through the business inquiry form, or when its linked
-- customer has a business profile.
create function private.marketing_business_sends(p_org uuid,p_ids uuid[]) returns uuid[]
language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(s.id),'{}'::uuid[]) from public.marketing_sends s join public.marketing_contacts m on m.id=s.contact_id
 where s.organization_id=p_org and s.id=any(coalesce(p_ids,'{}'::uuid[])) and cardinality(coalesce(p_ids,'{}'::uuid[]))<=25
  and (m.first_source='partner-inquiry' or m.last_source='partner-inquiry'
   or exists(select 1 from public.customer_business_profiles b where b.organization_id=p_org and b.customer_id=m.customer_id))
$$;
create function public.marketing_business_sends(p_org uuid,p_ids uuid[]) returns uuid[]
language sql stable security definer set search_path='' as $$select private.marketing_business_sends(p_org,p_ids)$$;
revoke all on function private.marketing_business_sends(uuid,uuid[]),public.marketing_business_sends(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.marketing_business_sends(uuid,uuid[]) to service_role;
