-- Composite synthetic booking fixture; no live messages or financial records.
create table pg_temp.recurring_fixture(input jsonb,context jsonb,facts jsonb,review uuid,result jsonb);
grant all on pg_temp.recurring_fixture to authenticated,service_role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.publish_hourly_quote('20000000-0000-4000-8000-000000000001',(select id from public.service_requests),(select revision from public.service_requests),'Synthetic approved weekly leaf management scope',120,false,false,null,'recurring-price-key-01');
select public.approve_quote('20000000-0000-4000-8000-000000000001',(select id from public.quotes),1,'Synthetic customer approval for isolated fixture only');
insert into pg_temp.recurring_fixture(context) select public.recurring_context('20000000-0000-4000-8000-000000000001',(select id from public.appointments where status='reserved'));
update pg_temp.recurring_fixture set input=jsonb_build_object('organization','20000000-0000-4000-8000-000000000001','firstAppointment',context->'first'->>'id','agreement','Synthetic actual agreement to weekly scope, dates and labor estimate; no real customer','travelBeforeMinutes',20,'travelAfterMinutes',90,'reviewed',true);
update pg_temp.recurring_fixture f set facts=(select jsonb_agg(jsonb_build_object('start',s,'end',s+((f.context->'first'->>'endAt')::timestamptz-(f.context->'first'->>'startAt')::timestamptz),'before',20,'after',90,'status','verified') order by n) from generate_series(1,52) n cross join lateral(select (((f.context->'first'->>'startAt')::timestamptz at time zone 'America/Chicago')::date+n*7+((f.context->'first'->>'startAt')::timestamptz at time zone 'America/Chicago')::time) at time zone 'America/Chicago' s) x);
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
update pg_temp.recurring_fixture set review=public.record_recurring_review('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',input,context,facts);
reset role;
-- An expired review is not permission to book.
update private.recurring_reviews set checked_at=clock_timestamp()-interval '61 seconds';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$begin begin perform public.book_recurring_series('20000000-0000-4000-8000-000000000001',(select input from pg_temp.recurring_fixture),(select review from pg_temp.recurring_fixture),'recurring-book-key-01');raise exception 'TEST FAILED: expired review';exception when raise_exception then if sqlerrm<>'REVIEW_REQUIRED' then raise;end if;end;end$$;
reset role;
update private.recurring_reviews set checked_at=clock_timestamp();
-- Conflict at the final date must roll back the preceding fifty-one generated visits.
insert into public.availability_exceptions(organization_id,starts_at,ends_at,reason) select '20000000-0000-4000-8000-000000000001',(facts->51->>'start')::timestamptz,(facts->51->>'end')::timestamptz,'Synthetic last-date conflict' from pg_temp.recurring_fixture;
set local role authenticated;
do $$begin begin perform public.book_recurring_series('20000000-0000-4000-8000-000000000001',(select input from pg_temp.recurring_fixture),(select review from pg_temp.recurring_fixture),'recurring-book-key-01');raise exception 'TEST FAILED: late date conflict';exception when raise_exception then if sqlerrm<>'OWNER_BLOCK' then raise;end if;end;end$$;
reset role;
select pg_temp.assert_true((select count(*)=1 from public.appointments where status='reserved'),'late conflict retains only original visit');
select pg_temp.assert_true((select count(*)=1 from public.jobs),'late conflict creates no extra jobs or agreements');
select pg_temp.assert_true((select count(*)=0 from private.recurring_series),'late conflict creates no partial series');
delete from public.availability_exceptions where reason='Synthetic last-date conflict';
set local role authenticated;
update pg_temp.recurring_fixture set result=public.book_recurring_series('20000000-0000-4000-8000-000000000001',input,review,'recurring-book-key-01');
select public.book_recurring_series('20000000-0000-4000-8000-000000000001',(select input from pg_temp.recurring_fixture),null,'recurring-book-key-01');
do $$begin begin perform public.book_recurring_series('20000000-0000-4000-8000-000000000001',(select input||'{"agreement":"Different synthetic agreement"}'::jsonb from pg_temp.recurring_fixture),null,'recurring-book-key-01');raise exception 'TEST FAILED: changed retry';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;end$$;
select pg_temp.assert_true((select (result->>'visits')::int=53 and (result->>'newVisits')::int=52 from pg_temp.recurring_fixture),'full-year response includes retained first visit');
select pg_temp.assert_true((select count(*)=53 from public.appointments where job_id is not null),'retry leaves exactly fifty-three appointments');
select pg_temp.assert_true((select count(*)=53 from public.jobs),'each visit has its own canonical approved job');
select pg_temp.assert_true((select count(*)=0 from public.invoices),'booking does not issue invoices');
select pg_temp.assert_true((select count(*)=0 from public.payments),'booking does not invent receipts');
select pg_temp.assert_true((public.job_schedule_readiness('20000000-0000-4000-8000-000000000001')->>'ready')::int<=2,'a year of repeats does not become fifty-three tasks for today');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='recurring.confirmation'),'one full-schedule message');
select pg_temp.assert_true((select count(*)=0 from public.outbox where kind='appointment.confirmation' and object_id<>(select (context->'first'->>'id')::uuid from pg_temp.recurring_fixture)),'no fifty-two repetitive confirmations');
select pg_temp.assert_true((select count(*)=52 from public.outbox where kind='appointment.reminder' and object_id<>(select (context->'first'->>'id')::uuid from pg_temp.recurring_fixture)),'each repeat has a scheduled reminder');
select pg_temp.assert_true((select count(distinct to_char(start_at at time zone 'America/Chicago','HH24:MI'))=1 and count(distinct to_char(start_at at time zone 'UTC','HH24:MI'))=2 from public.appointments where job_id is not null),'local time survives both daylight-saving changes');
select pg_temp.assert_true((select max(m.planned_date)<s.end_exclusive from private.recurring_series s join private.recurring_occurrences m on m.series_id=s.id group by s.end_exclusive),'year end is exclusive');
-- Reviewed extra travel persists and blocks a later website booking in the extra interval.
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$declare t timestamptz;provider jsonb;begin
 select (facts->0->>'start')::timestamptz-interval '2 hours 30 minutes' into t from pg_temp.recurring_fixture;
 provider:=public.crm_calendar_facts('20000000-0000-4000-8000-000000000001',t-interval '1 hour',t+interval '3 hours');
 begin perform public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','80000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),repeat('c',64),t,provider);raise exception 'TEST FAILED: repeat travel buffer stolen';exception when raise_exception then if sqlerrm<>'CAPACITY_CONFLICT' then raise;end if;end;
