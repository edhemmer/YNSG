-- Internal tables deny application roles explicitly.
-- pg_net queue/response objects belong to supabase_admin. A revoke from postgres
-- did not change their PUBLIC ACL; do not claim otherwise. Keep net outside the
-- Data API exposed schemas and include this provider-owned ACL in hardening review.
create policy background_deployment_deny on private.background_deployment to anon,authenticated using(false) with check(false);
create policy background_http_runs_deny on private.background_http_runs to anon,authenticated using(false) with check(false);
