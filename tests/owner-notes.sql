-- Request notes exist before account linking; customer history follows explicit linkage only.
insert into public.service_requests(organization_id,id,service_id,original_submission,privacy_version)
select organization_id,'50000000-0000-4000-8000-000000000001',id,'{}','synthetic' from public.catalog_services where organization_id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.add_relationship_note('20000000-0000-4000-8000-000000000001','request','50000000-0000-4000-8000-000000000001','Synthetic customer called about the visit','note-request-key-0001');
select public.add_relationship_note('20000000-0000-4000-8000-000000000001','request','50000000-0000-4000-8000-000000000001','Synthetic customer called about the visit','note-request-key-0001');
select pg_temp.assert_true(jsonb_array_length(public.read_relationship_notes('20000000-0000-4000-8000-000000000001','request','50000000-0000-4000-8000-000000000001',0)->'notes')=1,'retry produces one request note');
do $$begin begin perform public.add_relationship_note('20000000-0000-4000-8000-000000000001','request','50000000-0000-4000-8000-000000000001','Changed note','note-request-key-0001');raise exception 'TEST FAILED changed replay';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;end$$;
select pg_temp.assert_true(jsonb_array_length(public.read_relationship_notes('20000000-0000-4000-8000-000000000001','customer','30000000-0000-4000-8000-000000000001',0)->'notes')=0,'unlinked request not guessed onto customer');
do $$begin begin update private.relationship_notes set body='Overwritten';raise exception 'TEST FAILED direct overwrite';exception when insufficient_privilege then null;end;end$$;
reset role;
update public.service_requests set customer_id='30000000-0000-4000-8000-000000000001' where id='50000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.add_relationship_note('20000000-0000-4000-8000-000000000001','customer','30000000-0000-4000-8000-000000000001','Synthetic follow-up contact','note-customer-key-01');
select pg_temp.assert_true(jsonb_array_length(public.read_relationship_notes('20000000-0000-4000-8000-000000000001','customer','30000000-0000-4000-8000-000000000001',0)->'notes')=2,'customer history retains direct and linked-request notes');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
do $$begin begin perform public.read_relationship_notes('20000000-0000-4000-8000-000000000001','customer','30000000-0000-4000-8000-000000000001',0);raise exception 'TEST FAILED customer reads internal notes';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
do $$begin begin perform public.read_relationship_notes('20000000-0000-4000-8000-000000000001','request','50000000-0000-4000-8000-000000000001',0);raise exception 'TEST FAILED other company reads notes';exception when insufficient_privilege then null;end;end$$;
reset role;
select pg_temp.assert_true((select count(*)=2 from private.relationship_notes),'two notes only');
select pg_temp.assert_true((select count(*)=2 from public.audit_events where action='relationship.note_added'),'one audit per note');
update public.memberships set revoked_at=now() where user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$begin begin perform public.add_relationship_note('20000000-0000-4000-8000-000000000001','customer','30000000-0000-4000-8000-000000000001','Revoked actor','note-revoked-key-01');raise exception 'TEST FAILED revoked owner';exception when insufficient_privilege then null;end;end$$;
reset role;rollback;
