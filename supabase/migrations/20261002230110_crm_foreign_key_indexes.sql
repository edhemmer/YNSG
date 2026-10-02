-- Cover all 17 app-owned foreign-key gaps reported by the hosted database advisor.
create index google_oauth_states_company on private.google_oauth_states(organization_id);
create index mail_controls_configuration on private.mail_delivery_controls(organization_id,configuration_version);
create index mail_controls_receipt_actor on private.mail_delivery_controls(receipt_confirmed_by);
create index setup_invitations_claim_actor on private.owner_setup_invitations(claimed_by);
create index setup_invitations_company on private.owner_setup_invitations(organization_id);
create index scheduling_reviews_actor on private.scheduling_reviews(actor_id);
create index scheduling_reviews_evidence on private.scheduling_reviews(organization_id,evidence_id);
create index scheduling_reviews_request on private.scheduling_reviews(organization_id,request_id);
create index appointments_created_actor on public.appointments(created_by);
create index approvals_actor on public.approvals(actor_id);
create index audit_events_actor on public.audit_events(actor_id);
create index configurations_publisher on public.configuration_versions(published_by);
create index customer_preferences_request on public.customer_schedule_preferences(organization_id,request_id);
create index jobs_approved_quote on public.jobs(organization_id,quote_id,approved_version);
create index payments_collector on public.payments(collector);
create index sync_runs_connection on public.sync_runs(organization_id,connection_id);
create index work_sessions_actor on public.work_sessions(actor_id);
create index customer_preferences_queue on public.customer_schedule_preferences(organization_id,status,created_at desc,id);

-- Preserve each authorization predicate; evaluate the caller ID once per statement.
alter policy organization_read on public.organizations using (
 private.staff(id,array['owner','admin','dispatcher','technician','bookkeeper','support']) or exists(
 select 1 from public.customer_access a where a.organization_id=id and a.user_id=(select auth.uid())));
alter policy own_membership on public.memberships using(user_id=(select auth.uid()) and revoked_at is null and private.live_identity(false));
alter policy access_read on public.customer_access using(user_id=(select auth.uid()) and revoked_at is null and (expires_at is null or expires_at>now()) and private.live_identity(false));

-- Make the existing private invitation default-deny posture explicit to the security advisor.
create policy owner_setup_invitations_deny on private.owner_setup_invitations to anon,authenticated using(false) with check(false);
