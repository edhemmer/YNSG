insert into public.entitlements values('20000000-0000-4000-8000-000000000001','scheduling',true);
-- Explicit synthetic reserved appointment exercises the existing travel buffer conflict.
insert into public.service_requests(organization_id,id,service_id,original_submission,privacy_version)
 select organization_id,'50000000-0000-4000-8000-000000000001',id,'{}','test' from public.catalog_services;
insert into public.appointments(organization_id,id,request_id,start_at,end_at,arrival_at,timezone,status)
 values('20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',now()+interval '20 days',now()+interval '20 days 2 hours',now()+interval '20 days','America/Chicago','reserved');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.manage_calendar_block('20000000-0000-4000-8000-000000000001',null,null,now()+interval '10 days',now()+interval '11 days',false,'owner-block-test-key-01');
select public.manage_calendar_block('20000000-0000-4000-8000-000000000001',null,null,now()+interval '10 days',now()+interval '11 days',false,'owner-block-test-key-01');
select pg_temp.assert_true(jsonb_array_length(public.owner_calendar_blocks('20000000-0000-4000-8000-000000000001'))=1,'block retry creates one row');
select pg_temp.assert_true(not (public.owner_calendar_blocks('20000000-0000-4000-8000-000000000001')->0 ? 'reason'),'block API never returns reasons');
do $$begin begin perform public.owner_calendar_blocks('20000000-0000-4000-8000-000000000002');raise exception 'TEST FAILED cross tenant blocks';exception when insufficient_privilege then null;end;end$$;
do $$begin begin perform public.manage_calendar_block('20000000-0000-4000-8000-000000000001',null,null,now()+interval '20 days' -interval '1 hour',now()+interval '20 days'-interval '15 minutes',false,'owner-block-conflict01');raise exception 'TEST FAILED travel buffer overlap';exception when raise_exception then if sqlerrm<>'CAPACITY_CONFLICT' then raise;end if;end;end$$;
-- Original block and actor/input receipt stay stable across later revisions.
do $$declare b jsonb;reply jsonb;begin
 b:=public.owner_calendar_blocks('20000000-0000-4000-8000-000000000001')->0;
 begin perform public.manage_calendar_block('20000000-0000-4000-8000-000000000001',null,null,now()+interval '10 days',now()+interval '11 days 1 hour',false,'owner-block-test-key-01');raise exception 'TEST FAILED changed create retry';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;
 reply:=public.manage_calendar_block('20000000-0000-4000-8000-000000000001',(b->>'id')::uuid,1,now()+interval '12 days',now()+interval '13 days',false,'owner-block-edit-key-01');
 perform pg_temp.assert_true(reply->>'revision'='2' and reply->>'removed'='false','block edit increments revision');
 reply:=public.manage_calendar_block('20000000-0000-4000-8000-000000000001',(b->>'id')::uuid,1,now()+interval '12 days',now()+interval '13 days',false,'owner-block-edit-key-01');
 perform pg_temp.assert_true(reply->>'revision'='2','lost edit response replays original receipt');
 reply:=public.manage_calendar_block('20000000-0000-4000-8000-000000000001',null,null,now()+interval '10 days',now()+interval '11 days',false,'owner-block-test-key-01');
 perform pg_temp.assert_true(reply->>'revision'='1','lost create response does not adopt newer revision');
 begin perform public.manage_calendar_block('20000000-0000-4000-8000-000000000001',(b->>'id')::uuid,1,null,null,true,'owner-block-stale-key');raise exception 'TEST FAILED stale removal';exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;
 perform pg_temp.assert_true(jsonb_array_length(public.owner_calendar_blocks('20000000-0000-4000-8000-000000000001'))=1,'stale removal preserves block');
end$$;
select public.manage_calendar_block('20000000-0000-4000-8000-000000000001',(public.owner_calendar_blocks('20000000-0000-4000-8000-000000000001')->0->>'id')::uuid,2,null,null,true,'owner-block-test-key-02');
-- Removal replay succeeds even though its original row is no longer present.
do $$declare receipt jsonb;begin
 -- The create replay retains the exact ID without reading private tables.
 receipt:=public.manage_calendar_block('20000000-0000-4000-8000-000000000001',null,null,now()+interval '10 days',now()+interval '11 days',false,'owner-block-test-key-01');
 receipt:=public.manage_calendar_block('20000000-0000-4000-8000-000000000001',(receipt->>'id')::uuid,2,null,null,true,'owner-block-test-key-02');
 perform pg_temp.assert_true(receipt->>'removed'='true' and receipt->>'revision'='2','lost removal response replays original receipt');
end$$;
select pg_temp.assert_true(jsonb_array_length(public.owner_calendar_blocks('20000000-0000-4000-8000-000000000001'))=0,'owner can release blocked time');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
do $$begin begin perform public.owner_calendar_blocks('20000000-0000-4000-8000-000000000001');raise exception 'TEST FAILED customer reads blocks';exception when insufficient_privilege then null;end;end$$;
reset role;
select pg_temp.assert_true((select count(*)=3 from public.audit_events),'block create, edit and release audited once');
select pg_temp.assert_true((select revision=4 from private.schedule_state where organization_id='20000000-0000-4000-8000-000000000001'),'blocks invalidate stale scheduling reviews');
insert into public.memberships(organization_id,user_id,role) values('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','admin');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
do $$begin begin perform public.manage_calendar_block('20000000-0000-4000-8000-000000000001',null,null,now()+interval '10 days',now()+interval '11 days',false,'owner-block-test-key-01');raise exception 'TEST FAILED other actor replay';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;end$$;
reset role;
update public.memberships set revoked_at=now() where organization_id='20000000-0000-4000-8000-000000000001' and user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$begin begin perform public.manage_calendar_block('20000000-0000-4000-8000-000000000001',null,null,now()+interval '10 days',now()+interval '11 days',false,'owner-block-test-key-01');raise exception 'TEST FAILED revoked owner replay';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
