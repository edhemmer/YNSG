-- Per-person labor; first-person minimum only. Legacy commands and retained financial snapshots are unchanged.
create or replace function private.publish_hourly_crew_quote(p_org uuid,p_request uuid,p_revision integer,p_scope text,p_minutes integer,p_community boolean,p_eligibility_reviewed boolean,p_customer uuid,p_key text,p_people integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.service_requests; cfg public.configuration_versions; q public.quotes; c uuid; prop uuid; cents integer; fingerprint text; previous private.command_receipts; result jsonb; rate integer; terms jsonb; final_scope text;
begin
 if not private.staff(p_org,array['owner','admin','dispatcher']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_people is null or p_people not between 1 and 6 then raise exception 'VALIDATION';end if;
 if p_scope is null or length(p_scope) not between 10 and 5000 or p_minutes is null or p_minutes<120 or p_minutes>1440 or p_minutes%30<>0 or p_key is null or length(p_key) not between 16 and 128 or p_community is null then raise exception 'VALIDATION';end if;
 if p_community and p_eligibility_reviewed is distinct from true then raise exception 'ELIGIBILITY_REVIEW_REQUIRED';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_request,p_revision,p_scope,p_minutes,p_community,p_eligibility_reviewed,p_customer,auth.uid(),p_people)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':quote:'||p_key,0));
 select * into previous from private.command_receipts where organization_id=p_org and command='PublishCrewQuote' and key=p_key;
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
 rate:=cents;
 if ((cents::bigint*p_minutes+30)/60)*p_people>999999999 then raise exception 'VALIDATION';end if;
 cents:=(((cents::bigint*p_minutes+30)/60)*p_people)::integer;
 terms:=jsonb_build_object('billingBasis','per_person_first_minimum','plannedPeople',p_people,'perPersonRateCents',rate,'firstPersonMinimumMinutes',120,'additionalPersonMinimumMinutes',0,'partialExtension',cfg.settings->'hourly'->'partialExtension');
 final_scope:=p_scope||E'\n\nHourly labor: $'||to_char(rate::numeric/100,'FM999999990.00')||' per person per hour. The first person has a two-hour minimum for this combined visit; additional people are billed for their actual worked time with no separate minimum. Staffing is managed by YNSG. Final charges must stay within the agreed labor amount unless a price change is approved.';
 if length(final_scope)>5000 then raise exception 'VALIDATION';end if;
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
 values(p_org,q.id,q.current_version,final_scope,cents,p_minutes,jsonb_build_object('schemaVersion',2,'crew',terms,'configurationVersion',cfg.version,'policyVersion',cfg.settings->>'policyVersion','program',case when p_community then 'community' else 'standard' end,'eligibilityReviewed',p_eligibility_reviewed,'configuration',cfg.settings,'propertyId',prop,'customerId',c,'materials','Not included; separate approval required'));
 update public.service_requests set customer_id=c,property_id=prop,status='quoted',revision=revision+1 where organization_id=p_org and id=p_request;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'quote.published',q.id,q.current_version,gen_random_uuid());
 result:=jsonb_build_object('id',q.id,'version',q.current_version,'laborCents',cents,'requestRevision',r.revision+1);
 insert into private.command_receipts values(p_org,'PublishCrewQuote',p_key,fingerprint,result,now());return result;
end$$;
create function public.publish_hourly_crew_quote(p_org uuid,p_request uuid,p_revision integer,p_scope text,p_minutes integer,p_community boolean,p_eligibility_reviewed boolean,p_customer uuid,p_key text,p_people integer) returns jsonb language sql security invoker set search_path='' as $$select private.publish_hourly_crew_quote(p_org,p_request,p_revision,p_scope,p_minutes,p_community,p_eligibility_reviewed,p_customer,p_key,p_people)$$;
revoke all on function private.publish_hourly_crew_quote(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text,integer),public.publish_hourly_crew_quote(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text,integer) from public,anon,service_role;
grant execute on function private.publish_hourly_crew_quote(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text,integer),public.publish_hourly_crew_quote(uuid,uuid,integer,text,integer,boolean,boolean,uuid,text,integer) to authenticated;

