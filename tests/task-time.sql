-- Isolated synthetic approved-state fixture. Transaction and auth come from foundation prefix.
insert into public.service_requests(organization_id,id,customer_id,service_id,privacy_version,original_submission)
select organization_id,'41000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',id,'test-only','{"name":"Synthetic customer","email":"synthetic@example.invalid","phone":"5550000000"}' from public.catalog_services where organization_id='20000000-0000-4000-8000-000000000001';
insert into public.quotes(organization_id,id,request_id,customer_id,status) values('20000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','accepted');
insert into public.quote_versions(organization_id,quote_id,version,scope,labor_cents,duration_minutes,snapshot) values('20000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001',1,'Synthetic approved lock and washing work',12000,120,'{}');
insert into public.approvals(organization_id,quote_id,version,actor_id,evidence,method) values('20000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001',1,'00000000-0000-4000-8000-000000000001','Synthetic fixture agreement','recorded_by_staff');
insert into public.jobs(organization_id,id,quote_id,approved_version,customer_id,status) values('20000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001',1,'30000000-0000-4000-8000-000000000001','working');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
create function pg_temp.task_command(a text,extra jsonb,k text) returns jsonb language sql as $$select public.task_time_command('20000000-0000-4000-8000-000000000001',jsonb_build_object('organization','20000000-0000-4000-8000-000000000001','job','43000000-0000-4000-8000-000000000001','jobRevision',1,'action',a,'key',k)||extra)$$;
do $$declare a jsonb;b jsonb;r jsonb;session_id uuid;begin
 a:=pg_temp.task_command('plan','{"service":"Help around the home","name":"Smart lock installation","plannedMinutes":120}','task-time-plan-lock-001');
 perform pg_temp.assert_true(a=pg_temp.task_command('plan','{"service":"Help around the home","name":"Smart lock installation","plannedMinutes":120}','task-time-plan-lock-001'),'same-command replay');
 begin perform pg_temp.task_command('plan','{"service":"Help around the home","name":"Smart lock installation","plannedMinutes":121}','task-time-plan-lock-001');raise exception 'TEST FAILED changed retry';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;
 b:=pg_temp.task_command('plan','{"service":"Concrete pressure washing","name":"Concrete patio","plannedMinutes":150}','task-time-plan-wash-001');
 r:=pg_temp.task_command('start',jsonb_build_object('task',a->>'task','revision',1),'task-time-start-lock-001');
 perform pg_temp.assert_true((r->>'revision')::int=2,'start advances task revision');
 begin perform pg_temp.task_command('pause',jsonb_build_object('task',a->>'task','revision',1),'task-time-stale-lock-001');raise exception 'TEST FAILED stale accepted';exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;
 r:=pg_temp.task_command('start',jsonb_build_object('task',b->>'task','revision',1),'task-time-switch-wash-001');
 r:=public.owner_task_time('20000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001');
 perform pg_temp.assert_true((select count(*)=1 from jsonb_array_elements(r->'tasks') t cross join lateral jsonb_array_elements(t->'sessions') s where s->>'endedAt' is null),'switch leaves exactly one task running');
 r:=pg_temp.task_command('pause',jsonb_build_object('task',b->>'task','revision',2),'task-time-pause-wash-001');
 r:=pg_temp.task_command('finish',jsonb_build_object('task',a->>'task','revision',2),'task-time-finish-lock-001');
 begin perform pg_temp.task_command('allocate',jsonb_build_object('task',a->>'task','revision',3,'cents',10000,'reason','Synthetic allocation review'),'task-time-allocate-none-001');raise exception 'TEST FAILED unissued allocation';exception when raise_exception then if sqlerrm<>'ALLOCATION_EXCEEDS_LABOR' then raise;end if;end;
 begin perform public.owner_task_time('20000000-0000-4000-8000-000000000002',null,'2026-10');raise exception 'TEST FAILED cross tenant';exception when insufficient_privilege then null;end;
