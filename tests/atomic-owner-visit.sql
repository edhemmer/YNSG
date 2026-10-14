-- Continues the canonical website submission and owner-approved booking fixture.
-- No job statuses, invoice totals or payment records are manufactured directly.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.publish_hourly_quote('20000000-0000-4000-8000-000000000001',(select id from public.service_requests),(select revision from public.service_requests),'Synthetic agreed leaf management scope',120,false,false,null,'lifecycle-price-01');
select public.approve_quote('20000000-0000-4000-8000-000000000001',(select id from public.quotes),1,'Synthetic customer agreement for isolated local test');
select public.job_action('20000000-0000-4000-8000-000000000001',(select id from public.jobs),1,'start','Synthetic work starts','lifecycle-start-01');
select public.job_action('20000000-0000-4000-8000-000000000001',(select id from public.jobs),1,'start','Synthetic work starts','lifecycle-start-01');
select public.job_action('20000000-0000-4000-8000-000000000001',(select id from public.jobs),2,'pause','','lifecycle-pause-01');
select public.job_action('20000000-0000-4000-8000-000000000001',(select id from public.jobs),3,'resume','','lifecycle-resume-01');
do $$begin
 begin perform public.complete_owner_visit('20000000-0000-4000-8000-000000000001',(select id from public.jobs),4,'[{"description":"Synthetic work","recordedMinutes":120,"chargedCents":12001,"waiverReason":""}]',true,'atomic-owner-work-01');raise exception 'TEST FAILED excess charge';exception when raise_exception then if sqlerrm<>'CHANGE_ORDER_REQUIRED' then raise;end if;end;
 begin perform public.complete_owner_visit('20000000-0000-4000-8000-000000000001',(select id from public.jobs),4,'[]',false,'atomic-owner-work-01');raise exception 'TEST FAILED unreviewed';exception when raise_exception then if sqlerrm<>'WORK_REVIEW_REQUIRED' then raise;end if;end;
end$$;
select pg_temp.assert_true((select revision=4 and status='working' from public.jobs),'failed completion leaves saved job unchanged');
select pg_temp.assert_true((select count(*)=1 from public.work_sessions where ended_at is null),'failed completion leaves the timer running');
select pg_temp.assert_true(public.invoice_labor_draft('20000000-0000-4000-8000-000000000001',(select id from public.jobs)) is null,'failed completion saves no draft');
select public.complete_owner_visit('20000000-0000-4000-8000-000000000001',(select id from public.jobs),4,'[{"description":"Synthetic actual work","recordedMinutes":120,"chargedCents":12000,"waiverReason":""}]',true,'atomic-owner-work-01');
select public.complete_owner_visit('20000000-0000-4000-8000-000000000001',(select id from public.jobs),4,'[{"description":"Synthetic actual work","recordedMinutes":120,"chargedCents":12000,"waiverReason":""}]',true,'atomic-owner-work-01');
select pg_temp.assert_true((select revision=6 and status='completed' from public.jobs),'atomic completion retry preserves one save and completion');
select pg_temp.assert_true((select count(*)=0 from public.work_sessions where ended_at is null),'atomic completion stops all work timers');
select pg_temp.assert_true((select count(*)=0 from public.invoices),'atomic completion does not issue an invoice');
select pg_temp.assert_true((select count(*)=0 from public.payments),'atomic completion does not manufacture funds');
do $$begin begin perform public.complete_owner_visit('20000000-0000-4000-8000-000000000001',(select id from public.jobs),4,'[{"description":"Changed actual work","recordedMinutes":120,"chargedCents":12000,"waiverReason":""}]',true,'atomic-owner-work-01');raise exception 'TEST FAILED changed retry';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
do $$begin begin perform public.complete_owner_visit('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000099',4,'[]',true,'atomic-owner-work-02');raise exception 'TEST FAILED other tenant';exception when insufficient_privilege then null;end;end$$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.complete_owner_visit(uuid,uuid,integer,jsonb,boolean,text)','execute'),'anonymous completion denied');
rollback;
