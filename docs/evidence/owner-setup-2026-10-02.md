# Protected owner setup — October 2, 2026

R03/R04: added administrative invitation table, live verified-email lookup (not JWT email/user metadata), MFA-gated atomic claim, one owner organization, idempotent retry and audit event. No first-user-wins, existing-tenant attachment, revoked-access restoration, scheduling activation or notification activation. Invitation is seeded through the administrative connection, not exposed as an app endpoint. UI uses existing email OTP and MFA routes before claim.

The YNSG owner invitation is present. Actual email sign-in, MFA enrollment/verification and Google consent require owner interaction and have not passed live tests yet. Credentials are present in CRM Preview metadata; deployment runtime verification follows publication. Latest failed deployments targeted main, which lacks apps/web; keep the CRM on codex/crm-workflow.

Passed: empty-schema migration suite; local and hosted rollback owner tests for mismatched JWT email, uninvited identity, missing MFA, private-table access denial, idempotency, Google owner authorization, audit uniqueness and revoked membership. TypeScript, Next production build, synthetic mobile owner flow and existing Google controls pass. No Google API calls or customer messages occurred.

Supabase advisor: one informational RLS-without-policy finding for private.owner_setup_invitations is intentional default-deny. All direct grants are revoked; only the narrow identity-checked private definer function can access invitations. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Remaining gates: real OTP delivery, owner-controlled MFA, Google consent, Calendar operations and Gmail receipt. Automated customer notification flag remains absent/disabled. Public website email untouched.
