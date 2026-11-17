-- Automated marketing email: each subscribed contact is linked to their CRM customer record, gets a
-- lifecycle stage from real quote, request and invoice status, and receives either the customer or
-- the prospect series. Sends are queued once per contact/journey/period (never twice), go out in small
-- hourly batches at the contact's best hour, and stay inside the owner's caps (default 1,500 a month,
-- 50 a day: half of the free email plan, leaving the other half for request and job emails).
-- Everything is off until the owner turns it on in the CRM.

alter table public.marketing_contacts
 add column customer_id uuid,
 add column preferred_hour smallint check(preferred_hour between 0 and 23),
 add column last_sent_at timestamptz,
 add column last_clicked_at timestamptz;
create index marketing_contacts_customer on public.marketing_contacts(organization_id,customer_id) where customer_id is not null;

alter table private.marketing_settings
 add column automation_enabled boolean not null default false,
 add column monthly_cap integer not null default 1500 check(monthly_cap between 0 and 1500),
 add column daily_cap integer not null default 50 check(daily_cap between 0 and 60),
 add column journeys_off text[] not null default '{}';

create table public.marketing_sends (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 contact_id uuid not null references public.marketing_contacts(id) on delete cascade,
 journey text not null check(journey in ('welcome','quote_followup','customer_checkin','customer_anniversary','winback','monthly')),
 period text not null check(period ~ '^[a-z0-9-]{1,60}$'),
 audience text not null check(audience in ('customer','prospect')),
 status text not null default 'queued' check(status in ('queued','sending','sent','skipped','failed')),
 scheduled_for timestamptz not null,
 attempts integer not null default 0 check(attempts between 0 and 10),
 lease_until timestamptz,
 provider_id text check(provider_id is null or length(provider_id)<=120),
 error text check(error is null or length(error)<=80),
 sent_at timestamptz,
 clicked_at timestamptz,
 created_at timestamptz not null default now(),
 unique(organization_id,contact_id,journey,period)
);
create index marketing_sends_due on public.marketing_sends(organization_id,status,scheduled_for);
create index marketing_sends_sent on public.marketing_sends(organization_id,sent_at desc) where sent_at is not null;
create index marketing_sends_contact on public.marketing_sends(contact_id,sent_at desc);
alter table public.marketing_sends enable row level security;
revoke all on public.marketing_sends from public,anon,authenticated;

-- Link list entries to the CRM customer they came from, so records are shared across the CRM.
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
  insert into public.marketing_contacts(organization_id,email,basis,full_name,phone,street,city,postal_code,first_source,last_source,subscribed,customer_id)
  values(p_org,v_email,v_basis,
   case when length(trim(c.name)) between 2 and 120 then trim(c.name) end,
   case when length(trim(coalesce(c.phone,''))) between 7 and 35 then trim(c.phone) end,
   case when length(trim(coalesce(prop.street,''))) between 3 and 200 then trim(prop.street) end,
   case when length(trim(coalesce(prop.city,''))) between 2 and 80 then trim(prop.city) end,
   case when trim(coalesce(prop.postal_code,'')) ~ '^[0-9]{5}$' then trim(prop.postal_code) end,
   'crm-'||v_basis,'crm-'||v_basis,true,p_customer)
  on conflict(organization_id,email) do update set
   full_name=coalesce(excluded.full_name,public.marketing_contacts.full_name),phone=coalesce(excluded.phone,public.marketing_contacts.phone),
   street=coalesce(excluded.street,public.marketing_contacts.street),city=coalesce(excluded.city,public.marketing_contacts.city),
   postal_code=coalesce(excluded.postal_code,public.marketing_contacts.postal_code),
   basis=case when public.marketing_contacts.basis='lead' and excluded.basis='customer' then 'customer' else public.marketing_contacts.basis end,
   customer_id=coalesce(public.marketing_contacts.customer_id,excluded.customer_id),
   last_source=excluded.last_source,updated_at=now();
 end loop;
end $$;
revoke all on function private.sync_marketing_customer(uuid,uuid) from public,anon,authenticated;

