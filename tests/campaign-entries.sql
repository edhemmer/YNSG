-- Run after fixture prefix from foundation.sql; everything rolls back. Synthetic entrants only.
create function pg_temp.entry(p_key text,p_hash text,p_patch jsonb default '{}') returns jsonb language sql as $$
 select public.submit_campaign_entry('20000000-0000-4000-8000-000000000001','service-saturday-2026-12',p_key,p_hash,
  '{"entryType":"self","entrantName":"Pat Synthetic","entrantEmail":"Pat@Example.invalid","entrantPhone":"","entrantStreet":"1 Test Lane","entrantCity":"DeKalb","entrantPostalCode":"60115","workStreet":"1 Test Lane","workCity":"DeKalb","workPostalCode":"60115","helpWith":"Leaf cleanup","story":"Synthetic story for a test entry.","rulesAccepted":true,"marketingConsent":true}'::jsonb||p_patch)
$$;
create function pg_temp.fails(p_sql text,p_code text) returns boolean language plpgsql as $$begin execute p_sql;return false;exception when others then return sqlerrm=p_code;end$$;
create function pg_temp.check_fails(p_sql text) returns boolean language plpgsql as $$begin execute p_sql;return false;exception when check_violation then return true;end$$;
do $t$ declare a jsonb; b jsonb; c jsonb; h text:=repeat('a',64); begin
 a:=pg_temp.entry('key-0000000000000001',h);
 perform pg_temp.assert_true(a->>'ok'='true' and a->>'duplicate'='false' and length(a->>'unsubscribeToken')=64,'valid self entry is saved and returns the personal unsubscribe code');
 perform pg_temp.assert_true((select entrant_email from public.campaign_entries where id=(a->>'id')::uuid)='pat@example.invalid','email stored lowercase');
 perform pg_temp.assert_true((select entrant_phone is null from public.campaign_entries where id=(a->>'id')::uuid),'blank phone stored as null');
 b:=pg_temp.entry('key-0000000000000001',h);
 perform pg_temp.assert_true(b->>'id'=a->>'id' and b->>'duplicate'='false','same submission retried returns the original entry');
 c:=pg_temp.entry('key-0000000000000002',h,'{"entrantEmail":"PAT@example.invalid"}');
 perform pg_temp.assert_true(c->>'id'=a->>'id' and c->>'duplicate'='true','one entry per email, case-insensitive');
 perform pg_temp.assert_true((select count(*) from public.campaign_entries)=1,'duplicates add no rows');
 perform pg_temp.assert_true(pg_temp.fails($$select pg_temp.entry('key-0000000000000003','$$||h||$$','{"entrantEmail":"n1@example.invalid","entryType":"nominate"}')$$,'VALIDATION'),'nomination requires a nominee');
 a:=pg_temp.entry('key-0000000000000004',h,'{"entrantEmail":"n2@example.invalid","entryType":"nominate","nomineeName":"Lee Synthetic","nomineeRelationship":"Neighbor"}');
 perform pg_temp.assert_true((select nominee_name from public.campaign_entries where id=(a->>'id')::uuid)='Lee Synthetic','nomination saves the nominee');
 perform pg_temp.assert_true(pg_temp.fails($$select pg_temp.entry('key-0000000000000005','$$||h||$$','{"entrantEmail":"n3@example.invalid","marketingConsent":false}')$$,'VALIDATION'),'entry requires recorded email agreement');
 perform pg_temp.assert_true(pg_temp.fails($$select pg_temp.entry('key-0000000000000006','$$||h||$$','{"entrantEmail":"n4@example.invalid","rulesAccepted":false}')$$,'VALIDATION'),'entry requires accepted rules');
 perform pg_temp.assert_true(pg_temp.fails($$select pg_temp.entry('key-0000000000000007','$$||h||$$','{"entrantEmail":"n5@example.invalid","workPostalCode":"6011"}')$$,'VALIDATION'),'ZIP code must be five digits');
 perform pg_temp.assert_true(pg_temp.fails($$select pg_temp.entry('short','$$||h||$$','{"entrantEmail":"n6@example.invalid"}')$$,'VALIDATION'),'short entry key rejected');
 -- Rate limit: a different client gets five new entries an hour.
 for i in 1..5 loop perform pg_temp.entry('rate-00000000000000'||i,repeat('b',64),jsonb_build_object('entrantEmail','r'||i||'@example.invalid')); end loop;
 perform pg_temp.assert_true(pg_temp.fails($$select pg_temp.entry('rate-000000000000006','$$||repeat('b',64)||$$','{"entrantEmail":"r6@example.invalid"}')$$,'RATE_LIMITED'),'sixth entry in an hour from one client is limited');
