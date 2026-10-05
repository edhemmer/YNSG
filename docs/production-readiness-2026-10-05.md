# Production readiness — October 5, 2026

Internal engineering acceptance record. Do not publish this document on the customer website. This checkpoint supersedes dated status claims in the October 3 audit; historical records remain evidence of earlier checkpoints.

## Pre-change constraints

| Constraint | Result before changes |
|---|---|
| Preserve working website intake, tenant authorization, verified owner login and private customer links | Required; no behavior change proposed |
| Keep owner-approved invoice delivery and canonical database scheduling | Required; no behavior change proposed |
| Do not send test messages to real customers or change their appointments | Pass: this audit uses aggregate reads and local synthetic fixtures |
| Do not expose credentials, private records, execution errors or this audit publicly | Pass for proposed changes |
| TypeScript must pass across shared contracts, tests and web application | Fail: six extensionless imports discovered by root NodeNext typecheck |
| Automation must run independently of a browser | Pass for worker execution; end-to-end appointment acceptance remains open |
| Do not claim recurring reservations, tentative guest holds, weather rescheduling or native iOS are complete | Required: these are unresolved scope |

## Live evidence

At this checkpoint, both database-scheduled workers are active every minute. In the preceding hour, 120 scheduler runs succeeded: 60 mail requests and 60 calendar requests returned HTTP 200 without timeouts. Four request messages (two customer receipts and two owner notifications) have provider status `accepted`; no queued or failed messages were observed. Acceptance by Gmail does not prove inbox placement. Google credentials and a selected calendar exist. No appointment projection exists yet, so idle calendar-worker responses do not prove Google event creation or edits.

## Release acceptance

| Area | Status | Remaining acceptance |
|---|---|---|
| Durable website requests and receipt/owner notification | Verified for designated owner test submissions | Owner checks request contents in dashboard and notification link on iPhone |
| Background worker execution | Verified live | Monitor failures and exercise actual appointment/invoice work |
| Schema, commercial, scheduling and authorization fixtures | Local database suite passes | Multi-connection collision test and live account boundaries |
| Owner sign-in and request return | Built; unauthenticated access is rejected | Same-browser iPhone sign-in, logout and request-link return |
| Approval, decline and calendar updates | Built, fixture-tested | Live create, move, block and cancel; matching customer notices |
| 24-hour reminders | Built; workers active | Delivery with latest edited details; cancelled appointments suppressed |
| Completion, invoice approval and paid follow-up | Built, fixture-tested | Owner-only test invoice send, PDF totals, paid status and review email |
| Customer accounts and history | Built, fixture-tested | New account, verification, repeat booking, recovery and isolation |
| Mobile accessibility and map/print actions | Built; partial browser review | iPhone, large text, VoiceOver, keyboard, navigation and print |
| Security and recovery | Partial | Advisor review, password protection policy, OAuth production consent, backup/restore exercise and alerts |
| Public tentative holds and 12-month recurring reservations | Incomplete | Atomic holds and recurrence conflict/recovery acceptance |
| Automated evening packing, daily briefing and verified-weather rescheduling | Incomplete | Implement durable workflows and review controls |
| Native iOS, complete SaaS onboarding and AI assistant | Deferred/incomplete | Separate release work; do not advertise as working |

Production certification is not granted by this checkpoint. Use a controlled owner acceptance test before relying on unverified appointment or billing workflows with customers.

## Checks after the import correction

- All 129 application tests passed; shared NodeNext and web TypeScript checks passed; the Next.js application build passed.
- The empty-schema migration and PostgreSQL assertion suite passed. This is a single-process PGlite test, not evidence of live simultaneous bookings.
- The public website syntax check and nine-page build passed. Its historical standalone email test imports an absent CRM file and cannot run in that checkout; the corresponding current email and link tests pass in the CRM suite. The public test harness still needs separation from CRM internals.
- Every public database table has RLS enabled. Anonymous and authenticated roles cannot select the private sign-in event table. Its no-policy advisor notice is intentional deny-by-default, not a reason to add public access.
- The live reservation table has an active-only GiST exclusion constraint across organization, resource and overlapping time ranges. A simultaneous multi-client booking test remains required.
- Security advisors report two warnings: provider-installed `pg_net` resides in public and is non-relocatable; leaked-password protection is disabled. Do not relocate the extension blindly or claim these findings are cleared.

## Infrastructure release gates

1. Verify Google Cloud OAuth publishing status. External apps in Testing with Calendar/Gmail scopes receive refresh tokens expiring after seven days. Current app data cannot prove consent publishing status. After the appropriate production consent setup, reconnect if necessary and test unattended token refresh. Source: https://developers.google.com/identity/protocols/oauth2
2. Establish encrypted off-site backups and perform an isolated restore. Supabase recommends regular CLI exports for Free projects; automatic accessible backups are a paid-plan feature. No successful restore evidence exists in this audit. Source: https://supabase.com/docs/guides/platform/backups
3. Resolve the customer password security policy before broad account launch. Supabase leaked-password protection requires Pro or above; do not silently purchase an upgrade. Source: https://supabase.com/docs/guides/auth/password-security
4. Prove external failure alerts and worker freshness monitoring, including recovery from revoked Google access and failed delivery. Active cron jobs alone are insufficient.

## Owner acceptance sequence

Use only a clearly marked owner test customer with the owner's email and no real service obligation. Submit a request, open its notification on iPhone, sign in, compare every selected service, then approve a safe test slot. Verify the customer notice and one matching Google event. Move the appointment and verify the event and current confirmation. Block time and confirm it disappears from availability. Exercise decline and cancellation without duplicate notices. Finally close a test job, review and send its test invoice, verify the PDF and paid follow-up with the review link. A separate reminder test must prove current details and cancellation suppression. Record receipts and failures before expanding use to customers.
