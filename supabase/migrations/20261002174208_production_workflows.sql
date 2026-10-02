-- Canonical minutes; legacy published configurations remain readable.
create or replace function private.assert_schedule_evidence(p_org uuid,p_request uuid,p_evidence uuid,p_now timestamptz) returns private.schedule_evidence language plpgsql security definer set search_path='' as $$
declare e private.schedule_evidence; cfg public.configuration_versions; rules jsonb; local_start timestamp; local_end timestamp; rid uuid; count_resources integer;
begin
 select * into e from private.schedule_evidence where organization_id=p_org and id=p_evidence and request_id=p_request;
 select * into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 if e.id is null or cfg.version is null or e.valid_until<=p_now or e.configuration_version<>cfg.version or e.schedule_revision is distinct from (select revision from private.schedule_state where organization_id=p_org)
 or not e.scope_reviewed or not e.travel_verified or not e.pickup_verified or not e.google_busy_verified then raise exception 'FEASIBILITY_REVIEW_REQUIRED';end if;
 rules:=cfg.settings->'scheduling';
 if rules is null or rules->>'bufferMinutes' is null or rules->>'leadMinutes' is null or (rules->>'horizonMinutes' is null and rules->>'horizonDays' is null)
 or rules->>'selectionMinutes' is null or rules->>'proposalMinutes' is null or rules->>'pendingLimit' is null
 or rules->>'earliestStart' is null or rules->>'latestStart' is null or rules->>'endOfDay' is null
 or jsonb_typeof(rules->'weekdays') is distinct from 'array' or cfg.settings->>'timezone' is null then raise exception 'SETUP_REQUIRED';end if;
 if (rules->>'selectionMinutes')::integer<=0 or (rules->>'proposalMinutes')::integer<=0 or (rules->>'pendingLimit')::integer<=0
 or (rules->>'bufferMinutes')::integer<0 or (rules->>'leadMinutes')::integer<0 or coalesce((rules->>'horizonMinutes')::integer,(rules->>'horizonDays')::integer*1440)<=(rules->>'leadMinutes')::integer
 or (rules->>'earliestStart')::integer<0 or (rules->>'latestStart')::integer<(rules->>'earliestStart')::integer
 or (rules->>'endOfDay')::integer>(24*60) or (rules->>'endOfDay')::integer<=(rules->>'latestStart')::integer
 or jsonb_array_length(rules->'weekdays')=0 then raise exception 'SETUP_REQUIRED';end if;
 if e.start_at<p_now+make_interval(mins=>(rules->>'leadMinutes')::integer) or e.start_at>p_now+make_interval(mins=>coalesce((rules->>'horizonMinutes')::integer,(rules->>'horizonDays')::integer*1440)) then raise exception 'OUTSIDE_BOOKING_WINDOW';end if;
 local_start:=e.start_at at time zone (cfg.settings->>'timezone');local_end:=e.end_at at time zone (cfg.settings->>'timezone');
 if not exists(select 1 from jsonb_array_elements_text(rules->'weekdays') d where d::integer=extract(isodow from local_start)::integer)
 or extract(hour from local_start)*60+extract(minute from local_start)<(rules->>'earliestStart')::integer
 or extract(hour from local_start)*60+extract(minute from local_start)>(rules->>'latestStart')::integer
 or local_start::date<>local_end::date or extract(hour from local_end)*60+extract(minute from local_end)>(rules->>'endOfDay')::integer
 or extract(second from local_start)<>0 or extract(minute from local_start)::integer%30<>0
 or extract(epoch from(e.end_at-e.start_at))<7200 or mod(extract(epoch from(e.end_at-e.start_at)),1800)<>0 then raise exception 'OUTSIDE_OPERATING_HOURS';end if;
 if exists(select 1 from public.availability_exceptions where organization_id=p_org and starts_at<e.end_at and ends_at>e.start_at) then raise exception 'OWNER_BLOCK';end if;
 select count(distinct x) into count_resources from unnest(e.resources) x;
 if count_resources<>cardinality(e.resources) or array_position(e.resources,null) is not null then raise exception 'INVALID_RESOURCES';end if;
 for rid in select x from unnest(e.resources) x order by x loop
  perform 1 from public.resources where organization_id=p_org and id=rid and status='available' for update;
  if not found then raise exception 'RESOURCE_UNAVAILABLE';end if;
 end loop;
 if not exists(select 1 from public.resources where organization_id=p_org and id=any(e.resources) and kind='operator') then raise exception 'OPERATOR_REQUIRED';end if;
 select array_agg(x order by x) into e.resources from unnest(e.resources) x;
 return e;