create function private.validate_crew_labor(p_quote public.quote_versions,p_lines jsonb) returns void language plpgsql immutable set search_path='' as $$
declare terms jsonb;p integer;actual integer;billed integer;expected integer;rate integer;line jsonb;people integer;seen integer[]:='{}';begin
 terms:=p_quote.snapshot->'crew';
 if terms is null then if exists(select 1 from jsonb_array_elements(p_lines) l where l ? 'crewPerson') then raise exception 'VALIDATION';end if;return;end if;
 if terms->>'billingBasis'<>'per_person_first_minimum' or (terms->>'firstPersonMinimumMinutes')::integer<>120 or (terms->>'additionalPersonMinimumMinutes')::integer<>0 then raise exception 'VALIDATION';end if;
 rate:=(terms->>'perPersonRateCents')::integer;people:=jsonb_array_length(p_lines);if people not between 1 and 6 then raise exception 'VALIDATION';end if;
 for line in select value from jsonb_array_elements(p_lines) loop
  if jsonb_typeof(line->'crewPerson') is distinct from 'number' or coalesce(line->>'crewPerson','')!~'^[1-6]$' then raise exception 'VALIDATION';end if;
  if line->>'billingBasis'='fixed' then
   if length(btrim(line->>'waiverReason'))<2 then raise exception 'ADJUSTMENT_REASON_REQUIRED';end if;
   if (line->>'chargedCents')::bigint>0 and (line->>'recordedMinutes')::integer<=0 then raise exception 'ACTUAL_WORK_REQUIRED';end if;
  elsif line->>'billingBasis' is distinct from 'hourly' then raise exception 'VALIDATION';end if;
  if line->>'billingBasis'='hourly' and (line->>'unitRateCents')::integer<>rate and length(btrim(line->>'waiverReason'))<2 then raise exception 'ADJUSTMENT_REASON_REQUIRED';end if;
  p:=(line->>'crewPerson')::integer;if p=any(seen) then raise exception 'VALIDATION';end if;seen:=array_append(seen,p);actual:=(line->>'recordedMinutes')::integer;
  if line->>'billingBasis'='fixed' then continue;end if;
  if (line->>'chargedCents')::bigint=0 and length(btrim(line->>'waiverReason'))>=2 then if (line->>'billingMinutes')::integer<>0 then raise exception 'VALIDATION';end if;continue;end if;
  if actual<=0 then raise exception 'ACTUAL_WORK_REQUIRED';end if;
  expected:=case when p=1 then greatest(120,actual) else actual end;
  if p=1 and actual>120 and (actual-120)%30<>0 then
   if terms->>'partialExtension'='ceil' then expected:=120+ceil((actual-120)::numeric/30)::integer*30;elsif terms->>'partialExtension' is distinct from 'exact' then raise exception 'ROUNDING_POLICY_REQUIRED';end if;
  end if;
  billed:=(line->>'billingMinutes')::integer;if billed<>expected then raise exception 'INVOICE_TOTAL_CHANGED';end if;
 end loop;
 if (select max(x) from unnest(seen) x)<>people then raise exception 'VALIDATION';end if;
end $$;
revoke all on function private.validate_crew_labor(public.quote_versions,jsonb) from public,anon,authenticated,service_role;
do $migration$
declare d text;old text;begin
 d:=pg_get_functiondef('private.save_invoice_labor(uuid,uuid,integer,jsonb,text)'::regprocedure);
 old:='''billingBasis'',''billingMinutes'',''unitRateCents''';if strpos(d,old)=0 then raise exception 'invoice billing validation baseline changed';end if;d:=replace(d,old,old||',''crewPerson''');
 old:='if total>q.labor_cents then raise exception ''CHANGE_ORDER_REQUIRED'';end if;';if strpos(d,old)=0 then raise exception 'invoice cap baseline changed';end if;
 execute replace(d,old,'perform private.validate_crew_labor(q,p_lines); '||old);
end $migration$;