-- Lifecycle stage from live CRM records (never stored, so it is always current).
create or replace function private.marketing_stage(p_org uuid,p_customer uuid) returns text
language sql stable security definer set search_path = '' as $$
 select case
  when p_customer is null then 'subscriber'
  when exists(select 1 from public.invoices where organization_id=p_org and customer_id=p_customer) then 'customer'
  when exists(select 1 from public.quotes where organization_id=p_org and customer_id=p_customer and status='sent') then 'quoted'
  when exists(select 1 from public.service_requests where organization_id=p_org and customer_id=p_customer and status in ('submitted','reviewing')) then 'lead'
  when exists(select 1 from public.service_requests where organization_id=p_org and customer_id=p_customer and status in ('declined','canceled'))
    or exists(select 1 from public.quotes where organization_id=p_org and customer_id=p_customer and status in ('declined','expired')) then 'declined'
  else 'lead' end
$$;
revoke all on function private.marketing_stage(uuid,uuid) from public,anon,authenticated;

-- Next sending moment at or after p_from: the given Central-time hour (kept inside 8am-6pm), never Sunday.
create or replace function private.marketing_slot(p_from timestamptz,p_hour integer) returns timestamptz
language plpgsql immutable set search_path = '' as $$
declare v_local timestamp:=p_from at time zone 'America/Chicago'; v_hour integer:=least(18,greatest(8,coalesce(p_hour,9))); v_at timestamp;
begin
 v_at:=date_trunc('day',v_local)+make_interval(hours=>v_hour);
 if v_at<v_local then v_at:=v_at+interval '1 day'; end if;
 if extract(dow from v_at)=0 then v_at:=v_at+interval '1 day'; end if;
 return v_at at time zone 'America/Chicago';
end $$;
revoke all on function private.marketing_slot(timestamptz,integer) from public,anon,authenticated;

