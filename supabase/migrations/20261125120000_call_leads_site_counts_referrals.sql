-- Growth upgrades (owner-facing evidence only; nothing here prices, books, texts or emails anyone).
-- 1. "Who sent you?" on website requests: an optional referral name, kept in the immutable submission.
-- 2. Call leads: short "call me back" website requests plus phone calls the owner logs by hand,
--    each with a status and a follow-up day so no caller falls through the cracks.
-- 3. Site counts: anonymous daily totals (page views, call taps, request starts and sends).
--    No cookies, IP addresses, user agents or visitor ids are stored; only per-day counts.

-- 1. Referral name on public requests. Same guarded patch pattern as request_lead_source, so every
--    existing identity, security, rate-limit, service and audit check in the intake stays intact.
do $migration$
declare d text; old text; sig regprocedure := 'public.submit_service_request(uuid,text,text,jsonb)'::regprocedure;
begin
 d:=pg_get_functiondef(sig);
 old:='''preferredTime'',''website'',''leadSource''))';
 if strpos(d,old)=0 then raise exception 'INTAKE_REFERRAL_KEYS_CHANGED';end if;
 d:=replace(d,old,'''preferredTime'',''website'',''leadSource'',''referredBy''))');
 old:='v_description := coalesce(p_data->>''description'','''');';
 if strpos(d,old)=0 then raise exception 'INTAKE_REFERRAL_VALIDATION_CHANGED';end if;
 d:=replace(d,old,$guard$if p_data ? 'referredBy' and (length(trim(p_data->>'referredBy')) not between 2 and 120 or p_data->>'referredBy' ~ '[[:cntrl:]<>]') then raise exception 'VALIDATION';end if;
 v_description := coalesce(p_data->>'description','');$guard$);
 execute d;
end $migration$;

-- 2. Call leads.
create table public.call_leads (
 organization_id uuid not null references public.organizations(id),
 id uuid not null default gen_random_uuid(),
 request_key text,
 origin text not null check(origin in ('website','phone')),
 name text not null check(length(name) between 2 and 120),
 phone text not null check(length(phone) between 7 and 35),
 need text not null check(length(need) between 3 and 500),
 lead_source text check(lead_source is null or length(lead_source) between 2 and 60),
 referred_by text check(referred_by is null or length(referred_by) between 2 and 120),
 status text not null default 'open' check(status in ('open','called','booked','closed')),
 follow_up_on date,
 note text check(note is null or length(note) between 1 and 1000),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(organization_id,id),
 unique(organization_id,request_key)
);
create index call_leads_open on public.call_leads(organization_id,status,follow_up_on,created_at);
alter table public.call_leads enable row level security;
revoke all on public.call_leads from public,anon,authenticated;

create function private.call_lead_json(c public.call_leads) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('id',c.id,'origin',c.origin,'name',c.name,'phone',c.phone,'need',c.need,'leadSource',c.lead_source,
  'referredBy',c.referred_by,'status',c.status,'followUpOn',c.follow_up_on,'note',c.note,'createdAt',c.created_at,'updatedAt',c.updated_at)
$$;
create function private.clean_text_ok(p text,p_min integer,p_max integer) returns boolean
language sql immutable set search_path='' as $$ select p is not null and length(trim(p)) between p_min and p_max and p !~ '[[:cntrl:]<>]' $$;

-- Website "call me back" form. Server-only (service role), throttled per client, replay-safe by key.
create function public.submit_callback_lead(p_org uuid,p_key text,p_client_hash text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_count integer; v_id uuid; v_existing public.call_leads;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or p_key !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' or p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$'
  or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>3000
  or exists(select 1 from jsonb_each(p_data) x where jsonb_typeof(x.value)<>'string')
  or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('name','phone','need','leadSource','referredBy'))
  or not p_data ?& array['name','phone','need']
  or not private.clean_text_ok(p_data->>'name',2,120) or not private.clean_text_ok(p_data->>'phone',7,35) or (p_data->>'phone') !~ '[0-9].*[0-9].*[0-9].*[0-9].*[0-9].*[0-9].*[0-9]'
  or not private.clean_text_ok(p_data->>'need',3,500)
  or (p_data ? 'referredBy' and not private.clean_text_ok(p_data->>'referredBy',2,120))
  or (p_data ? 'leadSource' and p_data->>'leadSource' not in ('Google search or Maps','Facebook','Nextdoor','Friend, family or neighbor','Realtor or property manager','Saw our truck, sign or uniform','Flyer, card or door hanger','Returning customer','Other'))
 then raise exception 'VALIDATION';end if;
 if not exists(select 1 from public.organizations where id=p_org and status in ('setup','active'))
 or not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 p_key:=lower(p_key);
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':callback:'||p_key,0));
 select * into v_existing from public.call_leads where organization_id=p_org and request_key=p_key;
 if found then
  if v_existing.name<>trim(p_data->>'name') or v_existing.phone<>trim(p_data->>'phone') or v_existing.need<>trim(p_data->>'need') then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('ok',true,'id',v_existing.id);
 end if;
 insert into private.intake_throttles(organization_id,client_hash,window_start,count)
 values(p_org,p_client_hash,date_trunc('hour',now()),1)
 on conflict(organization_id,client_hash,window_start) do update set count=private.intake_throttles.count+1 returning count into v_count;
 if v_count>5 then raise exception 'RATE_LIMITED';end if;
 insert into public.call_leads(organization_id,request_key,origin,name,phone,need,lead_source,referred_by)
 values(p_org,p_key,'website',trim(p_data->>'name'),trim(p_data->>'phone'),trim(p_data->>'need'),p_data->>'leadSource',nullif(trim(coalesce(p_data->>'referredBy','')),''))
 returning id into v_id;
 return jsonb_build_object('ok',true,'id',v_id);
end$$;

-- Owner call list: open and called leads first (follow-ups due first), then recent booked/closed.
create function private.owner_call_leads(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare today date:=(now() at time zone 'America/Chicago')::date;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return jsonb_build_object(
  'items',(select coalesce(jsonb_agg(private.call_lead_json(c) order by (c.status in ('booked','closed')),(c.follow_up_on is null),c.follow_up_on,c.created_at desc),'[]'::jsonb)
   from (select * from public.call_leads c where c.organization_id=p_org and (c.status in ('open','called') or c.updated_at>now()-interval '30 days')
    order by (c.status in ('booked','closed')),c.created_at desc limit 100) c),
  'counts',(select jsonb_build_object('open',count(*) filter(where status='open'),'called',count(*) filter(where status='called'),
    'due',count(*) filter(where status in ('open','called') and follow_up_on<=today),'booked30',count(*) filter(where status='booked' and updated_at>now()-interval '30 days'))
   from public.call_leads where organization_id=p_org));
end$$;
create function public.owner_call_leads(p_org uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.owner_call_leads(p_org)$$;

-- Owner logs a phone call (id null) or updates a lead's status, follow-up day or note.
create function private.owner_save_call_lead(p_org uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.call_leads; v_follow date;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>4000
  or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('id','name','phone','need','leadSource','referredBy','status','followUpOn','note'))
  or exists(select 1 from jsonb_each(p_input) x where jsonb_typeof(x.value) not in ('string','null'))
  or (p_input->>'id' is not null and p_input->>'id' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
  or (p_input->>'status' is not null and p_input->>'status' not in ('open','called','booked','closed'))
  or (p_input->>'followUpOn' is not null and p_input->>'followUpOn' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
  or (p_input->>'note' is not null and length(p_input->>'note')>0 and not private.clean_text_ok(p_input->>'note',1,1000))
  or (p_input->>'referredBy' is not null and length(p_input->>'referredBy')>0 and not private.clean_text_ok(p_input->>'referredBy',2,120))
  or (p_input->>'leadSource' is not null and length(p_input->>'leadSource')>0 and p_input->>'leadSource' not in ('Google search or Maps','Facebook','Nextdoor','Friend, family or neighbor','Realtor or property manager','Saw our truck, sign or uniform','Flyer, card or door hanger','Returning customer','Other'))
 then raise exception 'VALIDATION';end if;
 if p_input->>'followUpOn' is not null then begin v_follow:=(p_input->>'followUpOn')::date; exception when others then raise exception 'VALIDATION';end;end if;
 if p_input->>'id' is null then
  if not private.clean_text_ok(p_input->>'name',2,120) or not private.clean_text_ok(p_input->>'phone',7,35) or not private.clean_text_ok(p_input->>'need',3,500) then raise exception 'VALIDATION';end if;
  insert into public.call_leads(organization_id,origin,name,phone,need,lead_source,referred_by,status,follow_up_on,note,created_by)
  values(p_org,'phone',trim(p_input->>'name'),trim(p_input->>'phone'),trim(p_input->>'need'),nullif(p_input->>'leadSource',''),nullif(trim(coalesce(p_input->>'referredBy','')),''),
   coalesce(p_input->>'status','called'),v_follow,nullif(trim(coalesce(p_input->>'note','')),''),auth.uid()) returning * into c;
 else
  select * into c from public.call_leads where organization_id=p_org and id=(p_input->>'id')::uuid for update;
  if not found then raise exception 'NOT_FOUND';end if;
  update public.call_leads set
   status=coalesce(p_input->>'status',status),
   follow_up_on=case when p_input ? 'followUpOn' then v_follow else follow_up_on end,
   note=case when p_input ? 'note' then nullif(trim(coalesce(p_input->>'note','')),'') else note end,
   referred_by=case when p_input ? 'referredBy' then nullif(trim(coalesce(p_input->>'referredBy','')),'') else referred_by end,
   lead_source=case when p_input ? 'leadSource' then nullif(p_input->>'leadSource','') else lead_source end,
   updated_at=now()
  where organization_id=p_org and id=c.id returning * into c;
 end if;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'call_lead.save',c.id,1,gen_random_uuid());
 return jsonb_build_object('saved',true,'lead',private.call_lead_json(c));
end$$;
create function public.owner_save_call_lead(p_org uuid,p_input jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.owner_save_call_lead(p_org,p_input)$$;

-- 3. Anonymous daily site counts.
create table private.site_daily_counts (
 organization_id uuid not null references public.organizations(id),
 day date not null,
 kind text not null check(kind in ('view','call_tap','request_start','request_sent','callback_sent')),
 page text not null check(page ~ '^/[a-z0-9/-]{0,80}$'),
 source text not null check(source in ('direct','google','bing','facebook','nextdoor','other_search','other_site','email')),
 count integer not null check(count>0),
 primary key(organization_id,day,kind,page,source)
);
create table private.site_event_throttles (
 organization_id uuid not null references public.organizations(id),
 client_hash text not null, window_start timestamptz not null, count integer not null check(count>0),
 primary key(organization_id,client_hash,window_start)
);
alter table private.site_daily_counts enable row level security;
alter table private.site_event_throttles enable row level security;
revoke all on private.site_daily_counts,private.site_event_throttles from public,anon,authenticated;

create function public.record_site_event(p_org uuid,p_client_hash text,p_kind text,p_page text,p_source text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_count integer; v_day date:=(now() at time zone 'America/Chicago')::date;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' or p_kind not in ('view','call_tap','request_start','request_sent','callback_sent')
  or p_page is null or p_page !~ '^/[a-z0-9/-]{0,80}$' or p_source not in ('direct','google','bing','facebook','nextdoor','other_search','other_site','email') then raise exception 'VALIDATION';end if;
 if not exists(select 1 from public.organizations where id=p_org and status in ('setup','active')) then raise exception 'SETUP_REQUIRED';end if;
 -- At most 120 counted events per client per hour; extra events are quietly ignored, never errors.
 insert into private.site_event_throttles(organization_id,client_hash,window_start,count)
 values(p_org,p_client_hash,date_trunc('hour',now()),1)
 on conflict(organization_id,client_hash,window_start) do update set count=private.site_event_throttles.count+1 returning count into v_count;
 if v_count>120 then return jsonb_build_object('ok',true,'counted',false);end if;
 delete from private.site_event_throttles where organization_id=p_org and window_start<now()-interval '2 days';
 insert into private.site_daily_counts(organization_id,day,kind,page,source,count) values(p_org,v_day,p_kind,p_page,p_source,1)
 on conflict(organization_id,day,kind,page,source) do update set count=private.site_daily_counts.count+1;
 return jsonb_build_object('ok',true,'counted',true);
end$$;

create function private.owner_site_counts(p_org uuid,p_days integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare since date;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_days is null or p_days not between 1 and 365 then raise exception 'VALIDATION';end if;
 since:=(now() at time zone 'America/Chicago')::date-(p_days-1);
 return jsonb_build_object('days',p_days,'since',since,
  'totals',(select coalesce(jsonb_object_agg(kind,n),'{}'::jsonb) from (select kind,sum(count)::integer n from private.site_daily_counts where organization_id=p_org and day>=since group by kind) t),
  'sources',(select coalesce(jsonb_agg(jsonb_build_object('source',source,'views',views,'actions',actions) order by views desc,source),'[]'::jsonb) from (
    select source,sum(count) filter(where kind='view')::integer views,sum(count) filter(where kind<>'view' and kind<>'request_start')::integer actions
    from private.site_daily_counts where organization_id=p_org and day>=since group by source) s),
  'pages',(select coalesce(jsonb_agg(jsonb_build_object('page',page,'views',views,'actions',actions) order by views desc,page),'[]'::jsonb) from (
    select page,sum(count) filter(where kind='view')::integer views,sum(count) filter(where kind in ('call_tap','request_sent','callback_sent'))::integer actions
    from private.site_daily_counts where organization_id=p_org and day>=since group by page order by 2 desc nulls last limit 15) p),
  'daily',(select coalesce(jsonb_agg(jsonb_build_object('day',day,'views',views,'actions',actions) order by day),'[]'::jsonb) from (
    select day,sum(count) filter(where kind='view')::integer views,sum(count) filter(where kind in ('call_tap','request_sent','callback_sent'))::integer actions
    from private.site_daily_counts where organization_id=p_org and day>=since group by day) d));
end$$;
create function public.owner_site_counts(p_org uuid,p_days integer default 30) returns jsonb
language sql stable security invoker set search_path='' as $$select private.owner_site_counts(p_org,p_days)$$;

revoke all on function public.submit_callback_lead(uuid,text,text,jsonb),public.record_site_event(uuid,text,text,text,text),
 private.owner_call_leads(uuid),public.owner_call_leads(uuid),private.owner_save_call_lead(uuid,jsonb),public.owner_save_call_lead(uuid,jsonb),
 private.owner_site_counts(uuid,integer),public.owner_site_counts(uuid,integer),private.call_lead_json(public.call_leads),private.clean_text_ok(text,integer,integer) from public,anon,authenticated;
grant execute on function public.submit_callback_lead(uuid,text,text,jsonb),public.record_site_event(uuid,text,text,text,text) to service_role;
grant execute on function private.owner_call_leads(uuid),public.owner_call_leads(uuid),private.owner_save_call_lead(uuid,jsonb),public.owner_save_call_lead(uuid,jsonb),
 private.owner_site_counts(uuid,integer),public.owner_site_counts(uuid,integer) to authenticated;
grant execute on function private.call_lead_json(public.call_leads),private.clean_text_ok(text,integer,integer) to authenticated,service_role;
