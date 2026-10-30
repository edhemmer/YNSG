-- Synthetic records only; outer foundation transaction rolls everything back.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001"}',true);
create function pg_temp.network_profile() returns jsonb language sql as $$select '{"name":"Synthetic Contractor","businessName":"Test Trades","title":"Owner","phone":"5550000000","alternatePhone":"","email":"test@example.invalid","website":"https://example.invalid","address":"Private fixture address","referralSource":"Private source","notes":"Private fixture notes","social":[{"label":"Social","url":"https://example.invalid/social"}],"categories":["Electrician","Painting"],"vettingStatus":"not_vetted","vettingBasis":""}'::jsonb$$;
create function pg_temp.network_body(k text,rev integer,p jsonb default pg_temp.network_profile()) returns text language sql as $$select jsonb_build_object('organization','20000000-0000-4000-8000-000000000001','id','a1000000-0000-4000-8000-000000000001','key',k,'revision',rev,'action','save','profile',p,'attestVetting',false)::text$$;
do $$declare body text;r jsonb;s jsonb;begin
 body:=pg_temp.network_body('a2000000-0000-4000-8000-000000000001',0);
 r:=public.owner_network_command('20000000-0000-4000-8000-000000000001',body);
 perform pg_temp.assert_true(r->>'revision'='1','new contact');
 perform pg_temp.assert_true(r=public.owner_network_command('20000000-0000-4000-8000-000000000001',body),'exact replay');
 begin perform public.owner_network_command('20000000-0000-4000-8000-000000000001',replace(body,'5550000000','5550000001'));raise exception 'TEST FAILED changed retry';exception when others then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;
 begin perform public.owner_network_command('20000000-0000-4000-8000-000000000001',pg_temp.network_body('a2000000-0000-4000-8000-000000000002',0));raise exception 'TEST FAILED stale';exception when others then if sqlerrm<>'STALE_REVISION' then raise;end if;end;
 s:=public.owner_network_read('20000000-0000-4000-8000-000000000001','{"query":"Painting"}');
 perform pg_temp.assert_true(s->>'matching'='1' and jsonb_array_length(s->'categories')=2,'multi-category search');
 perform pg_temp.assert_true((s->'items'->0->>'name')='Synthetic Contractor','bounded list contact');
 begin perform public.owner_network_read('20000000-0000-4000-8000-000000000002','{}');raise exception 'TEST FAILED cross tenant';exception when insufficient_privilege then null;end;
 -- Resolve absence under the same key lock permanently cancels a late original.
 body:=pg_temp.network_body('a2000000-0000-4000-8000-000000000003',1);
 r:=public.owner_network_command('20000000-0000-4000-8000-000000000001',jsonb_build_object('organization','20000000-0000-4000-8000-000000000001','id','a1000000-0000-4000-8000-000000000001','key','a2000000-0000-4000-8000-000000000003','revision',1,'action','resolve','operation','save','fingerprint',encode(sha256(convert_to(body,'UTF8')),'hex'))::text);
 perform pg_temp.assert_true(r->>'outcome'='not_applied','absent result gets tombstone');
 perform pg_temp.assert_true(r=public.owner_network_command('20000000-0000-4000-8000-000000000001',body),'late original stays not applied');
 body:=pg_temp.network_body('a2000000-0000-4000-8000-000000000004',1,pg_temp.network_profile()||'{"vettingStatus":"known_work","vettingBasis":"I inspected the completed synthetic work."}');
 begin perform public.owner_network_command('20000000-0000-4000-8000-000000000001',body);raise exception 'TEST FAILED missing attestation';exception when others then if sqlerrm<>'ATTESTATION_REQUIRED' then raise;end if;end;
 perform public.owner_network_command('20000000-0000-4000-8000-000000000001',(body::jsonb||'{"attestVetting":true}')::text);
 s:=public.owner_network_read('20000000-0000-4000-8000-000000000001','{"id":"a1000000-0000-4000-8000-000000000001"}');
 perform pg_temp.assert_true(s->'contact'->>'vettedBy'='00000000-0000-4000-8000-000000000001' and s->'contact'->>'vettedAt' is not null,'server attributed firsthand badge');
