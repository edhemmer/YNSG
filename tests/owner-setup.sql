-- Rolled-back foundation fixtures; no live identities or messages.
update auth.users set email='invited@example.invalid' where id='00000000-0000-4000-8000-000000000003';
insert into private.owner_setup_invitations(email,slug,display_name,timezone,expires_at)
values('invited@example.invalid','setup-test','Synthetic Owner','America/Chicago',now()+interval '1 hour');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1","email":"invited@example.invalid"}',true);
select pg_temp.assert_true(not (public.owner_setup(false)->>'eligible')::boolean,'JWT email cannot claim invitation');
do $$begin begin perform public.owner_setup(true);raise exception 'TEST FAILED noninvite claim';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
select pg_temp.assert_true((public.owner_setup(false)->>'eligible')::boolean,'verified invited owner sees setup');
select pg_temp.assert_true((public.owner_setup(true)->>'claimed')::boolean,'email-verified AAL1 owner claims invitation');
do $$begin begin perform 1 from private.owner_setup_invitations;raise exception 'TEST FAILED exposed invitations';exception when insufficient_privilege then null;end;end$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
select pg_temp.assert_true((public.owner_setup(true)->>'claimed')::boolean,'email-verified owner claim remains idempotent');
select pg_temp.assert_true((public.owner_setup(true)->>'claimed')::boolean,'repeat is idempotent');
select pg_temp.assert_true(public.google_access((public.owner_setup(false)->>'organization')::uuid),'new owner can access Google controls');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.organizations where slug='setup-test'),'one organization only');
select pg_temp.assert_true((select count(*)=1 from public.audit_events where action='owner_setup_claimed'),'one audit event');
select pg_temp.assert_true(not exists(select 1 from public.integration_connections where status='active'),'does not enable delivery');
update public.memberships set revoked_at=now() where user_id='00000000-0000-4000-8000-000000000003';
set local role authenticated;
do $$begin begin perform public.owner_setup(true);raise exception 'TEST FAILED revoked membership restored';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
