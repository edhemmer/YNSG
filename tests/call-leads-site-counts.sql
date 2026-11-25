-- Entire file runs inside the synthetic foundation transaction and rolls back.
-- Website call-back form: service role only, validated, replay-safe, throttled.
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$declare r jsonb;again jsonb;
begin
 r:=public.submit_callback_lead('20000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',repeat('a',64),'{"name":"Synthetic Caller","phone":"555-000-0000","need":"Leaf help next week","leadSource":"Nextdoor","referredBy":"Synthetic Neighbor"}');
 perform pg_temp.assert_true(r->>'ok'='true','call-back lead saves');
 again:=public.submit_callback_lead('20000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',repeat('a',64),'{"name":"Synthetic Caller","phone":"555-000-0000","need":"Leaf help next week","leadSource":"Nextdoor","referredBy":"Synthetic Neighbor"}');
 perform pg_temp.assert_true(r=again,'same key replays the same lead');
 begin perform public.submit_callback_lead('20000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',repeat('a',64),'{"name":"Other Caller","phone":"555-000-0000","need":"Different need"}');raise exception 'TEST FAILED changed replay';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;
 begin perform public.submit_callback_lead('20000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002',repeat('a',64),'{"name":"Synthetic Caller","phone":"555","need":"Too short phone"}');raise exception 'TEST FAILED short phone';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 begin perform public.submit_callback_lead('20000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003',repeat('a',64),'{"name":"Synthetic Caller","phone":"555-000-0000","need":"Extra key","email":"x@example.invalid"}');raise exception 'TEST FAILED extra key';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 begin perform public.submit_callback_lead('20000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000004',repeat('a',64),'{"name":"Synthetic Caller","phone":"555-000-0000","need":"Bad source","leadSource":"Billboard"}');raise exception 'TEST FAILED source';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 begin perform public.submit_callback_lead('20000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000005',repeat('a',64),'{"name":"<script>","phone":"555-000-0000","need":"Markup name"}');raise exception 'TEST FAILED markup';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 -- Five per client per hour (the first save counted once); the sixth new lead is refused.
 for i in 2..5 loop perform public.submit_callback_lead('20000000-0000-4000-8000-000000000001',('91000000-0000-4000-8000-00000000010'||i)::text,repeat('f',64),'{"name":"Synthetic Burst","phone":"555-000-0000","need":"Burst test"}');end loop;
 perform public.submit_callback_lead('20000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000106',repeat('f',64),'{"name":"Synthetic Burst","phone":"555-000-0000","need":"Burst test"}');
 begin perform public.submit_callback_lead('20000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000107',repeat('f',64),'{"name":"Synthetic Burst","phone":"555-000-0000","need":"Burst test"}');raise exception 'TEST FAILED throttle';exception when raise_exception then if sqlerrm<>'RATE_LIMITED' then raise;end if;end;
 -- Site counts: anonymous totals, quiet throttle, strict fields.
 perform public.record_site_event('20000000-0000-4000-8000-000000000001',repeat('b',64),'view','/','google');
 perform public.record_site_event('20000000-0000-4000-8000-000000000001',repeat('b',64),'view','/','google');
 perform public.record_site_event('20000000-0000-4000-8000-000000000001',repeat('c',64),'call_tap','/lawn-mowing-dekalb-il','direct');
 begin perform public.record_site_event('20000000-0000-4000-8000-000000000001',repeat('b',64),'view','https://evil.example','google');raise exception 'TEST FAILED page';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 begin perform public.record_site_event('20000000-0000-4000-8000-000000000001',repeat('b',64),'purchase','/','google');raise exception 'TEST FAILED kind';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 for i in 1..125 loop perform public.record_site_event('20000000-0000-4000-8000-000000000001',repeat('d',64),'view','/services','bing');end loop;