end$$;


create table public.work_sessions (
 organization_id uuid not null, id uuid not null default gen_random_uuid(),job_id uuid not null,
 started_at timestamptz not null default clock_timestamp(),ended_at timestamptz,actor_id uuid not null references auth.users(id),note text not null default '',
 primary key(organization_id,id),foreign key(organization_id,job_id) references public.jobs(organization_id,id),
 check(ended_at is null or ended_at>=started_at),check(length(note)<=3000)
);
create unique index one_open_session_per_job on public.work_sessions(organization_id,job_id) where ended_at is null;
alter table public.work_sessions enable row level security;
revoke all on public.work_sessions from public,anon,authenticated;
grant select on public.work_sessions to authenticated;
create policy work_sessions_staff on public.work_sessions for select to authenticated using(private.staff(organization_id,array['owner','admin','technician','bookkeeper']));

create function private.job_action(p_org uuid,p_id uuid,p_revision integer,p_action text,p_note text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.jobs; prior private.command_receipts; fingerprint text; result jsonb; moment timestamptz:=clock_timestamp();
begin
 if not private.staff(p_org,array['owner','admin','technician']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_action not in('start','pause','resume') or p_action is null or p_note is null or length(p_note)>3000 or p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_revision,p_action,p_note,auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':job:'||p_key,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='JobAction' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into j from public.jobs where organization_id=p_org and id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if j.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 if not exists(select 1 from public.approvals where organization_id=p_org and quote_id=j.quote_id and version=j.approved_version) then raise exception 'APPROVAL_REQUIRED';end if;
 if p_action='start' and j.status not in('approved','scheduled','en_route','arrived') or p_action='resume' and j.status<>'paused' or p_action='pause' and j.status<>'working' then raise exception 'TRANSITION';end if;
 if p_action='pause' then
  update public.work_sessions set ended_at=moment where organization_id=p_org and job_id=p_id and ended_at is null;
  if not found then raise exception 'TIME_RECORD_REQUIRED';end if;
 else
  insert into public.work_sessions(organization_id,job_id,started_at,actor_id,note) values(p_org,p_id,moment,auth.uid(),p_note);
 end if;
 update public.jobs set status=case when p_action='pause' then 'paused' else 'working' end,revision=revision+1 where organization_id=p_org and id=p_id returning * into j;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'job.'||p_action,p_id,j.revision,gen_random_uuid());
 result:=jsonb_build_object('id',j.id,'revision',j.revision,'status',j.status);
 insert into private.command_receipts values(p_org,'JobAction',p_key,fingerprint,result,now());return result;
end $$;
create function public.job_action(p_org uuid,p_id uuid,p_revision integer,p_action text,p_note text,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.job_action(p_org,p_id,p_revision,p_action,p_note,p_key)$$;
revoke all on function private.job_action(uuid,uuid,integer,text,text,text),public.job_action(uuid,uuid,integer,text,text,text) from public,anon,service_role;
grant execute on function private.job_action(uuid,uuid,integer,text,text,text),public.job_action(uuid,uuid,integer,text,text,text) to authenticated;

create function private.close_work_sessions() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in('completed','canceled') and old.status is distinct from new.status then update public.work_sessions set ended_at=clock_timestamp() where organization_id=new.organization_id and job_id=new.id and ended_at is null;end if;
 return new;
end$$;
create trigger close_work_sessions after update on public.jobs for each row execute function private.close_work_sessions();
revoke all on function private.close_work_sessions() from public,anon,authenticated,service_role;

create function private.brand_luminance(p_color text) returns double precision language sql immutable set search_path='' as $$
 select sum(case when channel<=0.04045 then channel/12.92 else power((channel+0.055)/1.055,2.4) end * weight)
 from (select get_byte(decode(substring(p_color from 2),'hex'),i)/255.0 as channel,case i when 0 then 0.2126 when 1 then 0.7152 else 0.0722 end as weight from generate_series(0,2) i) c
$$;
revoke all on function private.brand_luminance(text) from public,anon,authenticated,service_role;

create function private.publish_configuration(p_org uuid,p_expected integer,p_settings jsonb,p_catalog jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_version integer; next_version integer; fingerprint text; prior private.command_receipts; result jsonb; item jsonb; field text;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_expected is null or p_expected<0 or p_key is null or length(p_key) not between 16 and 128 or jsonb_typeof(p_settings) is distinct from 'object' or jsonb_typeof(p_catalog) is distinct from 'array' or jsonb_array_length(p_catalog)>100 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_expected,p_settings,p_catalog,auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':configuration',0));
 select * into prior from private.command_receipts where organization_id=p_org and command='PublishConfiguration' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select coalesce(max(version),0) into current_version from public.configuration_versions where organization_id=p_org;
 if current_version<>p_expected then raise exception 'STALE_REVISION';end if;
 -- No settings key can confer membership, entitlements or provider activation.
 if exists(select 1 from jsonb_object_keys(p_settings) k where k not in('schemaVersion','displayName','timezone','currency','region','policyVersion','cities','brand','notificationRecipient','sender','intakeEnabled','privacyVersion','hourly','scheduling','sellerLegalName','sellerVerified','invoiceTerms','taxTreatmentVerified','laborTaxTreatment','review')) then raise exception 'VALIDATION';end if;
 foreach field in array array['displayName','region','policyVersion','privacyVersion','sellerLegalName'] loop
  if jsonb_typeof(p_settings->field) is distinct from 'string' or length(p_settings->>field) not between 1 and 160 then raise exception 'VALIDATION';end if;
 end loop;
 if p_settings->>'schemaVersion'<>'1' or p_settings->>'currency'<>'USD' or not exists(select 1 from pg_timezone_names where name=p_settings->>'timezone')
 or jsonb_typeof(p_settings->'cities') is distinct from 'array' or jsonb_array_length(p_settings->'cities')=0
 or jsonb_typeof(p_settings->'hourly') is distinct from 'object' or jsonb_typeof(p_settings->'scheduling') is distinct from 'object'
 or jsonb_typeof(p_settings->'intakeEnabled') is distinct from 'boolean' or jsonb_typeof(p_settings->'sellerVerified') is distinct from 'boolean' or jsonb_typeof(p_settings->'taxTreatmentVerified') is distinct from 'boolean'
 or coalesce(p_settings->>'sender','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or coalesce(p_settings->>'notificationRecipient','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 then raise exception 'VALIDATION';end if;
 foreach field in array array['standardCents','communityCents'] loop
  if coalesce(p_settings->'hourly'->>field,'')!~'^[0-9]+$' or (p_settings->'hourly'->>field)::bigint not between 1 and 999999999 then raise exception 'VALIDATION';end if;
 end loop;
 if p_settings->'hourly'->>'minimumMinutes'<>'120' or p_settings->'hourly'->>'incrementMinutes'<>'30' then raise exception 'VALIDATION';end if;
 foreach field in array array['earliestStart','latestStart','endOfDay','selectionMinutes','proposalMinutes','leadMinutes','horizonMinutes','pendingLimit'] loop
  if coalesce(p_settings->'scheduling'->>field,'')!~'^[0-9]+$' or (p_settings->'scheduling'->>field)::bigint>527040 then raise exception 'VALIDATION';end if;
 end loop;
 if (p_settings->'scheduling'->>'horizonMinutes')::integer<=(p_settings->'scheduling'->>'leadMinutes')::integer or (p_settings->'scheduling'->>'selectionMinutes')::integer not between 1 and 60 or (p_settings->'scheduling'->>'proposalMinutes')::integer not between 1 and 10080 or (p_settings->'scheduling'->>'pendingLimit')::integer not between 1 and 5
 or (p_settings->'scheduling'->>'earliestStart')::integer>(p_settings->'scheduling'->>'latestStart')::integer or (p_settings->'scheduling'->>'latestStart')::integer+120>(p_settings->'scheduling'->>'endOfDay')::integer or (p_settings->'scheduling'->>'endOfDay')::integer>1440 then raise exception 'VALIDATION';end if;
 if jsonb_typeof(p_settings->'scheduling'->'weekdays') is distinct from 'array' or jsonb_array_length(p_settings->'scheduling'->'weekdays')=0 then raise exception 'VALIDATION';end if;
 for item in select value from jsonb_array_elements(p_settings->'scheduling'->'weekdays') loop if item::text!~'^[1-7]$' then raise exception 'VALIDATION';end if;end loop;
 if jsonb_typeof(p_settings->'brand') is distinct from 'object' then raise exception 'VALIDATION';end if;
 foreach field in array array['navy','forest','gold','cream'] loop if coalesce(p_settings->'brand'->>field,'')!~'^#[0-9A-Fa-f]{6}$' then raise exception 'VALIDATION';end if;end loop;
 foreach field in array array['navy','forest'] loop
  if (greatest(private.brand_luminance(p_settings->'brand'->>field),private.brand_luminance(p_settings->'brand'->>'cream'))+0.05)/(least(private.brand_luminance(p_settings->'brand'->>field),private.brand_luminance(p_settings->'brand'->>'cream'))+0.05)<4.5 then raise exception 'INACCESSIBLE_BRAND';end if;
 end loop;
 if (greatest(private.brand_luminance(p_settings->'brand'->>'navy'),private.brand_luminance(p_settings->'brand'->>'gold'))+0.05)/(least(private.brand_luminance(p_settings->'brand'->>'navy'),private.brand_luminance(p_settings->'brand'->>'gold'))+0.05)<4.5 then raise exception 'INACCESSIBLE_BRAND';end if;
 if p_settings->'scheduling'->>'bufferMinutes' is not null and (coalesce(p_settings->'scheduling'->>'bufferMinutes','')!~'^[0-9]+$' or (p_settings->'scheduling'->>'bufferMinutes')::integer>180) then raise exception 'VALIDATION';end if;
 if p_settings->'hourly'->>'partialExtension' is not null and p_settings->'hourly'->>'partialExtension' not in('exact','ceil') then raise exception 'VALIDATION';end if;
 if coalesce(p_settings->>'laborTaxTreatment','') not in('unreviewed','reviewed_non_taxable') then raise exception 'VALIDATION';end if;
 if (p_settings->>'intakeEnabled')::boolean and jsonb_array_length(p_catalog)=0 and not exists(select 1 from public.catalog_services where organization_id=p_org) then raise exception 'CATALOG_REQUIRED';end if;
 if exists(select 1 from jsonb_array_elements(p_catalog) c group by c->>'name' having count(*)>1) then raise exception 'VALIDATION';end if;
 for item in select value from jsonb_array_elements(p_catalog) loop
  if length(coalesce(item->>'name','')) not between 2 and 80 or length(coalesce(item->>'scope','')) not between 10 and 4000 or length(coalesce(item->>'exclusions','')) not between 10 and 4000 or coalesce(item->>'compliance','') not in('review','approved','held') or coalesce(item->>'pricingMode','') not in('hourly','starting','quote','review') then raise exception 'VALIDATION';end if;
  insert into public.catalog_services(organization_id,name,scope,exclusions,compliance,pricing_mode) values(p_org,item->>'name',item->>'scope',item->>'exclusions',item->>'compliance',item->>'pricingMode')
  on conflict(organization_id,name) do update set scope=excluded.scope,exclusions=excluded.exclusions,compliance=excluded.compliance,pricing_mode=excluded.pricing_mode;
 end loop;
 next_version:=current_version+1;
 insert into public.configuration_versions(organization_id,version,settings,published_by) values(p_org,next_version,p_settings,auth.uid());
 update public.organizations set display_name=p_settings->>'displayName',timezone=p_settings->>'timezone',status='active' where id=p_org;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'configuration.published',p_org,next_version,gen_random_uuid());
 result:=jsonb_build_object('version',next_version);
 insert into private.command_receipts values(p_org,'PublishConfiguration',p_key,fingerprint,result,now());return result;
end$$;
create function public.publish_configuration(p_org uuid,p_expected integer,p_settings jsonb,p_catalog jsonb,p_key text) returns jsonb language sql security invoker set search_path='' as $$select private.publish_configuration(p_org,p_expected,p_settings,p_catalog,p_key)$$;
revoke all on function private.publish_configuration(uuid,integer,jsonb,jsonb,text),public.publish_configuration(uuid,integer,jsonb,jsonb,text) from public,anon,service_role;
grant execute on function private.publish_configuration(uuid,integer,jsonb,jsonb,text),public.publish_configuration(uuid,integer,jsonb,jsonb,text) to authenticated;

-- Every selected category must pass quoting compliance; cents use canonical half-up rounding.
create or replace function private.publish_hourly_quote(p_org uuid,p_request uuid,p_revision integer,p_scope text,p_minutes integer,p_community boolean,p_eligibility_reviewed boolean,p_customer uuid,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.service_requests; cfg public.configuration_versions; q public.quotes; c uuid; prop uuid; cents integer; fingerprint text; previous private.command_receipts; result jsonb;
begin
 if not private.staff(p_org,array['owner','admin','dispatcher']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_scope is null or length(p_scope) not between 10 and 5000 or p_minutes is null or p_minutes<120 or p_minutes>1440 or p_minutes%30<>0 or p_key is null or length(p_key) not between 16 and 128 or p_community is null then raise exception 'VALIDATION';end if;
 if p_community and p_eligibility_reviewed is distinct from true then raise exception 'ELIGIBILITY_REVIEW_REQUIRED';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_request,p_revision,p_scope,p_minutes,p_community,p_eligibility_reviewed,p_customer,auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':quote:'||p_key,0));
 select * into previous from private.command_receipts where organization_id=p_org and command='PublishQuote' and key=p_key;
 if found then if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return previous.result;end if;
 select * into r from public.service_requests where organization_id=p_org and id=p_request for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if r.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 if r.status not in ('reviewing','quoted') then raise exception 'TRANSITION';end if;
 if not exists(select 1 from public.catalog_services where organization_id=p_org and id=r.service_id and compliance='approved' and pricing_mode='hourly') or exists(select 1 from public.service_request_items i join public.catalog_services c on c.organization_id=i.organization_id and c.id=i.service_id where i.organization_id=p_org and i.request_id=r.id and (c.compliance<>'approved' or c.pricing_mode<>'hourly')) then raise exception 'SERVICE_REVIEW_REQUIRED';end if;
 select * into cfg from public.configuration_versions where organization_id=p_org order by version desc limit 1;
 if cfg.settings->'hourly' is null or cfg.settings->>'policyVersion' is null then raise exception 'SETUP_REQUIRED';end if;
 cents:=case when p_community then (cfg.settings->'hourly'->>'communityCents')::integer else (cfg.settings->'hourly'->>'standardCents')::integer end;
 if cents is null or cents<=0 or cents>999999999 then raise exception 'SETUP_REQUIRED';end if;
 if (cents::bigint*p_minutes+30)/60>999999999 then raise exception 'VALIDATION';end if;
 cents:=((cents::bigint*p_minutes+30)/60)::integer;
 c:=coalesce(r.customer_id,p_customer);
 if r.customer_id is not null and p_customer is not null and r.customer_id<>p_customer then raise exception 'CUSTOMER_CONFLICT';end if;
 if c is null then
  insert into public.customers(organization_id,display_name) values(p_org,r.original_submission->>'name') returning id into c;
  insert into public.contacts(organization_id,customer_id,name,email,phone,relationship) values(p_org,c,r.original_submission->>'name',r.original_submission->>'email',r.original_submission->>'phone','requester');
 elsif not exists(select 1 from public.customers where organization_id=p_org and id=c) then raise exception 'NOT_FOUND';end if;
 prop:=r.property_id;
 if cfg.settings->>'region' is null then raise exception 'SETUP_REQUIRED';end if;
 if prop is null then insert into public.properties(organization_id,customer_id,street,city,region) values(p_org,c,r.original_submission->>'street',r.original_submission->>'city',cfg.settings->>'region') returning id into prop;end if;
 select * into q from public.quotes where organization_id=p_org and request_id=p_request for update;
 if found then
  if q.status='accepted' then raise exception 'CHANGE_ORDER_REQUIRED';end if;
  update public.quotes set current_version=current_version+1,revision=revision+1,status='sent' where organization_id=p_org and id=q.id returning * into q;
 else insert into public.quotes(organization_id,request_id,customer_id) values(p_org,p_request,c) returning * into q;end if;
 insert into public.quote_versions(organization_id,quote_id,version,scope,labor_cents,duration_minutes,snapshot)
 values(p_org,q.id,q.current_version,p_scope,cents,p_minutes,jsonb_build_object('schemaVersion',1,'configurationVersion',cfg.version,'policyVersion',cfg.settings->>'policyVersion','program',case when p_community then 'community' else 'standard' end,'eligibilityReviewed',p_eligibility_reviewed,'configuration',cfg.settings,'propertyId',prop,'customerId',c,'materials','Not included; separate approval required'));
 update public.service_requests set customer_id=c,property_id=prop,status='quoted',revision=revision+1 where organization_id=p_org and id=p_request;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'quote.published',q.id,q.current_version,gen_random_uuid());
 result:=jsonb_build_object('id',q.id,'version',q.current_version,'laborCents',cents,'requestRevision',r.revision+1);
 insert into private.command_receipts values(p_org,'PublishQuote',p_key,fingerprint,result,now());return result;