end$$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.book_recurring_series(uuid,jsonb,uuid,text)','execute'),'anonymous series creation denied');
select pg_temp.assert_true(not has_function_privilege('service_role','public.book_recurring_series(uuid,jsonb,uuid,text)','execute'),'service role cannot impersonate customer agreement');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.record_recurring_review(uuid,uuid,uuid,jsonb,jsonb,jsonb)','execute'),'browser cannot forge provider facts');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$begin begin perform public.recurring_workspace('20000000-0000-4000-8000-000000000001',null,0);raise exception 'TEST FAILED: cross-tenant series';exception when insufficient_privilege then null;end;
 begin perform public.stop_recurring_series('20000000-0000-4000-8000-000000000001',(select (result->>'id')::uuid from pg_temp.recurring_fixture),1,'Synthetic stop','recurring-stop-key-01');raise exception 'TEST FAILED: cross-tenant stop';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
-- Actual canonical work and distinct invoices/receipts, inside this isolated fixture only.
do $$declare item record;number int:=0;invoice uuid;begin
 for item in select j.id from public.jobs j join public.quotes q on q.organization_id=j.organization_id and q.id=j.quote_id join public.service_requests r on r.organization_id=q.organization_id and r.id=q.request_id where r.recurring_series_id is not null order by r.created_at,r.id limit 2 loop
  number:=number+1;
  perform public.job_action('20000000-0000-4000-8000-000000000001',item.id,1,'start','Synthetic work for isolated lifecycle','recurring-work-key-'||number);
  perform public.save_invoice_labor('20000000-0000-4000-8000-000000000001',item.id,2,'[{"description":"Synthetic weekly recorded work","recordedMinutes":120,"chargedCents":12000,"waiverReason":""}]','recurring-draft-key-'||number);
  perform public.complete_service_call('20000000-0000-4000-8000-000000000001',item.id,3,'recurring-close-key-'||number);
  perform public.approve_invoice('20000000-0000-4000-8000-000000000001',item.id,4,12000,true,'recurring-invoice-key-'||number);
  select id into invoice from public.invoices where job_id=item.id;
  perform public.record_payment('20000000-0000-4000-8000-000000000001',invoice,12000,case when number=1 then 'cash' else 'zelle' end,'Synthetic confirmed isolated receipt',now(),true,'recurring-receipt-key-'||number);
 end loop;
