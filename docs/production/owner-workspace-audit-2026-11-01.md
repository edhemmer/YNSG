# Owner workspace and production audit — 1 November 2026

## Release scope

The owner experience is organized around Today → job → current action → invoice/payment → message activity. Active scheduling, customer agreement, work, invoice and payment forms stay within the current job action rather than after reference sections. The shared shell uses consistent surfaces, spacing and controls across tools. Business switching lives in the header, preserving guarded navigation and company isolation and removing a separate block above the work. Marketing stays in its own destination.

Activity now offers Needs attention (oldest due/unresolved first) and Recent messages (newest first), including scheduled, accepted and skipped messages. Each result is validated against a bounded executable contract and the requested company/view/page. Appointment metadata resolves to the same-company service request, so the owner can open its actual job. Only message metadata is returned, never recipient addresses, message bodies or private payloads. Provider acceptance is never labeled delivered. Failed/denied reads clear displayed data and offer refresh. Business timestamps use the company timezone, including distinct CDT/CST labels for the repeated 1:30 AM on November 1.

Route verification expires visibly after 24 hours, rejects future/invalid timestamps and shows the last successful business-local check. Settings directs an expired check to the existing Connections & automation refresh rather than claiming current route health. This does not invent exact travel accuracy or make an unrequested provider call during this audit.

No migration, provider activation, pricing, customer consent, payment, tax, marketing enrollment or calendar-export setting changes. No paid AI service added. Deterministic preparation, sourced field guidance and editable drafts remain the free intelligence layer.

## Workflow verification matrix

| Area | Authority and exercised path | Remaining acceptance |
| --- | --- | --- |
| Customer discovery/request | Nine service panels including Farm hand day; service links, SEO, optional time, request recovery and customer history | Actual owner/customer device walkthrough |
| Owner navigation | Actual React shell; Today, finder, Requests, Calendar, Jobs, Money, Marketing and tools; history, reload, guarded company change and revoked roles | Physical iPhone/iPad and assistive technology |
| Appointment and approval | Canonical scheduling and exact saved scope/revision; explicit customer approval; stale/unknown/declined/canceled guards | Real agreement only for actual work |
| Work and time | Start/pause/resume/finish; one active timer; exact-command replay and duplicate/interrupted responses; task review and month clipping | Real measured task sample; no retrospective fabricated durations |
| Invoice and receipts | Reviewed work/charges, tax readiness, immutable issue, partial/full receipts and correction/reconciliation tests | Actual business tax/security review and received funds |
| Notifications | Owner-scoped metadata API, truthful send states, due/legacy-payment filtering, appointment links, retry and timezone rendering | New sends only for actual authorized business use |
| Automation | Existing request/appointment/invoice lifecycle workers; scheduled reminders and reconciliation guards | Provider configuration changes require their own verification |
| Route/time | Provider response validation, departure-time planning, schedule buffers, budget/cache/fallback and DST tests; stale status now explicit | Current provider probe and actual driving comparison |
| Content and tools | Email-template browser checks, job guidance/referral flow and readability across themes/sizes | Owner tone/usability acceptance |

## Read-only production observations

Observed November 1, 2026; no customer mutations or outbound test messages were made. Evidence below is summarized without customer contacts, private records, credentials or message IDs.

- Production database is healthy. Published business timezone is America/Chicago, intake is enabled, lead time is 1,440 minutes and scheduling buffer is 30 minutes.
- Business email is enabled through Resend. Both background cron jobs are active every minute; the sampled ten-minute window had successful HTTP 200 runs and no errors. Historical owner notifications were found in the actual owner inbox with passing DKIM/DMARC. This proves historical receipt, not guaranteed delivery of every future message.
- Accepted request, appointment confirmation/reminder and invoice-related deliveries exist. General lead follow-up and marketing templates are owner-reviewed drafts; they are not an automatic nurture campaign. Automatic review-request scheduling must not be inferred from an enabled review link.
- Optional Google Calendar export is disabled, with eight retained calendar updates waiting. Internal CRM scheduling is separate. The audit did not enable export or release the backlog.
- The saved Maps probe was approximately 324 hours old despite an active status. The new display makes that expiry visible. No new billable route probe was triggered by this audit. Existing scheduling readiness can perform the normal budgeted check when used by the owner.
- Saved visit-time aggregates had one closed session, no open sessions and no negative intervals; task-session history was empty. This is insufficient real-world evidence for calibrated task pricing. Synthetic timer/review/race tests remain engineering evidence.
- Database timezone conversion correctly distinguishes the two fall-back 1:30 AM instants. The client now labels both explicitly in message history.

## Security and operations disposition

Supabase advisories include intentional deny-by-default private tables and security-definer command functions requiring review of their permission boundaries. Existing permission, tenant, exact-revision and replay tests remain required; no broad policy/grant was added to silence a linter. The pg_net extension is nonrelocatable; it was not dropped or moved. Leaked-password protection is disabled and remains a real security configuration follow-up subject to plan eligibility. Low-sample unused-index and foreign-key suggestions were not treated as proof of a performance defect or used to remove indexes.

Human security review, restore/rollback acceptance, physical-device/accessibility acceptance, current route-provider verification and owner acceptance remain open completion gates. This maintenance release must not be described as whole-product certification.

## Engineering evidence

Targeted message API, delivery-state, timezone, route-expiry and request-recovery tests pass locally (14 cases). Required release checks, full workspace/message browser matrix, field request-to-receipt journey, owner mobile interactions, email template checks, public/workspace readability, production builds, native PostgreSQL CI, exact-head merge and both-domain deployment checks are recorded in the release PR. Windows POSIX backup-permission/symlink limitations are retained as failures locally; required Linux CI is authoritative for those tests. No verification is weakened to obtain a green result.

## Owner walkthrough

1. Open Today and continue a job. The actual next form should appear before progress/reference sections.
2. Review work and price, explicitly record real customer approval, then deliberately start/pause/resume work. Never use a test approval or fabricated timer on a real request.
3. Open Activity → Recent messages. Check the send state and use Open service request to return to the relevant job.
4. In Settings, review Connections & automation and refresh status before relying on live travel estimates. Optional calendar export stays off until deliberately configured.
5. Report any unclear action, overflow or repeated step from the phone you actually use; WEB-10 owner/device acceptance remains required.