end$$;
reset role;
-- Browser roles cannot touch the tables or call the server-only commands.
select pg_temp.assert_true(not has_table_privilege('authenticated','public.call_leads','select'),'call leads are not readable by browser roles');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.submit_callback_lead(uuid,text,text,jsonb)','execute'),'call-back intake is server-only');
select pg_temp.assert_true(not has_function_privilege('anon','public.record_site_event(uuid,text,text,text,text)','execute'),'site counts are server-only');
select pg_temp.assert_true((select sum(count)=120 from private.site_daily_counts where page='/services'),'site counts stop quietly at the hourly client limit');
-- Owner call list and logging a phone call.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$declare list jsonb;r jsonb;id uuid;counts jsonb;
begin
 list:=public.owner_call_leads('20000000-0000-4000-8000-000000000001');
 perform pg_temp.assert_true(jsonb_array_length(list->'items')=6 and (list->'counts'->>'open')::int=6,'owner sees every open call-back');
 r:=public.owner_save_call_lead('20000000-0000-4000-8000-000000000001','{"id":null,"name":"Synthetic Phone Caller","phone":"555-000-0001","need":"Snow list for winter","leadSource":"Friend, family or neighbor","followUpOn":"2026-12-02"}');
 perform pg_temp.assert_true(r->'lead'->>'origin'='phone' and r->'lead'->>'status'='called','a logged phone call saves as called');
 id:=(r->'lead'->>'id')::uuid;
 r:=public.owner_save_call_lead('20000000-0000-4000-8000-000000000001',jsonb_build_object('id',id,'status','booked','note','Booked for the first snow'));
 perform pg_temp.assert_true(r->'lead'->>'status'='booked' and r->'lead'->>'followUpOn'='2026-12-02' and r->'lead'->>'note'='Booked for the first snow','status and note update without losing the follow-up');
 begin perform public.owner_save_call_lead('20000000-0000-4000-8000-000000000001',jsonb_build_object('id',id,'status','won'));raise exception 'TEST FAILED status';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 begin perform public.owner_save_call_lead('20000000-0000-4000-8000-000000000001',jsonb_build_object('id',id,'followUpOn','2026-02-31'));raise exception 'TEST FAILED date';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 begin perform public.owner_save_call_lead('20000000-0000-4000-8000-000000000001','{"id":"91000000-0000-4000-8000-0000000009ff","status":"closed"}');raise exception 'TEST FAILED missing';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 counts:=public.owner_site_counts('20000000-0000-4000-8000-000000000001',30);
 perform pg_temp.assert_true((counts->'totals'->>'view')::int=122 and (counts->'totals'->>'call_tap')::int=1,'owner reads anonymous site totals');
 begin perform public.owner_call_leads('20000000-0000-4000-8000-000000000002');raise exception 'TEST FAILED tenant';exception when insufficient_privilege then null;end;
 begin perform public.owner_site_counts('20000000-0000-4000-8000-000000000002',30);raise exception 'TEST FAILED tenant counts';exception when insufficient_privilege then null;end;
end$$;
reset role;
-- Optional referral name rides on a normal website request and is validated.
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.submit_service_request('20000000-0000-4000-8000-000000000001','referral-key-0001',repeat('e',64),'{"service":"Lawn care","name":"Synthetic Referral","phone":"5550000000","email":"referral@example.invalid","street":"100 Test Street","city":"DeKalb","postalCode":"60115","description":"Synthetic referral test request","communityRate":"No","leadSource":"Friend, family or neighbor","referredBy":"Synthetic Friend"}');
do $$begin begin perform public.submit_service_request('20000000-0000-4000-8000-000000000001','referral-key-0002',repeat('e',64),'{"service":"Lawn care","name":"Synthetic Bad Referral","phone":"5550000000","email":"badref@example.invalid","street":"100 Test Street","city":"DeKalb","postalCode":"60115","description":"Synthetic referral test request","communityRate":"No","referredBy":"x"}');raise exception 'TEST FAILED referral';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;end$$;
reset role;
select pg_temp.assert_true((select original_submission->>'referredBy'='Synthetic Friend' from public.service_requests where original_submission->>'name'='Synthetic Referral'),'referral name survives in the immutable submission');
rollback;