end$$;
do $$begin begin perform public.stop_recurring_series('20000000-0000-4000-8000-000000000001',(select (result->>'id')::uuid from pg_temp.recurring_fixture),1,'Synthetic planned stop','recurring-stop-key-01');raise exception 'TEST FAILED: future completed work canceled';exception when raise_exception then if sqlerrm<>'WORK_STARTED' then raise;end if;end;end$$;
reset role;
select pg_temp.assert_true((select count(*)=2 from public.invoices),'different repeat jobs have separate invoices');
select pg_temp.assert_true((select count(*)=2 and sum(cents)=24000 from public.payments),'distinct repeat receipts retained');
select pg_temp.assert_true((select status='active' from private.recurring_series),'blocked stop makes no partial change');
-- Move completed synthetic visits into past exception dates; never edit production dates.
update public.appointments a set start_at=clock_timestamp()-make_interval(days=>x.n+2),end_at=clock_timestamp()-make_interval(days=>x.n+2)+interval '2 hours',arrival_at=clock_timestamp()-make_interval(days=>x.n+2),revision=revision+1
from (select id,row_number() over(order by id)::int n from public.jobs where status='completed') x where a.job_id=x.id;
set local role authenticated;
select public.stop_recurring_series('20000000-0000-4000-8000-000000000001',(select (result->>'id')::uuid from pg_temp.recurring_fixture),1,'Synthetic remaining visits stopped','recurring-stop-key-02');
select public.stop_recurring_series('20000000-0000-4000-8000-000000000001',(select (result->>'id')::uuid from pg_temp.recurring_fixture),1,'Synthetic remaining visits stopped','recurring-stop-key-02');
reset role;
select pg_temp.assert_true((select count(*)=3 from public.appointments where status='reserved'),'original and two past worked visits retained');
select pg_temp.assert_true((select count(*)=50 from public.appointments where status='canceled' and job_id is not null),'only remaining unworked repeats canceled');
select pg_temp.assert_true((select count(*)=2 from public.invoices),'stop preserves both issued invoices');
select pg_temp.assert_true((select count(*)=2 from public.payments),'stop preserves both received payments');
select pg_temp.assert_true((select count(*)=1 from public.outbox where kind='recurring.stopped'),'one stop summary even after retry');
select pg_temp.assert_true(not exists(select 1 from public.outbox where kind='appointment.canceled' and status<>'suppressed'),'bulk stop sends no fifty individual cancellations');
select pg_temp.assert_true(not private.recurring_notice_current('20000000-0000-4000-8000-000000000001',(select id from public.outbox where kind='recurring.confirmation')),'superseded schedule summary cannot dispatch');
select pg_temp.assert_true((select sum(debit_cents::bigint-credit_cents)=0 from public.journal_lines),'repeat lifecycle journal remains balanced');
set constraints all immediate;
rollback;
