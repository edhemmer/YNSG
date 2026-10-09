# Owner scheduling repair — October 9, 2026

Live findings: the newest undated request has status reviewing and no appointment. All six published catalog categories have compliance review; the server rejects owner scheduling before recording evidence. The client filters that specific error into a generic fallback. Google Calendar and Gmail are connected; request receipts and owner alerts are accepted. Maps last probe is disabled.

Acceptance checklist:
- [x] Undated request: choose date/time, one click creates one reserved visit, resources and confirmation intents atomically.
- [x] No abandoned intermediate proposal or second approval for an owner-created visit; exact replay after a lost response.
- [x] Record owner scope review for this request without globally approving its service category; held work stays blocked. Regulated work remains for licensed contractors.
- [x] Keep operating hours, advance notice, capacity, tenant identity and fresh Google checks.
- [x] Separate booked state from calendar sync and mail outcomes. Errors remain visible and actionable.
- [ ] Customer and owner confirmations, 24-hour reminders, attendance and reschedule links remain connected.
- [ ] Routes use real Google estimates and confirmed addresses. No simulated mileage/ETA or claimed provider connection.
- [ ] Tests cover real transaction boundaries, denied access, held services, duplicates and delivery intents; deployment and live provider outcomes need separate evidence.
- [x] Preserve customer data and existing appointments; do not schedule an actual customer merely to verify.

The booking button is the owner's scope/visit attestation. It never approves extra work or charges. Catalog pricing is not changed; publishing an hourly quote remains an explicit reviewed command.

## Release evidence and open acceptance work

Booking transaction and authorization assertions passed in PGlite, including replay, held scope, tenant denial, exactly one resource reservation and one current confirmation/calendar intent. 191 application tests passed; root and web TypeScript checks and optimized Next build passed. Supabase migration applied successfully. Commit 8ab9040ca4d17239cf39b9425f77e0d1fe8b3bab deployed READY as dpl_54PR2C6ucc3JKxSDAu8hx8yvqF2E on the stable CRM alias.

Both minute cron jobs are active; calendar and mail worker HTTP responses are 200. Calendar worker refreshes Google authorization successfully. No live test appointment, event or appointment email was created. The live browser reaches the sign-in screen, so an authenticated owner acceptance test and recipient inbox verification remain open. A local browser harness could not run because the Chromium download was blocked/truncated; static React action tests passed instead.

The new deployment's route probe returned disabled: no supported server key is present. Accepted server names are GOOGLE_ROUTES_API_KEY, GOOGLE_MAPS_API_KEY and GOOGLE_API_KEY; set on Vercel project ynsg-repo, Preview scope for the serving CRM branch, and Production for a later production-domain release. Routes API enablement, billing and restrictions still need a successful real probe. Environment access through the Vercel connector returns 403, so the agent cannot inspect or copy the owner's key.

No live AI provider or agent layer was introduced. Existing suggestions are rules/templates. Full AI-provider acceptance remains open. Existing security advisories: private signin-events RLS without policies (intentional deny-all), pg_net in public, leaked-password protection disabled. No new tables were exposed by this release.