-- Queue whatever is due. Idempotent: each contact gets each journey at most once per period.
create or replace function public.marketing_automation_plan(p_org uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s private.marketing_settings; v_local timestamp:=now() at time zone 'America/Chicago'; v_month text; v_added integer:=0; v_n integer;
 v_start timestamp; v_slots timestamp[];
begin
 select * into s from private.marketing_settings where organization_id=p_org;
 if s is null or not s.automation_enabled then return jsonb_build_object('enabled',false,'queued',0); end if;
 v_month:=to_char(v_local,'YYYY-MM');

 -- Welcome: new opt-in sign-ups (for example a giveaway entry) the day after they join.
 if not 'welcome'=any(s.journeys_off) then
  insert into public.marketing_sends(organization_id,contact_id,journey,period,audience,scheduled_for)
  select p_org,m.id,'welcome','once',case when private.marketing_stage(p_org,m.customer_id)='customer' then 'customer' else 'prospect' end,
   private.marketing_slot(greatest(now(),m.consent_at+interval '1 day'),m.preferred_hour)
  from public.marketing_contacts m where m.organization_id=p_org and m.subscribed and m.basis='opt_in' and m.consent_at>now()-interval '14 days'
  on conflict do nothing;
  get diagnostics v_n=row_count; v_added:=v_added+v_n;
 end if;

 -- Quote follow-up: an estimate still waiting for a yes, 3 days after it went out (once per quote).
 if not 'quote_followup'=any(s.journeys_off) then
  insert into public.marketing_sends(organization_id,contact_id,journey,period,audience,scheduled_for)
  select p_org,m.id,'quote_followup',q.id::text,'prospect',private.marketing_slot(greatest(now(),q.created_at+interval '3 days'),m.preferred_hour)
  from public.marketing_contacts m join public.quotes q on q.organization_id=p_org and q.customer_id=m.customer_id
  where m.organization_id=p_org and m.subscribed and q.status='sent' and q.created_at between now()-interval '21 days' and now()-interval '2 days'
   and not exists(select 1 from public.invoices i where i.organization_id=p_org and i.customer_id=m.customer_id)
  on conflict do nothing;
  get diagnostics v_n=row_count; v_added:=v_added+v_n;
 end if;

 -- Customer check-in: about three weeks after their most recent invoice.
 if not 'customer_checkin'=any(s.journeys_off) then
  insert into public.marketing_sends(organization_id,contact_id,journey,period,audience,scheduled_for)
  select p_org,m.id,'customer_checkin',i.id::text,'customer',private.marketing_slot(greatest(now(),i.issued_at+interval '21 days'),m.preferred_hour)
  from public.marketing_contacts m
  join lateral (select id,issued_at from public.invoices where organization_id=p_org and customer_id=m.customer_id order by issued_at desc limit 1) i on true
  where m.organization_id=p_org and m.subscribed and i.issued_at between now()-interval '60 days' and now()-interval '20 days'
  on conflict do nothing;
  get diagnostics v_n=row_count; v_added:=v_added+v_n;
 end if;

 -- One-year thank-you from the first invoice.
 if not 'customer_anniversary'=any(s.journeys_off) then
  insert into public.marketing_sends(organization_id,contact_id,journey,period,audience,scheduled_for)
  select p_org,m.id,'customer_anniversary',to_char(v_local,'YYYY'),'customer',private.marketing_slot(now(),m.preferred_hour)
  from public.marketing_contacts m
  join lateral (select min(issued_at) first_at from public.invoices where organization_id=p_org and customer_id=m.customer_id) i on true
  where m.organization_id=p_org and m.subscribed and i.first_at between now()-interval '395 days' and now()-interval '365 days'
  on conflict do nothing;
  get diagnostics v_n=row_count; v_added:=v_added+v_n;
 end if;

 -- Win-back: a request or estimate that didn't go ahead, 60 to 120 days later (once).
 if not 'winback'=any(s.journeys_off) then
  insert into public.marketing_sends(organization_id,contact_id,journey,period,audience,scheduled_for)
  select p_org,m.id,'winback','once','prospect',private.marketing_slot(now(),m.preferred_hour)
  from public.marketing_contacts m
  where m.organization_id=p_org and m.subscribed and m.customer_id is not null and private.marketing_stage(p_org,m.customer_id)='declined'
   and exists(select 1 from public.service_requests r where r.organization_id=p_org and r.customer_id=m.customer_id and r.created_at between now()-interval '120 days' and now()-interval '60 days')
  on conflict do nothing;
  get diagnostics v_n=row_count; v_added:=v_added+v_n;
 end if;

 -- Monthly: one per contact per month, customer or prospect series. Spread across the Tuesday,
 -- Wednesday and Thursday mornings of the first two and a half weeks (best open rates for home services).
 if not 'monthly'=any(s.journeys_off) and extract(day from v_local)<=24 then
  v_start:=date_trunc('month',v_local);
  select array_agg(d order by d) into v_slots from generate_series(v_start,v_start+interval '17 days',interval '1 day') d where extract(dow from d) in (2,3,4);
  insert into public.marketing_sends(organization_id,contact_id,journey,period,audience,scheduled_for)
  select p_org,m.id,'monthly',v_month,case when private.marketing_stage(p_org,m.customer_id)='customer' then 'customer' else 'prospect' end,
   private.marketing_slot(greatest(now(),(v_slots[1+abs(hashtext(m.id::text))%array_length(v_slots,1)] at time zone 'America/Chicago')),m.preferred_hour)
  from public.marketing_contacts m
  where m.organization_id=p_org and m.subscribed and m.created_at<now()-interval '5 days'
  on conflict do nothing;
  get diagnostics v_n=row_count; v_added:=v_added+v_n;
 end if;
 return jsonb_build_object('enabled',true,'queued',v_added);
end $$;
revoke all on function public.marketing_automation_plan(uuid) from public,anon,authenticated;
grant execute on function public.marketing_automation_plan(uuid) to service_role;

-- Marketing emails counted against today's and this month's caps (Central time).
create or replace function private.marketing_usage(p_org uuid,p_now timestamptz default now()) returns jsonb
language sql stable security definer set search_path = '' as $$
 with b as (select (date_trunc('day',p_now at time zone 'America/Chicago') at time zone 'America/Chicago') day_start,
  (date_trunc('month',p_now at time zone 'America/Chicago') at time zone 'America/Chicago') month_start)
 select jsonb_build_object(
  'today',(select count(*) from public.marketing_sends,b where organization_id=p_org and (status='sent' and sent_at>=b.day_start or status='sending')),
  'month',(select count(*) from public.marketing_sends,b where organization_id=p_org and (status='sent' and sent_at>=b.month_start or status='sending')),
  'otherToday',(select count(*) from public.outbox,b where organization_id=p_org and created_at>=b.day_start and kind not like 'calendar.%' and status in ('pending','leased','sending','accepted')))
$$;
revoke all on function private.marketing_usage(uuid,timestamptz) from public,anon,authenticated;

-- Claim the next small batch. Retires anything no longer relevant, enforces caps, quiet hours and
-- spacing (no more than one marketing email per person every 3 days), and leases rows for sending.
create or replace function private.marketing_claim_at(p_org uuid,p_limit integer,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s private.marketing_settings; u jsonb; v_local timestamp:=p_now at time zone 'America/Chicago'; v_room integer; v_rows jsonb;
begin
 if p_limit is null or p_limit not between 1 and 25 then raise exception 'VALIDATION'; end if;
 select * into s from private.marketing_settings where organization_id=p_org;
 if s is null or not s.automation_enabled then return '[]'::jsonb; end if;
 -- Expired leases go back in line (or fail after three tries).
 update public.marketing_sends set status=case when attempts>=3 then 'failed' else 'queued' end,error=case when attempts>=3 then 'retries_exhausted' end,lease_until=null
  where organization_id=p_org and status='sending' and lease_until<p_now;
 -- Retire queued emails that no longer fit.
 update public.marketing_sends ms set status='skipped',error=case when not m.subscribed then 'unsubscribed' else 'no_longer_relevant' end
  from public.marketing_contacts m
  where ms.organization_id=p_org and ms.status='queued' and m.id=ms.contact_id and (
   not m.subscribed
   or ms.journey=any(s.journeys_off)
   or (ms.journey='monthly' and ms.period<>to_char(v_local,'YYYY-MM'))
   or (ms.journey='quote_followup' and not exists(select 1 from public.quotes q where q.organization_id=p_org and q.id::text=ms.period and q.status='sent'))
   or (ms.journey='winback' and private.marketing_stage(p_org,m.customer_id)<>'declined')
   or (ms.scheduled_for<p_now-interval '21 days'));
 -- Quiet hours: Monday to Saturday, 8am to 7pm Central.
 if extract(dow from v_local)=0 or extract(hour from v_local) not between 8 and 18 then return '[]'::jsonb; end if;
 u:=private.marketing_usage(p_org,p_now);
 v_room:=least(p_limit,s.monthly_cap-(u->>'month')::int,s.daily_cap-(u->>'today')::int,90-(u->>'today')::int-(u->>'otherToday')::int);
 if v_room<=0 then return '[]'::jsonb; end if;
 with picked as (
  select ms.id from public.marketing_sends ms join public.marketing_contacts m on m.id=ms.contact_id
  where ms.organization_id=p_org and ms.status='queued' and ms.scheduled_for<=p_now and m.subscribed
   and (m.last_sent_at is null or m.last_sent_at<p_now-interval '3 days')
   and not exists(select 1 from public.marketing_sends o where o.contact_id=ms.contact_id and o.status='sending')
  order by case ms.journey when 'quote_followup' then 0 when 'welcome' then 1 when 'customer_checkin' then 2 when 'customer_anniversary' then 3 when 'winback' then 4 else 5 end,ms.scheduled_for
  for update of ms skip locked
 ), one_each as (
  -- One email per person per batch: the most important one goes first.
  select distinct on (ms.contact_id) ms.id from picked join public.marketing_sends ms on ms.id=picked.id
  order by ms.contact_id,case ms.journey when 'quote_followup' then 0 when 'welcome' then 1 when 'customer_checkin' then 2 when 'customer_anniversary' then 3 when 'winback' then 4 else 5 end,ms.scheduled_for
 ), chosen as (select o.id from one_each o join public.marketing_sends ms on ms.id=o.id
  order by case ms.journey when 'quote_followup' then 0 when 'welcome' then 1 when 'customer_checkin' then 2 when 'customer_anniversary' then 3 when 'winback' then 4 else 5 end,ms.scheduled_for limit v_room
 ), leased as (
  update public.marketing_sends ms set status='sending',attempts=ms.attempts+1,lease_until=p_now+interval '10 minutes'
  from chosen where ms.id=chosen.id returning ms.*
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'journey',l.journey,'period',l.period,'audience',l.audience,
  'email',m.email,'name',m.full_name,'city',m.city,'token',m.unsubscribe_token,'stage',private.marketing_stage(p_org,m.customer_id))),'[]')
 into v_rows from leased l join public.marketing_contacts m on m.id=l.contact_id;
 return v_rows;
