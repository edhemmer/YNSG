-- Starts with the foundation prefix; only synthetic, rollback-only identities.
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000000005','new@example.invalid',now());
insert into auth.sessions(id,user_id,aal) values('10000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000005','aal1');
update public.organizations set status='active';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000005","session_id":"10000000-0000-4000-8000-000000000005","aal":"aal1","user_metadata":{"role":"owner"}}',true);
create function pg_temp.profile(p_key uuid default '90000000-0000-4000-8000-000000000001',p_data jsonb default '{"name":"New Synthetic","phone":"5550000000","street":"100 Synthetic Lane","city":"DeKalb","postalCode":"60115"}') returns jsonb language sql as $$select public.create_customer_profile('20000000-0000-4000-8000-000000000001',p_key,p_data)$$;
select pg_temp.profile();select pg_temp.profile();
select pg_temp.assert_true((select count(*)=1 from public.customers),'only self profile visible after replay');
select pg_temp.assert_true((select count(*)=1 from public.properties),'one self address');
select pg_temp.assert_true((select count(*)=0 from public.memberships),'cannot grant staff via editable metadata');
select pg_temp.assert_true(jsonb_array_length(public.customer_intake_context('20000000-0000-4000-8000-000000000001')->'contacts')=1,'new account can request service without owner linking');
select public.submit_customer_request('20000000-0000-4000-8000-000000000001',(pg_temp.profile()->>'contact')::uuid,(pg_temp.profile()->>'property')::uuid,'new-profile-request-0001','{"services":[{"service":"Lawn care","task":"Mowing"}],"description":"","preferredTime":"Next week","communityRate":"No","postalCode":"60115"}');
select pg_temp.assert_true((select count(*)=1 from public.service_requests),'request is linked and visible immediately');
select pg_temp.assert_true((select original_submission->>'email'='new@example.invalid' from public.service_requests),'email comes from verified identity');
do $$begin
 begin perform pg_temp.profile('90000000-0000-4000-8000-000000000002');raise exception 'TEST FAILED duplicate profile';exception when raise_exception then if sqlerrm<>'PROFILE_EXISTS' then raise;end if;end;
 begin perform pg_temp.profile('90000000-0000-4000-8000-000000000001','{"name":"Changed Synthetic","phone":"5550000000","street":"100 Synthetic Lane","city":"DeKalb","postalCode":"60115"}');raise exception 'TEST FAILED changed retry';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;
 begin perform pg_temp.profile('90000000-0000-4000-8000-000000000002','{"name":"New Synthetic","phone":"5550000000","street":"100 Synthetic Lane","city":"DeKalb","postalCode":"60178"}');raise exception 'TEST FAILED wrong ZIP';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 begin perform pg_temp.profile('90000000-0000-4000-8000-000000000002','{"name":"New Synthetic","phone":"5550000000","street":"100 Synthetic Lane","city":"DeKalb","postalCode":"60115","customer":"30000000-0000-4000-8000-000000000001"}');raise exception 'TEST FAILED forged customer';exception when raise_exception then if sqlerrm<>'VALIDATION' then raise;end if;end;
 begin perform public.create_customer_profile('20000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002','{"name":"New Synthetic","phone":"5550000000","street":"100 Synthetic Lane","city":"DeKalb","postalCode":"60115"}');raise exception 'TEST FAILED other company setup';exception when raise_exception then if sqlerrm<>'SETUP_REQUIRED' then raise;end if;end;
end$$;
reset role;
select pg_temp.assert_true((select count(*)=1 from public.audit_events where action='customer.self_enrolled'),'one profile audit');
select pg_temp.assert_true((select count(*)=1 from public.outbox),'profile creation does not send mail; request queues one notice');
update public.customer_access set revoked_at=now() where user_id='00000000-0000-4000-8000-000000000005';
set local role authenticated;
do $$begin
 begin perform pg_temp.profile();raise exception 'TEST FAILED revoked replay';exception when insufficient_privilege then null;end;
 begin perform pg_temp.profile('90000000-0000-4000-8000-000000000003');raise exception 'TEST FAILED bypass revocation';exception when insufficient_privilege then null;end;
end$$;
reset role;
update auth.users set email_confirmed_at=null where id='00000000-0000-4000-8000-000000000005';
set local role authenticated;
do $$begin begin perform pg_temp.profile();raise exception 'TEST FAILED unconfirmed';exception when insufficient_privilege then null;end;end$$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.create_customer_profile(uuid,uuid,jsonb)','EXECUTE'),'anonymous enrollment denied');
select pg_temp.assert_true(not has_function_privilege('service_role','public.create_customer_profile(uuid,uuid,jsonb)','EXECUTE'),'server cannot impersonate enrolling identity');
rollback;
