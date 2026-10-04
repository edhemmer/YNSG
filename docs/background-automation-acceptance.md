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

The setup script scripts/setup-background-cron.sql prepares two one-minute Supabase cron jobs, both inactive. It uses existing POST mail and calendar workers and records only request IDs and worker types for monitoring. It must not be applied or activated before reviewing database extension availability, credentials and worker prerequisites. Current project has Vault; pg_cron and pg_net were not installed when inspected.

Vercel project ynsg-repo / Preview / codex/crm-workflow requires GOOGLE_WORKER_SECRET (at least 32 random characters), GOOGLE_GMAIL_DELIVERY_ENABLED=true, GOOGLE_CALENDAR_WORKER_ENABLED=true, and GOOGLE_WORKER_ORGANIZATION_ID bound to the YNSG organization. No changes to public website variables or existing Google encryption key are needed.

Vault entries required: ynsg_crm_worker_secret (same worker bearer credential), ynsg_crm_protection_bypass (project automation bypass), and ynsg_crm_worker_origin (stable HTTPS CRM branch origin). Create/update these through an authorized secret-management path, never by copying them into GitHub or this document.

## Approved setup — activation blocked by credentials

Owner approved the specific worker and project bypass setup. The approved Vercel connector retry returned a provider 403: permission to create projectProtectionBypass denied. Dashboard fallback was approved and the signed-in project dashboard is accessible.

An existing project automation bypass was found. Its value appeared in diagnostic output, so it must be rotated before activation. Do not reuse that value. Browser confirmation policy requires owner handoff for credential creation or rotation; no new worker credential has been entered.

Live changes verified: pg_cron and pg_net installed through migrations; both named one-minute jobs installed inactive; authenticated customers cannot execute the enqueue function. GOOGLE_CALENDAR_WORKER_ENABLED=true and GOOGLE_WORKER_ORGANIZATION_ID were saved for Preview branch codex/crm-workflow only. A new deployment is required to load these settings. GOOGLE_WORKER_SECRET and matching Vault worker/bypass entries remain outstanding; periodic HTTP and provider verification has not passed. The jobs are not active.

## Live verification and rollback

1. Verify both worker routes reject missing/wrong worker credentials. Verify origin, company binding and switches via owner setup status.
2. Enable extensions and install the reviewed scheduler script only after approved credential setup. Jobs remain inactive.
3. Inspect due queues and use designated test records only. Invoke each worker and verify HTTP 200 plus provider state; review any existing pending real notices before activation.
4. Activate the two named jobs. Verify at least two independent runs, their pg_net HTTP responses and queue state without a browser open.
5. Test a designated appointment reminder, a modified appointment and a canceled appointment. Verify current details and suppression, not simply row counts.
6. Pause both jobs on failure. Company email approval and global switches offer additional pause controls. Never automatically retry unknown send outcomes.

Do not call this setup active until real periodic HTTP and provider evidence passes. Native iOS, public booking and recurring reservations remain separate release work.
