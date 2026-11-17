-- Run after fixture prefix from foundation.sql; everything rolls back. Synthetic contacts only.
create function pg_temp.fails(p_sql text,p_code text) returns boolean language plpgsql as $$begin execute p_sql;return false;exception when others then return sqlerrm=p_code;end$$;
do $a$ declare org uuid:='20000000-0000-4000-8000-000000000001'; cust uuid:='32000000-0000-4000-8000-000000000001'; begin
 insert into private.marketing_settings(organization_id,crm_feed_starts_at) values(org,now()-interval '1 hour');
 insert into public.customers(organization_id,id,display_name) values(org,cust,'Linked Synthetic');
 insert into public.contacts(organization_id,customer_id,name,email,relationship) values(org,cust,'Linked Synthetic','linked@example.invalid','requester');
 perform pg_temp.assert_true((select customer_id=cust from public.marketing_contacts where email='linked@example.invalid'),'CRM contacts are linked to their customer record');
 perform pg_temp.assert_true(private.marketing_stage(org,cust)='lead' and private.marketing_stage(org,null)='subscriber','stage comes from live CRM records');
 insert into public.marketing_contacts(organization_id,email,basis,full_name,first_source,last_source,subscribed,consent_at,consent_source)
 values(org,'optin@example.invalid','opt_in','Optin Synthetic','service-saturday-2026-12','service-saturday-2026-12',true,now(),'service-saturday-2026-12'),
       (org,'gone@example.invalid','lead','Gone Synthetic','crm-lead','crm-lead',false,null,null);
 perform pg_temp.assert_true(public.marketing_automation_plan(org)->>'enabled'='false' and not exists(select 1 from public.marketing_sends),'nothing is queued until the owner turns automation on');
 -- Sending moments: Central time, 8am-6pm, never Sunday.
 perform pg_temp.assert_true(private.marketing_slot('2026-12-05 20:00 America/Chicago'::timestamptz,9)='2026-12-07 09:00 America/Chicago'::timestamptz,'Saturday evening rolls to Monday morning, skipping Sunday');
 perform pg_temp.assert_true(private.marketing_slot('2026-12-02 07:00 America/Chicago'::timestamptz,9)='2026-12-02 09:00 America/Chicago'::timestamptz,'same day when the hour is still ahead');
 perform pg_temp.assert_true(private.marketing_slot('2026-12-02 07:00 America/Chicago'::timestamptz,23)='2026-12-02 18:00 America/Chicago'::timestamptz,'late reading hours are kept inside business hours');
 perform pg_temp.assert_true(private.marketing_slot('2026-12-02 07:00 America/Chicago'::timestamptz,null)='2026-12-02 09:00 America/Chicago'::timestamptz,'default send time is 9am');
end $a$;

-- Owner controls.
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
set local role authenticated;
do $o$ declare org uuid:='20000000-0000-4000-8000-000000000001'; r jsonb; begin
 r:=public.marketing_automation_owner(org);
 perform pg_temp.assert_true(r->>'enabled'='false' and (r->>'monthlyCap')::int=1500 and (r->>'dailyCap')::int=50,'automation starts off with half-of-free-plan caps');
 perform pg_temp.assert_true(pg_temp.fails($$select public.marketing_automation_update('20000000-0000-4000-8000-000000000001',true,'{}',1501,50)$$,'VALIDATION'),'monthly cap cannot exceed 1,500');
 perform pg_temp.assert_true(pg_temp.fails($$select public.marketing_automation_update('20000000-0000-4000-8000-000000000001',true,'{}',1500,61)$$,'VALIDATION'),'daily ceiling cannot exceed 60');
 perform pg_temp.assert_true(pg_temp.fails($$select public.marketing_automation_update('20000000-0000-4000-8000-000000000001',true,'{spam}',1500,50)$$,'VALIDATION'),'unknown journeys are rejected');
 r:=public.marketing_automation_update(org,true,'{winback}',1500,50);
 perform pg_temp.assert_true(r->>'enabled'='true' and r->'journeysOff'=jsonb_build_array('winback'),'owner turns automation on and individual journeys off');
 perform pg_temp.assert_true(pg_temp.fails($$select public.marketing_automation_owner('20000000-0000-4000-8000-000000000002')$$,'FORBIDDEN'),'another company''s automation is off limits');
 perform pg_temp.assert_true(jsonb_array_length(public.marketing_customer_status(org,'32000000-0000-4000-8000-000000000001'))=1,'customer record shows its marketing status');
 perform pg_temp.assert_true(pg_temp.fails($$select count(*) from public.marketing_sends$$,'permission denied for table marketing_sends'),'signed-in users cannot read the send log directly');