end$$;
reset role;
select pg_temp.assert_true((select count(*)=1 from private.owner_network_vetting_history),'retained vetting review');
update public.memberships set role='admin' where user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$declare p jsonb;begin
 p:=pg_temp.network_profile()||'{"vettingStatus":"known_work","vettingBasis":"I inspected the completed synthetic work."}';
 begin perform public.owner_network_command('20000000-0000-4000-8000-000000000001',(pg_temp.network_body('a2000000-0000-4000-8000-000000000005',2,p||'{"name":"Other person"}')::jsonb||'{"attestVetting":true}')::text);raise exception 'TEST FAILED admin badge transfer';exception when insufficient_privilege then null;end;
 perform public.owner_network_command('20000000-0000-4000-8000-000000000001',pg_temp.network_body('a2000000-0000-4000-8000-000000000006',2,p||'{"phone":"5550000001"}'));
 begin perform public.owner_network_command('20000000-0000-4000-8000-000000000001',pg_temp.network_body('a2000000-0000-4000-8000-000000000007',3,p||'{"categories":["Lawyer"]}'));raise exception 'TEST FAILED admin category badge';exception when insufficient_privilege then null;end;
 begin perform public.owner_network_command('20000000-0000-4000-8000-000000000001',pg_temp.network_body('a2000000-0000-4000-8000-000000000008',3,p||'{"website":"javascript:alert(1)"}'));raise exception 'TEST FAILED unsafe URL';exception when others then if sqlerrm<>'VALIDATION' then raise;end if;end;
end$$;
do $$declare r jsonb;s jsonb;begin
 r:=public.owner_network_card('20000000-0000-4000-8000-000000000001',jsonb_build_object('action','reserve','contact','a1000000-0000-4000-8000-000000000001','key','a3000000-0000-4000-8000-000000000001','name','synthetic.png','mime','image/png','bytes',8,'sha256',repeat('a',64)));
 s:=public.owner_network_card('20000000-0000-4000-8000-000000000001',jsonb_build_object('action','reserve','contact','a1000000-0000-4000-8000-000000000001','key','a3000000-0000-4000-8000-000000000002','name','same-bytes.png','mime','image/png','bytes',8,'sha256',repeat('a',64)));
 perform pg_temp.assert_true(r->>'id'=s->>'id','same photo deduplicates across keys');
 perform pg_temp.assert_true(private.network_card_permission(r->>'path',true),'pending actor upload permitted');
 insert into storage.objects(bucket_id,name) values('ynsg-customer-files',r->>'path');
 begin perform public.confirm_network_card('20000000-0000-4000-8000-000000000001',(r->>'id')::uuid,'00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','image/png',8,repeat('a',64));raise exception 'TEST FAILED client verifies bytes';exception when insufficient_privilege then null;end;
 begin perform public.owner_network_card('20000000-0000-4000-8000-000000000001',jsonb_build_object('action','access','file',r->>'id'));raise exception 'TEST FAILED pending photo opened';exception when others then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
end$$;
reset role;
do $$declare f private.owner_network_cards;begin
 select * into f from private.owner_network_cards limit 1;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform public.confirm_network_card(f.organization_id,f.id,'00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',f.mime,f.bytes,f.sha256);
 perform pg_temp.assert_true((select status='ready' from private.owner_network_cards where id=f.id),'server proof saves card');
end$$;
update private.owner_network_cards set archived_at=now();
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001"}',true);
select public.owner_network_card('20000000-0000-4000-8000-000000000001',jsonb_build_object('action','reserve','contact','a1000000-0000-4000-8000-000000000001','key','a3000000-0000-4000-8000-000000000003','name','unfinished.png','mime','image/png','bytes',8,'sha256',repeat('b',64)));
reset role;
-- NETWORK_CATALOG_ASSERTION
update public.memberships set revoked_at=now() where user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin begin perform public.owner_network_read('20000000-0000-4000-8000-000000000001','{}');raise exception 'TEST FAILED revoked member';exception when insufficient_privilege then null;end;end$$;
reset role;
select pg_temp.assert_true((select count(*)=0 from public.service_requests),'directory never creates leads');
select pg_temp.assert_true((select count(*)=0 from public.outbox),'directory never sends messages');
rollback;