end$$;

create or replace function private.owner_setup(p_claim boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare invitation private.owner_setup_invitations; owner_email text; org uuid;
begin
 if not private.live_identity(false) then raise exception 'UNAUTHORIZED' using errcode='42501';end if;
 select lower(email) into owner_email from auth.users where id=auth.uid();
 select * into invitation from private.owner_setup_invitations where email=owner_email for update;
 if not found then
  if p_claim then raise exception 'SETUP_NOT_INVITED' using errcode='42501';end if;
  return jsonb_build_object('eligible',false);
 end if;
 if invitation.claimed_by is not null then
  if invitation.claimed_by<>auth.uid() or not exists(select 1 from public.memberships where organization_id=invitation.organization_id and user_id=auth.uid() and role='owner' and revoked_at is null) then
   raise exception 'SETUP_NOT_INVITED' using errcode='42501';
  end if;
  if p_claim and not private.live_identity(true) then raise exception 'MFA_REQUIRED' using errcode='42501';end if;
  return jsonb_build_object('eligible',true,'organization',invitation.organization_id,'claimed',true);
 end if;
 if invitation.expires_at<=now() then
  if p_claim then raise exception 'SETUP_EXPIRED' using errcode='42501';end if;
  return jsonb_build_object('eligible',false);
 end if;
 if not p_claim then return jsonb_build_object('eligible',true,'claimed',false);end if;
 if not private.live_identity(true) then raise exception 'MFA_REQUIRED' using errcode='42501';end if;
 -- Never attach an invitation to an existing tenant or elevate an existing membership.
 insert into public.organizations(slug,display_name,timezone)
 values(invitation.slug,invitation.display_name,invitation.timezone) returning id into org;
 insert into public.memberships(organization_id,user_id,role) values(org,auth.uid(),'owner');
 -- This platform-issued invitation provisions the full service app, not tenant-controlled plan changes.
 insert into public.entitlements(organization_id,module,enabled) select org,module,true from unnest(array['crm','scheduling','finance','assistant','mobile']) module;
 insert into public.resources(organization_id,name,kind) values(org,'Primary operator','operator');
 update private.owner_setup_invitations set claimed_by=auth.uid(),organization_id=org where email=owner_email;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
 values(org,auth.uid(),'owner_setup_claimed',org,1,gen_random_uuid());
 return jsonb_build_object('eligible',true,'claimed',true,'organization',org);
end $$;

-- Explicit feature readiness lets a review deployment coexist with an older database.
create function public.production_workflows_ready(p_org uuid) returns boolean language sql security invoker set search_path='' as $$select private.staff(p_org,array['owner','admin','technician','dispatcher','bookkeeper','support'])$$;
revoke all on function public.production_workflows_ready(uuid) from public,anon,service_role;
grant execute on function public.production_workflows_ready(uuid) to authenticated;