end $o$;
reset role;

do $p$ declare org uuid:='20000000-0000-4000-8000-000000000001'; r jsonb; n integer; v_now timestamptz; v_month text; a uuid; b uuid; g uuid; c jsonb; begin
 r:=public.marketing_automation_plan(org);
 perform pg_temp.assert_true(r->>'enabled'='true' and exists(select 1 from public.marketing_sends ms join public.marketing_contacts m on m.id=ms.contact_id where m.email='optin@example.invalid' and ms.journey='welcome' and ms.audience='prospect'),'new opt-in sign-up gets a welcome email queued');
 perform pg_temp.assert_true(not exists(select 1 from public.marketing_sends ms join public.marketing_contacts m on m.id=ms.contact_id where m.email='gone@example.invalid'),'opted-out people are never queued');
 perform pg_temp.assert_true(not exists(select 1 from public.marketing_sends where journey='monthly'),'brand-new contacts wait for next month''s email instead of getting two in a week');
 select count(*) into n from public.marketing_sends;
 perform public.marketing_automation_plan(org);
 perform pg_temp.assert_true((select count(*) from public.marketing_sends)=n,'planning again never queues the same email twice');

 -- Batches: a Wednesday 10am Central at least three weeks out, so every queued row is due.
 v_now:=private.marketing_slot(now()+interval '21 days',10);
 while extract(dow from v_now at time zone 'America/Chicago') not between 2 and 4 loop v_now:=v_now+interval '1 day'; end loop;
 v_month:=to_char(v_now at time zone 'America/Chicago','YYYY-MM');
 select id into a from public.marketing_contacts where email='optin@example.invalid';
 select id into b from public.marketing_contacts where email='linked@example.invalid';
 select id into g from public.marketing_contacts where email='gone@example.invalid';
 update public.marketing_sends set scheduled_for=v_now-interval '1 hour';
 insert into public.marketing_sends(organization_id,contact_id,journey,period,audience,scheduled_for) values
  (org,a,'monthly',v_month,'prospect',v_now-interval '2 hours'),
  (org,b,'monthly',v_month,'prospect',v_now-interval '2 hours'),
  (org,b,'monthly','2001-01','prospect',v_now-interval '2 hours'),
  (org,g,'monthly',v_month,'prospect',v_now-interval '2 hours');
 perform pg_temp.assert_true(private.marketing_claim_at(org,10,(date_trunc('week',v_now at time zone 'America/Chicago')+interval '6 days 10 hours') at time zone 'America/Chicago')='[]'::jsonb,'nothing sends on Sunday');
 perform pg_temp.assert_true(private.marketing_claim_at(org,10,(date_trunc('day',v_now at time zone 'America/Chicago')+interval '21 hours') at time zone 'America/Chicago')='[]'::jsonb,'nothing sends after 7pm');
 perform pg_temp.assert_true((select status='skipped' and error='unsubscribed' from public.marketing_sends where contact_id=g),'queued email to someone who opted out is retired, not sent');
 perform pg_temp.assert_true((select status='skipped' from public.marketing_sends where contact_id=b and period='2001-01'),'last month''s newsletter is retired instead of arriving late');
 c:=private.marketing_claim_at(org,10,v_now);
 perform pg_temp.assert_true(jsonb_array_length(c)=2,'one email per person per batch');
 perform pg_temp.assert_true(exists(select 1 from jsonb_array_elements(c) e where e->>'email'='optin@example.invalid' and e->>'journey'='welcome'),'welcome goes before the monthly email');
 perform pg_temp.assert_true(exists(select 1 from jsonb_array_elements(c) e where e->>'email'='linked@example.invalid' and e->>'stage'='lead' and length(e->>'token')=64),'batch carries stage and personal unsubscribe code');
 perform pg_temp.assert_true(private.marketing_claim_at(org,10,v_now)='[]'::jsonb,'leased emails are not claimed twice');
 perform pg_temp.assert_true(pg_temp.fails($$select public.marketing_automation_finish('20000000-0000-4000-8000-000000000001',gen_random_uuid(),'bogus',null,null)$$,'VALIDATION'),'unknown result rejected');
 for r in select e from jsonb_array_elements(c) e loop
  perform pg_temp.assert_true(public.marketing_automation_finish(org,(r->>'id')::uuid,'sent','re_synthetic',null)->>'ok'='true','send recorded');
 end loop;
 perform pg_temp.assert_true(public.marketing_automation_finish(org,(c->0->>'id')::uuid,'sent','re_synthetic',null)->>'ok'='false','a finished send cannot be finished again');
 perform pg_temp.assert_true((select last_sent_at is not null from public.marketing_contacts where id=a),'contact remembers the last marketing email');
 -- The test runs ahead of the real clock: move the recorded send times to the simulated morning.
 update public.marketing_sends set sent_at=v_now where status='sent';
 update public.marketing_contacts set last_sent_at=v_now where last_sent_at is not null;
 perform pg_temp.assert_true(private.marketing_claim_at(org,10,v_now+interval '1 hour')='[]'::jsonb,'nobody gets a second marketing email within three days');
 perform public.marketing_record_click((select id from public.marketing_sends where contact_id=a and journey='welcome'));
 perform pg_temp.assert_true((select preferred_hour is not null and last_clicked_at is not null from public.marketing_contacts where id=a),'a click teaches the contact''s best reading hour');
 -- Daily ceiling: with the ceiling at the day's count, nothing more goes out.
 update private.marketing_settings set daily_cap=2 where organization_id=org;
 update public.marketing_contacts set last_sent_at=null where id=a;
 perform pg_temp.assert_true(private.marketing_claim_at(org,10,v_now+interval '2 hours')='[]'::jsonb,'daily ceiling stops the batch');
 update private.marketing_settings set daily_cap=50,monthly_cap=2 where organization_id=org;
 perform pg_temp.assert_true(private.marketing_claim_at(org,10,v_now+interval '2 hours')='[]'::jsonb,'monthly cap stops the batch');
 update private.marketing_settings set monthly_cap=1500 where organization_id=org;
 perform pg_temp.assert_true(jsonb_array_length(private.marketing_claim_at(org,10,v_now+interval '2 hours'))=1,'with room again the waiting monthly email goes out');
 -- Expired lease returns to the queue.
 update public.marketing_sends set lease_until=v_now-interval '1 hour' where status='sending';
 perform private.marketing_claim_at(org,1,v_now+interval '2 hours');
 perform pg_temp.assert_true(not exists(select 1 from public.marketing_sends where status='sending' and lease_until<v_now),'interrupted sends are retried, not lost');
 -- Website form capture never re-subscribes an opt-out.
 perform public.marketing_capture_lead(org,'Partner@Example.invalid','Partner Synthetic','partner-inquiry');
 perform pg_temp.assert_true((select subscribed and basis='lead' and first_source='partner-inquiry' from public.marketing_contacts where email='partner@example.invalid'),'partner form adds a lead');
 perform public.marketing_capture_lead(org,'gone@example.invalid','Gone Synthetic','partner-inquiry');
 perform pg_temp.assert_true((select not subscribed from public.marketing_contacts where email='gone@example.invalid'),'a form never re-subscribes someone who opted out');
 perform pg_temp.assert_true(pg_temp.fails($$select public.marketing_capture_lead('20000000-0000-4000-8000-000000000001','nope','X','partner-inquiry')$$,'VALIDATION'),'bad email rejected');
end $p$;
select pg_temp.assert_true(not has_function_privilege('authenticated','public.marketing_automation_claim(uuid,integer)','execute') and not has_function_privilege('anon','public.marketing_automation_plan(uuid)','execute')
 and not has_function_privilege('authenticated','public.marketing_record_click(uuid)','execute') and not has_function_privilege('anon','public.marketing_capture_lead(uuid,text,text,text)','execute')
 and not has_function_privilege('authenticated','public.marketing_automation_finish(uuid,uuid,text,text,text)','execute'),'only the server can plan, claim, finish, record clicks or capture leads');
select pg_temp.assert_true(not has_table_privilege('anon','public.marketing_sends','select') and not has_table_privilege('authenticated','public.marketing_sends','select'),'browser roles cannot read the send log');
rollback;
