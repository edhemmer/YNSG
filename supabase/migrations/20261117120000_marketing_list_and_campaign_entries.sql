-- Marketing list, opt-outs, and Service Saturday (and future giveaway) entries from the public website.
-- Each entry keeps the entrant's contact details and an explicit record that they accepted the
-- official rules and agreed to occasional YNSG emails. Only the narrow definer command below
-- writes; anon and signed-in browser roles cannot read or write the table.
create table public.campaign_entries (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 campaign text not null check(campaign ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
 entry_key text not null check(length(entry_key) between 16 and 128),
 entry_type text not null check(entry_type in ('self','nominate')),
 entrant_name text not null check(length(entrant_name) between 2 and 120),
 entrant_email text not null check(length(entrant_email) between 5 and 254 and entrant_email ~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$'),
 entrant_phone text check(entrant_phone is null or length(entrant_phone) between 7 and 35),
 entrant_street text not null check(length(entrant_street) between 3 and 200),
 entrant_city text not null check(length(entrant_city) between 2 and 80),
 entrant_postal_code text not null check(entrant_postal_code ~ '^[0-9]{5}$'),
 nominee_name text check(nominee_name is null or length(nominee_name) between 2 and 120),
 nominee_relationship text check(nominee_relationship is null or length(nominee_relationship) <= 80),
 work_street text not null check(length(work_street) between 3 and 200),
 work_city text not null check(length(work_city) between 2 and 80),
 work_postal_code text not null check(work_postal_code ~ '^[0-9]{5}$'),
 help_with text not null check(length(help_with) between 2 and 200),
 story text not null check(length(story) between 10 and 1500),
 rules_accepted boolean not null check(rules_accepted),
 marketing_consent boolean not null check(marketing_consent),
 created_at timestamptz not null default now(),
 check((entry_type='self' and nominee_name is null) or (entry_type='nominate' and nominee_name is not null)),
 unique(organization_id,campaign,entry_key)
);
-- One entry per email address for each campaign.
create unique index campaign_entries_one_per_email on public.campaign_entries(organization_id,campaign,lower(entrant_email));
create index campaign_entries_by_campaign on public.campaign_entries(organization_id,campaign,created_at);
alter table public.campaign_entries enable row level security;
revoke all on public.campaign_entries from public,anon,authenticated;

-- One marketing list per company, keyed by email. Anyone who opts out stays on the list with
-- subscribed=false so a later import or entry can't quietly email them again; only a new, explicit
-- sign-up (recorded with its source and time) turns emails back on.
create table public.marketing_contacts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 email text not null check(length(email) between 5 and 254 and email=lower(email) and email ~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$'),
 full_name text check(full_name is null or length(full_name) between 2 and 120),
 phone text check(phone is null or length(phone) between 7 and 35),
 street text check(street is null or length(street) between 3 and 200),
 city text check(city is null or length(city) between 2 and 80),
 postal_code text check(postal_code is null or postal_code ~ '^[0-9]{5}$'),
 first_source text not null check(length(first_source) between 3 and 60),
 last_source text not null check(length(last_source) between 3 and 60),
 basis text not null check(basis in ('opt_in','customer','lead','suppressed')),
 subscribed boolean not null,
 consent_at timestamptz,
 consent_source text,
 unsubscribed_at timestamptz,
 unsubscribe_token text not null unique default (replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 -- Opt-in sign-ups record when they agreed; clients and leads rely on the published privacy notice plus opt-out.
 check(not subscribed or (basis='opt_in' and consent_at is not null) or basis in ('customer','lead')),
 check(basis<>'suppressed' or not subscribed),
 unique(organization_id,email)
);
alter table public.marketing_contacts enable row level security;
revoke all on public.marketing_contacts from public,anon,authenticated;
-- Ready-to-export mailing list: only people who are currently subscribed.
create view public.marketing_mailing_list with (security_invoker=true) as
 select organization_id,email,full_name,phone,street,city,postal_code,basis,first_source,last_source,consent_at,unsubscribe_token,created_at
 from public.marketing_contacts where subscribed;
revoke all on public.marketing_mailing_list from public,anon,authenticated;

create table private.marketing_optout_throttles (
 client_hash text not null check(client_hash ~ '^[a-f0-9]{64}$'), window_start timestamptz not null, count integer not null check(count>0),
 primary key(client_hash,window_start)
);
alter table private.marketing_optout_throttles enable row level security;
revoke all on private.marketing_optout_throttles from public,anon,authenticated;

-- Opt out by personal link token or by typing an email. Always answers the same way so it never
-- reveals whether an address is on the list. Unknown emails are added as opted out (suppression).
create or replace function public.unsubscribe_marketing(p_org uuid,p_token text,p_email text,p_client_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_count integer; v_email text:=lower(trim(coalesce(p_email,'')));
begin
 if p_org is null or p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' then raise exception 'VALIDATION'; end if;
 if not exists(select 1 from public.organizations where id=p_org) then raise exception 'VALIDATION'; end if;
 insert into private.marketing_optout_throttles(client_hash,window_start,count) values(p_client_hash,date_trunc('hour',now()),1)
 on conflict(client_hash,window_start) do update set count=private.marketing_optout_throttles.count+1 returning count into v_count;
 if v_count>20 then raise exception 'RATE_LIMITED'; end if;
 if p_token is not null and p_token ~ '^[a-f0-9]{64}$' then
  update public.marketing_contacts set subscribed=false,unsubscribed_at=now(),updated_at=now() where organization_id=p_org and unsubscribe_token=p_token;
  return jsonb_build_object('ok',true);
 end if;
 if length(v_email) not between 5 and 254 or v_email !~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$' then raise exception 'VALIDATION'; end if;
 insert into public.marketing_contacts(organization_id,email,basis,first_source,last_source,subscribed,unsubscribed_at)
 values(p_org,v_email,'suppressed','unsubscribe-page','unsubscribe-page',false,now())
 on conflict(organization_id,email) do update set subscribed=false,unsubscribed_at=now(),updated_at=now(),last_source='unsubscribe-page';
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.unsubscribe_marketing(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.unsubscribe_marketing(uuid,text,text,text) to service_role;

create or replace function public.submit_campaign_entry(p_org uuid,p_campaign text,p_key text,p_client_hash text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_count integer; v_id uuid; v_type text;
begin
 if p_org is null or p_campaign is null or p_campaign !~ '^[a-z0-9][a-z0-9-]{2,59}$' or p_key is null or length(p_key) not between 16 and 128
  or p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' or p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'VALIDATION'; end if;
 if not exists(select 1 from public.organizations where id=p_org) then raise exception 'VALIDATION'; end if;
 -- Same submission retried (network drop, double tap): return the original result.
 select id into v_id from public.campaign_entries where organization_id=p_org and campaign=p_campaign and entry_key=p_key;
 if v_id is not null then return jsonb_build_object('ok',true,'id',v_id,'duplicate',false); end if;
 select id into v_id from public.campaign_entries where organization_id=p_org and campaign=p_campaign and lower(entrant_email)=lower(trim(p_data->>'entrantEmail'));
 if v_id is not null then return jsonb_build_object('ok',true,'id',v_id,'duplicate',true); end if;
 insert into private.intake_throttles(organization_id,client_hash,window_start,count)
 values(p_org,p_client_hash,date_trunc('hour',now()),1)
 on conflict(organization_id,client_hash,window_start) do update set count=private.intake_throttles.count+1 returning count into v_count;
 if v_count>5 then raise exception 'RATE_LIMITED'; end if;
 v_type:=p_data->>'entryType';
 begin
  insert into public.campaign_entries(organization_id,campaign,entry_key,entry_type,entrant_name,entrant_email,entrant_phone,entrant_street,entrant_city,entrant_postal_code,
   nominee_name,nominee_relationship,work_street,work_city,work_postal_code,help_with,story,rules_accepted,marketing_consent)
  values(p_org,p_campaign,p_key,v_type,trim(p_data->>'entrantName'),lower(trim(p_data->>'entrantEmail')),nullif(trim(coalesce(p_data->>'entrantPhone','')),''),
   trim(p_data->>'entrantStreet'),trim(p_data->>'entrantCity'),trim(p_data->>'entrantPostalCode'),
   case when v_type='nominate' then trim(p_data->>'nomineeName') end,case when v_type='nominate' then nullif(trim(coalesce(p_data->>'nomineeRelationship','')),'') end,
   trim(p_data->>'workStreet'),trim(p_data->>'workCity'),trim(p_data->>'workPostalCode'),trim(p_data->>'helpWith'),trim(p_data->>'story'),
   (p_data->>'rulesAccepted')::boolean,(p_data->>'marketingConsent')::boolean)
  returning id into v_id;
  -- Explicit agreement on this entry adds or refreshes the person on the marketing list.
  insert into public.marketing_contacts(organization_id,email,basis,full_name,phone,street,city,postal_code,first_source,last_source,subscribed,consent_at,consent_source,unsubscribed_at)
  values(p_org,lower(trim(p_data->>'entrantEmail')),'opt_in',trim(p_data->>'entrantName'),nullif(trim(coalesce(p_data->>'entrantPhone','')),''),
   trim(p_data->>'entrantStreet'),trim(p_data->>'entrantCity'),trim(p_data->>'entrantPostalCode'),p_campaign,p_campaign,true,now(),p_campaign,null)
  on conflict(organization_id,email) do update set full_name=excluded.full_name,phone=coalesce(excluded.phone,public.marketing_contacts.phone),
   street=excluded.street,city=excluded.city,postal_code=excluded.postal_code,last_source=excluded.last_source,
   basis='opt_in',subscribed=true,consent_at=excluded.consent_at,consent_source=excluded.consent_source,unsubscribed_at=null,updated_at=now();
 exception when check_violation or not_null_violation or invalid_text_representation then raise exception 'VALIDATION';
  when unique_violation then
   select id into v_id from public.campaign_entries where organization_id=p_org and campaign=p_campaign and (entry_key=p_key or lower(entrant_email)=lower(trim(p_data->>'entrantEmail')));
   return jsonb_build_object('ok',true,'id',v_id,'duplicate',true);
 end;
 return jsonb_build_object('ok',true,'id',v_id,'duplicate',false);
end $$;
revoke all on function public.submit_campaign_entry(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_campaign_entry(uuid,text,text,text,jsonb) to service_role;

-- CRM feed: current clients and website leads (including declined requests) join the marketing list
-- automatically. Off until crm_feed_starts_at is set, and only for customers created on or after it,
-- so people who submitted under the earlier "no marketing without permission" notice are never added.
-- Existing rows keep their subscribed/opt-out state; the CRM only fills in or refreshes contact details.
create table private.marketing_settings (
 organization_id uuid primary key references public.organizations(id),
 crm_feed_starts_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table private.marketing_settings enable row level security;
revoke all on private.marketing_settings from public,anon,authenticated;

create or replace function private.sync_marketing_customer(p_org uuid,p_customer uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_start timestamptz; v_created timestamptz; v_basis text; prop public.properties; c public.contacts; v_email text;
begin
 select crm_feed_starts_at into v_start from private.marketing_settings where organization_id=p_org;
 if v_start is null then return; end if;
 select created_at into v_created from public.customers where organization_id=p_org and id=p_customer;
 if v_created is null or v_created<v_start then return; end if;
 v_basis:=case when exists(select 1 from public.invoices where organization_id=p_org and customer_id=p_customer) then 'customer' else 'lead' end;
 select * into prop from public.properties where organization_id=p_org and customer_id=p_customer order by created_at desc limit 1;
 for c in select * from public.contacts where organization_id=p_org and customer_id=p_customer and email is not null loop
  v_email:=lower(trim(c.email));
  continue when length(v_email) not between 5 and 254 or v_email !~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$';
  insert into public.marketing_contacts(organization_id,email,basis,full_name,phone,street,city,postal_code,first_source,last_source,subscribed)
  values(p_org,v_email,v_basis,
   case when length(trim(c.name)) between 2 and 120 then trim(c.name) end,
   case when length(trim(coalesce(c.phone,''))) between 7 and 35 then trim(c.phone) end,
   case when length(trim(coalesce(prop.street,''))) between 3 and 200 then trim(prop.street) end,
   case when length(trim(coalesce(prop.city,''))) between 2 and 80 then trim(prop.city) end,
   case when trim(coalesce(prop.postal_code,'')) ~ '^[0-9]{5}$' then trim(prop.postal_code) end,
   'crm-'||v_basis,'crm-'||v_basis,true)
  on conflict(organization_id,email) do update set
   full_name=coalesce(excluded.full_name,public.marketing_contacts.full_name),phone=coalesce(excluded.phone,public.marketing_contacts.phone),
   street=coalesce(excluded.street,public.marketing_contacts.street),city=coalesce(excluded.city,public.marketing_contacts.city),
   postal_code=coalesce(excluded.postal_code,public.marketing_contacts.postal_code),
   basis=case when public.marketing_contacts.basis='lead' and excluded.basis='customer' then 'customer' else public.marketing_contacts.basis end,
   last_source=excluded.last_source,updated_at=now();
 end loop;
end $$;
revoke all on function private.sync_marketing_customer(uuid,uuid) from public,anon,authenticated;

-- Marketing sync never blocks a request, customer edit or invoice: any problem is skipped quietly.
create or replace function private.marketing_sync_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 begin perform private.sync_marketing_customer(new.organization_id,new.customer_id);
 exception when others then null; end;
 return null;
end $$;
revoke all on function private.marketing_sync_trigger() from public,anon,authenticated;
create trigger marketing_sync_contacts after insert or update of email,name,phone on public.contacts for each row execute function private.marketing_sync_trigger();
create trigger marketing_sync_properties after insert or update of street,city,postal_code on public.properties for each row execute function private.marketing_sync_trigger();
create trigger marketing_sync_invoices after insert on public.invoices for each row execute function private.marketing_sync_trigger();
