# Background automation acceptance — October 4, 2026

Internal operations document. Latest owner direction authorizes recurring workers as part of testing. No customer test messages, DNS changes, paid services or protection removal are authorized by this implementation.

## Pass/fail constraints before activation

- Preserve company email approval, current sender/configuration binding and owner invoice decisions.
- Require a separate worker bearer credential; Vercel protection remains enabled.
- Use Vault for scheduler credentials. No secret values in source, query strings or cron command text.
- Schedule independent of the browser, with bounded requests and existing leases/reconciliation.
- A successful cron SQL run means an HTTP request was enqueued, not that a message arrived.
- Verify HTTP success, worker response, outbox/provider result and actual designated test receipt separately.
- Reminders use current appointment details and their existing 24-hour due-time rule; minute polling is not exact inbox delivery.
- Report rejected provider/security actions without an indirect workaround.

## Prepared configuration

The setup script scripts/setup-background-cron.sql prepares two one-minute Supabase cron jobs, both inactive. It uses existing POST mail and calendar workers and records only request IDs and worker types for monitoring. It must not be applied or activated before reviewing database extension availability, credentials and worker prerequisites. Vault, pg_cron and pg_net are now installed. Both jobs are installed and paused.

Vercel project ynsg-repo / Preview / codex/crm-workflow requires GOOGLE_WORKER_SECRET (at least 32 random characters), GOOGLE_GMAIL_DELIVERY_ENABLED=true, GOOGLE_CALENDAR_WORKER_ENABLED=true, and GOOGLE_WORKER_ORGANIZATION_ID bound to the YNSG organization. No changes to public website variables or existing Google encryption key are needed.

Vault entries required: ynsg_crm_worker_secret (same worker bearer credential), ynsg_crm_protection_bypass (project automation bypass), and ynsg_crm_worker_origin (stable HTTPS CRM branch origin). Create/update these through an authorized secret-management path, never by copying them into GitHub or this document.

## Approved setup — activation blocked by credentials

Owner approved the specific worker and project bypass setup. The approved Vercel connector retry returned a provider 403: permission to create projectProtectionBypass denied. Dashboard fallback was approved and the signed-in project dashboard is accessible.

An existing project automation bypass was found. Its value appeared in diagnostic output, so it must be rotated before activation. Do not reuse that value. Browser confirmation policy requires owner handoff for credential creation or rotation; the owner entered GOOGLE_WORKER_SECRET directly in Vercel. Its presence and branch scope were verified without revealing its value. Rotation of the older bypass still needs owner confirmation.

Live changes verified: pg_cron and pg_net installed through migrations; both named one-minute jobs installed inactive; authenticated customers cannot execute the enqueue function. GOOGLE_CALENDAR_WORKER_ENABLED=true and GOOGLE_WORKER_ORGANIZATION_ID were saved for Preview branch codex/crm-workflow only. The owner-triggered redeploy targeted main and failed; it did not update the CRM branch. GOOGLE_WORKER_SECRET exists in Preview/codex/crm-workflow. Matching Vault entries remain outstanding; periodic HTTP and provider verification has not passed. The jobs are not active.

## Live verification and rollback

1. Verify both worker routes reject missing/wrong worker credentials. Verify origin, company binding and switches via owner setup status.
2. Enable extensions and install the reviewed scheduler script only after approved credential setup. Jobs remain inactive.
3. Inspect due queues and use designated test records only. Invoke each worker and verify HTTP 200 plus provider state; review any existing pending real notices before activation.
4. Activate the two named jobs. Verify at least two independent runs, their pg_net HTTP responses and queue state without a browser open.
5. Test a designated appointment reminder, a modified appointment and a canceled appointment. Verify current details and suppression, not simply row counts.
6. Pause both jobs on failure. Company email approval and global switches offer additional pause controls. Never automatically retry unknown send outcomes.

Do not call this setup active until real periodic HTTP and provider evidence passes. Native iOS, public booking and recurring reservations remain separate release work.

## Secure preparation action — October 4

Pass/fail checklist: existing owner authorization and live-session checks; company/deployment binding; same-origin POST; server-only worker/bypass values; no credentials in UI, source, errors or status responses; never activate on preparation; fail closed for other companies, expired/revoked owners and customer roles; no required 2FA; no customer test messages, DNS or main-branch changes.

Owner Settings now has Connect background automation under Advanced settings. It sends only organization and an acknowledgement that the Vercel bypass was regenerated and the app branch redeployed. Server code reads its deployment environment and writes the three fixed scheduler entries to Vault through a server-only RPC. A private deployment registry restricts this operational setup to the configured business and stable origin. The RPC independently checks a live, verified owner session and membership. Preparation is repeatable and pauses the two named jobs transactionally. It never returns a secret. Nonsecret status shows stored credentials and actual job activation flags; neither proves provider delivery.

Verified: 121 tests pass, root/web TypeScript checks pass, production build passes, hosted anonymous/authenticated RPC execution denied and service-role execution granted. Full deliverable review completed against the checklist; actual Vault preparation and periodic HTTP/provider verification remain outstanding. No overall production-complete claim.

Security advisor review: explicit deny policies were added to the two new private tables. pg_net is non-relocatable and provider-owned in this project. Revoking PUBLIC queue/response privileges as postgres did not change their ACL, and the result was detected by a follow-up privilege check. Do not expose the net schema through the Data API or add user-facing queue inspection. The provider-owned ACL and pre-existing leaked-password-protection warning remain in the production-hardening review; no security setting was weakened. This configuration concern is not evidence that customers can access those tables through the current application.

## Owner wording update — October 4

Scope checklist: no Vercel branding in rendered owner UI or connection errors; technical configuration collapsed under Advanced settings; plain Background automation and Connect background automation labels; retain rotation acknowledgement, authorization and pause behavior; derive schedule labels from actual named-job activation flags; never claim delivery verified; customer pages unchanged.

The owner setup page and background section now hide technical instructions under Advanced settings. Connection reports Connected or Needs attention from stored setup and required access settings. Appointment emails and calendar updates report Scheduled or Paused from database job status and switches; unknown database status reports Needs attention. None of these labels claims successful provider delivery. The connection action still pauses both jobs and still requires setup acknowledgement. Error and success messages use business language. Internal implementation instructions remain in this document.