end $$;
revoke all on function private.marketing_claim_at(uuid,integer,timestamptz) from public,anon,authenticated;
create or replace function public.marketing_automation_claim(p_org uuid,p_limit integer) returns jsonb
language sql security definer set search_path = '' as $$ select private.marketing_claim_at(p_org,p_limit,now()) $$;
revoke all on function public.marketing_automation_claim(uuid,integer) from public,anon,authenticated;
grant execute on function public.marketing_automation_claim(uuid,integer) to service_role;

create or replace function public.marketing_automation_finish(p_org uuid,p_id uuid,p_status text,p_provider text,p_error text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_contact uuid;
begin
 if p_status not in ('sent','failed','queued','skipped') then raise exception 'VALIDATION'; end if;
 update public.marketing_sends set status=p_status,lease_until=null,
  provider_id=case when p_status='sent' then left(p_provider,120) end,
  error=case when p_status<>'sent' then left(coalesce(p_error,'unknown'),80) end,
  sent_at=case when p_status='sent' then now() end,
  scheduled_for=case when p_status='queued' then now()+interval '1 hour' else scheduled_for end
 where organization_id=p_org and id=p_id and status='sending' returning contact_id into v_contact;
 if v_contact is null then return jsonb_build_object('ok',false); end if;
 if p_status='sent' then update public.marketing_contacts set last_sent_at=now() where id=v_contact; end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.marketing_automation_finish(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.marketing_automation_finish(uuid,uuid,text,text,text) to service_role;

-- A link click in a marketing email: remembers that the email worked and the hour this person reads email.
create or replace function public.marketing_record_click(p_send uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_contact uuid;
begin
 update public.marketing_sends set clicked_at=coalesce(clicked_at,now()) where id=p_send and status='sent' returning contact_id into v_contact;
 if v_contact is not null then
  update public.marketing_contacts set last_clicked_at=now(),preferred_hour=extract(hour from now() at time zone 'America/Chicago')::smallint where id=v_contact;
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.marketing_record_click(uuid) from public,anon,authenticated;
grant execute on function public.marketing_record_click(uuid) to service_role;

-- Any website form (for example a partner inquiry) adds the person as a lead. Never re-subscribes
-- someone who opted out and never downgrades an existing record.
create or replace function public.marketing_capture_lead(p_org uuid,p_email text,p_name text,p_source text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_email text:=lower(trim(coalesce(p_email,'')));
begin
 if p_org is null or p_source is null or p_source !~ '^[a-z0-9][a-z0-9-]{2,59}$' or length(v_email) not between 5 and 254
  or v_email !~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$' then raise exception 'VALIDATION'; end if;
 if not exists(select 1 from public.organizations where id=p_org) then raise exception 'VALIDATION'; end if;
 insert into public.marketing_contacts(organization_id,email,basis,full_name,first_source,last_source,subscribed)
 values(p_org,v_email,'lead',case when length(trim(coalesce(p_name,''))) between 2 and 120 then trim(p_name) end,p_source,p_source,true)
 on conflict(organization_id,email) do update set full_name=coalesce(public.marketing_contacts.full_name,excluded.full_name),last_source=excluded.last_source,updated_at=now();
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.marketing_capture_lead(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.marketing_capture_lead(uuid,text,text,text) to service_role;

-- Owner view for the CRM Marketing screen.
create or replace function public.marketing_automation_owner(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s private.marketing_settings;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into s from private.marketing_settings where organization_id=p_org;
 return jsonb_build_object(
  'enabled',coalesce(s.automation_enabled,false),'monthlyCap',coalesce(s.monthly_cap,1500),'dailyCap',coalesce(s.daily_cap,50),
  'journeysOff',to_jsonb(coalesce(s.journeys_off,'{}'::text[])),
  'usage',private.marketing_usage(p_org),
  'audiences',(select jsonb_build_object('customer',count(*) filter(where st='customer'),'prospect',count(*) filter(where st<>'customer'))
    from (select private.marketing_stage(p_org,customer_id) st from public.marketing_contacts where organization_id=p_org and subscribed limit 20000) x),
  'queued',(select coalesce(jsonb_object_agg(journey,n),'{}') from (select journey,count(*) n from public.marketing_sends where organization_id=p_org and status='queued' group by journey) q),
  'nextSend',(select min(scheduled_for) from public.marketing_sends where organization_id=p_org and status='queued'),
  'last30',(select jsonb_build_object('sent',count(*),'clicked',count(clicked_at)) from public.marketing_sends where organization_id=p_org and status='sent' and sent_at>now()-interval '30 days'),
  'recent',(select coalesce(jsonb_agg(jsonb_build_object('journey',r.journey,'audience',r.audience,'email',m.email,'name',m.full_name,'sentAt',r.sent_at,'clicked',r.clicked_at is not null,'status',r.status) order by coalesce(r.sent_at,r.scheduled_for) desc),'[]')
    from (select * from public.marketing_sends where organization_id=p_org and status in ('sent','failed') order by coalesce(sent_at,scheduled_for) desc limit 25) r join public.marketing_contacts m on m.id=r.contact_id));
end $$;

create or replace function public.marketing_automation_update(p_org uuid,p_enabled boolean,p_journeys_off text[],p_monthly_cap integer,p_daily_cap integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if not private.staff(p_org,array['owner']) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_enabled is null or p_journeys_off is null or array_length(p_journeys_off,1)>6 or p_monthly_cap is null or p_monthly_cap not between 0 and 1500 or p_daily_cap is null or p_daily_cap not between 0 and 60
  or exists(select 1 from unnest(p_journeys_off) j where j not in ('welcome','quote_followup','customer_checkin','customer_anniversary','winback','monthly')) then raise exception 'VALIDATION'; end if;
 insert into private.marketing_settings(organization_id,automation_enabled,journeys_off,monthly_cap,daily_cap,updated_at) values(p_org,p_enabled,p_journeys_off,p_monthly_cap,p_daily_cap,now())
 on conflict(organization_id) do update set automation_enabled=excluded.automation_enabled,journeys_off=excluded.journeys_off,monthly_cap=excluded.monthly_cap,daily_cap=excluded.daily_cap,updated_at=now();
 return public.marketing_automation_owner(p_org);
end $$;

-- Marketing status on a customer record (shared view across the CRM).
create or replace function public.marketing_customer_status(p_org uuid,p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('email',m.email,'subscribed',m.subscribed,'stage',private.marketing_stage(p_org,m.customer_id),
  'lastSentAt',m.last_sent_at,'lastClickedAt',m.last_clicked_at,'unsubscribedAt',m.unsubscribed_at,
  'last',(select jsonb_build_object('journey',journey,'sentAt',sent_at) from public.marketing_sends where contact_id=m.id and status='sent' order by sent_at desc limit 1),
  'next',(select jsonb_build_object('journey',journey,'at',scheduled_for) from public.marketing_sends where contact_id=m.id and status='queued' order by scheduled_for limit 1))),'[]')
  from public.marketing_contacts m where m.organization_id=p_org and m.customer_id=p_customer);
end $$;

revoke all on function public.marketing_automation_owner(uuid),public.marketing_automation_update(uuid,boolean,text[],integer,integer),public.marketing_customer_status(uuid,uuid) from public,anon;
grant execute on function public.marketing_automation_owner(uuid),public.marketing_automation_update(uuid,boolean,text[],integer,integer),public.marketing_customer_status(uuid,uuid) to authenticated,service_role;

-- Hourly background run (production scheduler only; local test databases have no scheduler).
do $do$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') and to_regprocedure('private.enqueue_background_worker(text)') is not null then
  execute $f$
create or replace function private.enqueue_background_worker(p_kind text) returns bigint language plpgsql set search_path to '' as $b$
declare worker text;bypass text;origin text;path text;request_id bigint;
begin
 if p_kind not in ('mail','calendar','marketing') or p_kind is null then raise exception 'Worker type not accepted';end if;
 select decrypted_secret into worker from vault.decrypted_secrets where name='ynsg_crm_worker_secret';
 select decrypted_secret into bypass from vault.decrypted_secrets where name='ynsg_crm_protection_bypass';
 select decrypted_secret into origin from vault.decrypted_secrets where name='ynsg_crm_worker_origin';
 if coalesce(length(worker),0)<32 or coalesce(length(bypass),0)<32 then raise exception 'Background credentials need setup';end if;
 if origin is distinct from 'https://ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app' then raise exception 'Worker origin not accepted';end if;
 path:=case p_kind when 'mail' then '/api/notifications/worker' when 'calendar' then '/api/google/worker' else '/api/marketing/worker' end;
 request_id:=net.http_post(url:=origin||path,body:='{}'::jsonb,
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||worker,'x-vercel-protection-bypass',bypass),timeout_milliseconds:=55000);
 insert into private.background_http_runs(request_id,kind) values(request_id,p_kind);
 delete from private.background_http_runs where requested_at<clock_timestamp()-interval '7 days';
 return request_id;
end$b$;$f$;
  if to_regclass('private.background_http_runs') is not null then
   alter table private.background_http_runs drop constraint if exists background_http_runs_kind_check;
   alter table private.background_http_runs add constraint background_http_runs_kind_check check(kind in ('mail','calendar','marketing'));
  end if;
  if not exists(select 1 from cron.job where jobname='ynsg-marketing-worker') then
   perform cron.schedule('ynsg-marketing-worker','17 * * * *',$c$select private.enqueue_background_worker('marketing');$c$);
  end if;
 end if;
end $do$;