end$$;
reset role;
select pg_temp.assert_true((select count(*)=0 from public.invoices),'task work never invoices');
select pg_temp.assert_true((select count(*)=0 from public.work_sessions),'task evidence never creates duplicate visit sessions');
-- Simulate long elapsed work only in this disposable fixture, then exercise reviewed corrections.
update private.job_task_sessions set started_at='2026-10-01 04:30:00+00',ended_at='2026-10-01 06:30:00+00' where task_id=(select id from private.job_task_plans where name='Smart lock installation');
update private.job_task_sessions set started_at='2026-10-02 10:00:00+00',ended_at='2026-10-02 13:12:00+00' where task_id=(select id from private.job_task_plans where name='Concrete patio');
update private.job_task_plans set finished_at='2026-10-02 13:12:00+00';
set local role authenticated;
do $$declare t jsonb;r jsonb;s jsonb;begin
 r:=public.owner_task_time('20000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001');
 for t in select value from jsonb_array_elements(r->'tasks') loop
  s:=t->'sessions'->0;
  perform pg_temp.task_command('review',jsonb_build_object('task',t->>'id','revision',t->'revision','session',s->>'id','startedAt',s->>'startedAt','endedAt',case when t->>'name'='Smart lock installation' then '2026-10-01T05:50:00+00:00' else s->>'endedAt' end,'reason','Verified synthetic actual work interval'),'task-time-review-'||(t->>'id'));
 end loop;
 r:=public.owner_task_time('20000000-0000-4000-8000-000000000001',null,'2026-10');
 perform pg_temp.assert_true((r->>'unreviewedSessions')::int=0,'reviewed intervals leave no hidden pending time');
 select value into t from jsonb_array_elements(r->'items') where value->>'name'='Smart lock installation';
 perform pg_temp.assert_true((t->>'reviewedSeconds')::numeric=3000,'month clips lock interval at Central midnight');
 perform pg_temp.assert_true((t->>'completedSeconds')::numeric=4800 and (t->>'plannedMinutes')::int=120,'planned two hours versus actual eighty minutes retained');
 select value into t from jsonb_array_elements(r->'items') where value->>'name'='Concrete patio';
 perform pg_temp.assert_true((t->>'reviewedSeconds')::numeric=11520 and (t->>'plannedMinutes')::int=150,'washing planned 2.5h versus actual 3.2h retained');
end$$;
reset role;
select pg_temp.assert_true((select count(*)=2 from private.job_task_reviews),'reviews retain audit snapshots');
select pg_temp.assert_true((select extract(epoch from ended_at-started_at)=7200 from private.job_task_sessions where task_id=(select id from private.job_task_plans where name='Smart lock installation')),'correction retains raw two-hour evidence');
-- Isolated issued-ledger fixture tests assignment, not invoice creation.
insert into public.properties(organization_id,id,customer_id,street,city,region) values('20000000-0000-4000-8000-000000000001','47000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','100 Synthetic St','DeKalb','IL');
insert into public.invoices(organization_id,id,job_id,customer_id,number,total_cents,snapshot,issued_at) values('20000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',99999,12000,'{"propertyId":"47000000-0000-4000-8000-000000000001"}','2026-10-02T14:00:00Z');
insert into public.journal_entries(organization_id,id,source_kind,source_id) values('20000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','invoice','45000000-0000-4000-8000-000000000001');
insert into public.journal_lines(organization_id,entry_id,account,credit_cents,debit_cents) values('20000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','labor_revenue',12000,0),('20000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','receivable',0,12000);
set local role authenticated;
do $$declare r jsonb;t jsonb;n integer:=0;begin
 r:=public.owner_task_time('20000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001');
 for t in select value from jsonb_array_elements(r->'tasks') loop
  n:=n+1;
  if n=2 then begin perform pg_temp.task_command('allocate',jsonb_build_object('task',t->>'id','revision',t->'revision','cents',8000,'reason','Synthetic reviewed labor allocation'),'task-over-allocation-001');raise exception 'TEST FAILED excess allocation';exception when raise_exception then if sqlerrm<>'ALLOCATION_EXCEEDS_LABOR' then raise;end if;end;end if;
  perform pg_temp.task_command('allocate',jsonb_build_object('task',t->>'id','revision',t->'revision','cents',case when n=1 then 8000 else 4000 end,'reason','Synthetic reviewed labor allocation'),'task-valid-allocation-'||n);
 end loop;
 r:=public.owner_task_time('20000000-0000-4000-8000-000000000001',null,'2026-10');
 perform pg_temp.assert_true((r->>'grossLaborCents')::int=12000 and (r->>'unallocatedCents')::int=0,'issued labor assignments reconcile to original gross labor');
 perform pg_temp.assert_true((select sum((x->>'allocatedCents')::int)=12000 from jsonb_array_elements(r->'items') x),'job-type labor is never duplicated across a combined invoice');
end$$;
reset role;
update public.memberships set revoked_at=now() where user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin begin perform public.owner_task_time('20000000-0000-4000-8000-000000000001',null,'2026-10');raise exception 'TEST FAILED revocation';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