end $t$;
select pg_temp.assert_true(not has_table_privilege('anon','public.campaign_entries','select') and not has_table_privilege('authenticated','public.campaign_entries','select'),'browser roles cannot read entries');
select pg_temp.assert_true(not has_table_privilege('anon','public.campaign_entries','insert') and not has_table_privilege('authenticated','public.campaign_entries','insert'),'browser roles cannot write entries');
select pg_temp.assert_true(not has_function_privilege('anon','public.submit_campaign_entry(uuid,text,text,text,jsonb)','execute') and not has_function_privilege('authenticated','public.submit_campaign_entry(uuid,text,text,text,jsonb)','execute'),'only the server may submit entries');
select pg_temp.assert_true((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.submit_campaign_entry(uuid,text,text,text,jsonb)'::regprocedure),'entry command locks privileged search path');
do $m$ declare tok text; r jsonb; h text:=repeat('c',64); org uuid:='20000000-0000-4000-8000-000000000001'; begin
 perform pg_temp.assert_true((select subscribed and consent_source='service-saturday-2026-12' and city='DeKalb' and street='1 Test Lane' from public.marketing_contacts where email='pat@example.invalid'),'entry adds a subscribed contact with address and consent source');
 perform pg_temp.assert_true((select count(*) from public.marketing_mailing_list where email='pat@example.invalid')=1,'subscribed contact appears on the export list');
 select unsubscribe_token into tok from public.marketing_contacts where email='pat@example.invalid';
 r:=public.unsubscribe_marketing(org,tok,null,h);
 perform pg_temp.assert_true(r->>'ok'='true' and (select not subscribed and unsubscribed_at is not null from public.marketing_contacts where email='pat@example.invalid'),'personal link opts the contact out');
 perform pg_temp.assert_true((select count(*) from public.marketing_mailing_list where email='pat@example.invalid')=0,'opted-out contact leaves the export list');
 r:=public.unsubscribe_marketing(org,null,'N2@Example.invalid',h);
 perform pg_temp.assert_true((select not subscribed from public.marketing_contacts where email='n2@example.invalid'),'typed email opts out, case-insensitive');
 r:=public.unsubscribe_marketing(org,null,'stranger@example.invalid',h);
 perform pg_temp.assert_true(r->>'ok'='true' and (select not subscribed and full_name is null from public.marketing_contacts where email='stranger@example.invalid'),'unknown email is suppressed without revealing anything');
 r:=public.unsubscribe_marketing(org,repeat('f',64),null,h);
 perform pg_temp.assert_true(r->>'ok'='true','unknown link answers the same way');
 perform pg_temp.assert_true(pg_temp.fails($$select public.unsubscribe_marketing('20000000-0000-4000-8000-000000000001',null,'not-an-email','$$||h||$$')$$,'VALIDATION'),'bad email rejected');
 for i in 1..16 loop perform public.unsubscribe_marketing(org,null,'x'||i||'@example.invalid',h); end loop;
 perform pg_temp.assert_true(pg_temp.fails($$select public.unsubscribe_marketing('20000000-0000-4000-8000-000000000001',null,'y@example.invalid','$$||h||$$')$$,'RATE_LIMITED'),'opt-out form is rate limited per client');
 r:=pg_temp.entry('key-0000000000000009',repeat('d',64),'{"entrantEmail":"stranger@example.invalid","entrantName":"Stranger Synthetic"}');
 perform pg_temp.assert_true((select subscribed and consent_at is not null and unsubscribed_at is null from public.marketing_contacts where email='stranger@example.invalid'),'a new explicit sign-up re-subscribes');
 perform pg_temp.assert_true(pg_temp.check_fails($$insert into public.marketing_contacts(organization_id,email,basis,first_source,last_source,subscribed) values('20000000-0000-4000-8000-000000000001','z@example.invalid','opt_in','test-import','test-import',true)$$),'an opt-in cannot be subscribed without a recorded consent time');
 perform pg_temp.assert_true(pg_temp.check_fails($$insert into public.marketing_contacts(organization_id,email,basis,first_source,last_source,subscribed) values('20000000-0000-4000-8000-000000000001','z@example.invalid','suppressed','test-import','test-import',true)$$),'a suppressed address can never be subscribed');
end $m$;
do $c$ declare org uuid:='20000000-0000-4000-8000-000000000001'; cust uuid:='31000000-0000-4000-8000-000000000001'; begin
 insert into public.customers(organization_id,id,display_name) values(org,cust,'Feed Synthetic');
 insert into public.contacts(organization_id,customer_id,name,email,phone,relationship) values(org,cust,'Feed Synthetic','Feed@Example.invalid','815-555-0100','requester');
 perform pg_temp.assert_true(not exists(select 1 from public.marketing_contacts where email='feed@example.invalid'),'CRM feed stays off until a start time is set');
 insert into private.marketing_settings(organization_id,crm_feed_starts_at) values(org,now()+interval '1 day');
 update public.contacts set phone='815-555-0101' where organization_id=org and customer_id=cust;
 perform pg_temp.assert_true(not exists(select 1 from public.marketing_contacts where email='feed@example.invalid'),'customers created before the start time are never added');
 update private.marketing_settings set crm_feed_starts_at=now()-interval '1 minute' where organization_id=org;
 update public.contacts set phone='815-555-0102' where organization_id=org and customer_id=cust;
 perform pg_temp.assert_true((select subscribed and basis='lead' and phone='815-555-0102' and first_source='crm-lead' from public.marketing_contacts where email='feed@example.invalid'),'new lead joins the list as a subscribed lead');
 insert into public.properties(organization_id,customer_id,street,city,region,postal_code) values(org,cust,'9 Feed Road','Sycamore','IL','60178');
 perform pg_temp.assert_true((select street='9 Feed Road' and city='Sycamore' and postal_code='60178' from public.marketing_contacts where email='feed@example.invalid'),'property address fills in the mailing address');
 perform public.unsubscribe_marketing(org,null,'feed@example.invalid',repeat('e',64));
 update public.contacts set name='Feed Synthetic Renamed' where organization_id=org and customer_id=cust;
 perform pg_temp.assert_true((select not subscribed and full_name='Feed Synthetic Renamed' from public.marketing_contacts where email='feed@example.invalid'),'CRM updates never re-subscribe someone who opted out');
 insert into public.contacts(organization_id,customer_id,name,email,relationship) values(org,cust,'Bad Email','not-an-email','other');
 perform pg_temp.assert_true(not exists(select 1 from public.marketing_contacts where email='not-an-email'),'invalid CRM emails are skipped without blocking the save');
end $c$;
-- Owner tools: run as the synthetic owner of company one, then as the other company's owner.
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
set local role authenticated;
do $o$ declare org uuid:='20000000-0000-4000-8000-000000000001'; s jsonb; x jsonb; d1 jsonb; d2 jsonb; n integer; begin
 s:=public.marketing_owner_summary(org);
 perform pg_temp.assert_true((s->>'subscribed')::int>=1 and (s->>'optedOut')::int>=1 and s->'byBasis' ? 'opt_in','owner sees list counts by source');
 perform pg_temp.assert_true(jsonb_array_length(s->'campaigns')=1 and s->'campaigns'->0->>'campaign'='service-saturday-2026-12','owner sees campaign entry counts');
 x:=public.marketing_owner_export(org);
 perform pg_temp.assert_true(jsonb_array_length(x)=(s->>'subscribed')::int,'export contains exactly the subscribed contacts');
 perform pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(x) e where e->>'email' in ('pat@example.invalid','feed@example.invalid','n2@example.invalid')),'opted-out people are never exported');
 perform pg_temp.assert_true(exists(select 1 from jsonb_array_elements(x) e where length(e->>'token')=64),'export carries personal unsubscribe codes');
 d1:=public.campaign_owner_draw(org,'service-saturday-2026-12');
 d2:=public.campaign_owner_draw(org,'service-saturday-2026-12');
 perform pg_temp.assert_true((d1->>'round')::int=1 and (d2->>'round')::int=2 and d1->>'entryId'<>d2->>'entryId','alternate draw never repeats a winner');
 perform pg_temp.assert_true((d1->>'eligible')::int>=2 and (d2->>'eligible')::int=(d1->>'eligible')::int-1,'draw records how many entries were eligible');
 perform pg_temp.assert_true(pg_temp.fails($$select count(*) from public.campaign_entries$$,'permission denied for table campaign_entries'),'signed-in users cannot read entries directly, only through owner tools');
 perform pg_temp.assert_true(jsonb_array_length(public.campaign_owner_entries(org,'service-saturday-2026-12')->'draws')=2,'draw history is kept');
 perform pg_temp.assert_true(public.marketing_owner_crm_feed(org,false)->>'crmFeedStartsAt' is null,'owner can switch the CRM feed off');
 perform pg_temp.assert_true(public.marketing_owner_crm_feed(org,true)->>'crmFeedStartsAt' is not null,'owner can switch the CRM feed on');
 perform pg_temp.assert_true(pg_temp.fails($$select public.marketing_owner_summary('20000000-0000-4000-8000-000000000002')$$,'FORBIDDEN'),'another company''s list is off limits');
end $o$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
set local role authenticated;
select pg_temp.assert_true(pg_temp.fails($$select public.marketing_owner_export('20000000-0000-4000-8000-000000000001')$$,'FORBIDDEN'),'other owners cannot export this list');
select pg_temp.assert_true(pg_temp.fails($$select public.campaign_owner_draw('20000000-0000-4000-8000-000000000001','service-saturday-2026-12')$$,'FORBIDDEN'),'other owners cannot draw winners');
reset role;
select pg_temp.assert_true(not has_table_privilege('anon','public.marketing_contacts','select') and not has_table_privilege('authenticated','public.marketing_contacts','select') and not has_table_privilege('anon','public.marketing_mailing_list','select') and not has_table_privilege('authenticated','public.marketing_mailing_list','select'),'browser roles cannot read the marketing list');
select pg_temp.assert_true(not has_function_privilege('anon','public.unsubscribe_marketing(uuid,text,text,text)','execute'),'only the server runs opt-outs');
rollback;
