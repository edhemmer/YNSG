# Independent calendar build acceptance

Active scope: CRM-owned calendar; optional owner calendar view/sync; Google outages cannot stop booking; independent transactional notifications; preserve tenant isolation, current records, scope checks, travel, operating hours, holds, recurring local dates and exact invoice amounts. No fabricated busy intervals, provider acceptance or payments. No “Request help,” Edward, replacement logos, blanket availability or completion claims.

Before implementation: architecture review identified five Google-dependent booking boundaries. Reuse the existing canonical scheduling engine, constraints and durable outbox rather than another scheduler.

Implemented and deployed to both Production projects:
- Explicit per-organization calendar authority; CRM default for current and new organizations. Guarded CRM facts are bound to authority/configuration versions and a short validity window. Google mode remains distinct for legacy integrations.
- Availability, holds, website submission, owner approval and recurring preview use the selected authority. The SQL commit still rechecks operating hours, owner blocks, resource exclusion, scope/revisions, travel and capacity. Existing Google-only commitments must be blocked in CRM; external calendars are not silently trusted clear.
- Optional private revocable calendar subscription works with Google, Outlook and Apple viewers. Read-only; application-controlled refresh timing; customer details excluded by default; membership revocation invalidates access. Stable UIDs/revisions and cancellation records preserve identity.
- Existing queued Google projection remains optional after commit; reconnect failures cannot roll back CRM booking.
- Signed server-to-server transactional relay uses the website’s existing email credentials. Relay binds the configured organization, recipient, header/attachment limits and stable provider idempotency key. Test-domain senders rejected. Owner test must be accepted before managed mail activation; sender/contact changes and revocation invalidate approval.
- Calendar and email controls expose truthful status; independent scheduling is not marked unavailable solely because optional export is disconnected.

Evidence: 234 unit/template/security tests; PGlite empty-schema migrations and existing business assertions; cloned website hold/submission/owner-confirmation flow with Google disconnected; mail activation and a complete leased worker claim/begin/finish cycle without Google (simulated provider outcome only), feed cross-tenant denial and revocation. Root/web types, website syntax/static build and optimized Next build. Hosted migration applied. A real two-connection PostgreSQL race for the same synthetic resource/time produced one reservation and one exclusion rejection. The isolated QA organization is suspended, its appointment canceled and its reservation inactive; records retained for audit, not deleted. Live .com availability returned open times while Google tokens were absent. Browser selected October 13 at 8:00 AM, created a hold and released it; the hosted appointment is canceled and its reservation inactive. No lead or customer email was created by that browser test.

Live production status: Website calendar Configured; Appointment emails Sender verification required; optional Google export disconnected without blocking CRM scheduling. Signed relay authentication and provider execution reached Resend, which returned an explicit sender-domain-not-verified rejection. No owner test was accepted, and managed mail remains disabled. The 15 fresh sample emails were not sent. Provider acceptance, actual inbox receipt and sample-send acceptance remain email release gates. Optional Google/Outlook/Apple subscriptions have SQL isolation/revocation and ICS renderer evidence; a real viewer subscription has not been created or accepted. Existing Google adapter projection remains disconnected and unverified against a newly restored account.

No new real customer appointment, invoice or payment is asserted by fixtures. Implementation is not yet labeled fully production-certified.

## Owner action required for business email

1. In Resend Domains, add or select the business sending domain and complete its DNS verification using the exact records supplied by Resend. A public Gmail domain cannot be verified by this business. A dedicated sending subdomain is supported; use the same verified domain in the sender address.
2. On Vercel website project `ynsg`, set `TRANSACTIONAL_EMAIL_FROM` in Production (and Preview if needed) to `Your Neighborhood Service Guy <notifications@YOUR_VERIFIED_DOMAIN>`. Keep the existing `RESEND_API_KEY` secret. Redeploy `ynsg` so the sender environment change applies. No new Google key is needed for booking.
3. In CRM Settings → Your calendar & notifications → Verify business email, run the owner-only test. Provider acceptance enables the independent sender; separately check actual inbox delivery. Then create and send a fresh sample set from Sample invoices and email checks, and verify all individual outcomes. Do not label rejected, queued or ambiguous messages delivered.

References: https://resend.com/docs/dashboard/domains/introduction and https://vercel.com/docs/environment-variables

## Deployment evidence

Calendar engine: `0165859a871db377414d149d34c95e12535e7b32`, both website and CRM READY Production. Sender diagnostics: `2262e9dc103a52d5e1e1293ce7c78e51463a3069`. Corrected independent readiness and precise provider classification: `bee242f47b8e6e29f64bc0164d823a30cca5bda8`, both READY Production. Type checks, website static build and optimized Next build passed. Financial/tax certification and live payment settlement are separate scope and are not asserted by these calendar tests.

Current sample suite created in the authenticated production CRM: `4fb08034-b18e-4a14-aa1d-03ca54d4ef36`, dated October 12, invoice `202610-0001`, 15 current templates, all correctly shown not sent. Browser verified declined-time wording and the public customer demonstration link. This is a sample document, not a billed or paid invoice. Latest functional deployment `d0cb72cfc79719aed5715a4f63d0ea0b1b9472fe` is READY Production on both projects and assigned to .com/.app aliases. A transient `git_info_fail` on the preceding CRM attempt was followed by a successful production deployment; it was not a code-build failure.
