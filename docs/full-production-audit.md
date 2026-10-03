# Website and CRM production audit

Checkpoint: October 3, 2026. Latest owner instruction removes mandatory 2FA; verified email and live company permissions remain required. Current audited CRM branch includes owner access, intake bridge, notes, decline notices and both 24-hour reminders; public website baseline f7ab04b. This is an open acceptance worklist, not a production-readiness certificate.

## Required acceptance constraints

| Requirement | Current result |
|---|---|
| Official logo, conversational copy, especially seniors, veterans, single moms and people with disabilities; accessible mobile controls | Partial: source present; real device and assistive-technology review pending |
| Required name, address, phone and email; multiple services across categories | Source and HTML checks pass; real submission journey pending |
| Rates $60/hour standard and $45/hour community, one two-hour minimum; no public overrun rule or half-hour pricing | Public wording corrected; commercial engine reconciliation pending |
| Mulch bulk/bags pickup, delivery and application; supplier prepayment and pickup-start labor; leaf management, weeds, small plants, patio washing and customer water | Source present; full mobile content review pending |
| No rejected services, invented guarantees, customer photos or AI marketing metadata | Continued full release review required |
| Passwordless Ed login; verified identity and tenant isolation | Login build passes; active verified owner membership observed; full sign-in/logout device acceptance pending |
| Website-to-CRM durable intake and backup email | FAIL: public endpoint currently email-only |
| No double booking; owner approval/decline; Google synchronization | Database tests pass; live Google integration and concurrency tests pending |
| Customer and owner reminders at 24 hours, independent of an open browser | Both templates/timing built; recurring trigger and actual inbox receipts unverified |
| Invoice owner review and approval before delivery; actual paid/unpaid balances, waived work recorded | Partial: deterministic ledger and labor customization built; delivery/PDF incomplete |
| Owner daily route, previous-evening packing, verified weather workflow | FAIL: not completed |
| Configurable SaaS branding and platform administration without customer-data access | Partial foundation; not a completed SaaS product |

## Canonical worklist

Completed below means component checks passed, not that the whole live journey passed.

| ID | Classification | Finding and completion test |
|---|---|---|
| A01 | Owner claim verified | October 3 hosted read confirms one company and an active owner membership tied to verified edhemmer@gmail.com. Owner has reached settings in the provided screenshot. No database impersonation or administrative claim was performed. |
| A02 | Deployed; live identity test pending | Dedicated /owner entry prefills edhemmer@gmail.com, requires no account password, and grants no permissions merely from that email. Build passes; deployed /owner returned HTTP 200 with the prefilled email. Live email return remains pending. |
| A03 | Implemented; activation/live test pending | Public endpoint now supports server-bound durable CRM intake with all selections, stable retry key, HMAC abuse-control digest and atomic owner outbox intent. Existing Resend mode remains active until owner/company/Gmail worker setup is verified. See website-crm-intake.md for exact variables and acceptance. |
| A04 | Missing website functionality | Header account/login, optional account creation after submission and saved-contact repeat requests are not connected to public intake. Test guest and signed-in journeys on a phone. |
| A05 | Not connected | No Google accounts are connected. Owner must consent, select an owned calendar and verify Gmail sender. Prove contact/address/order-link event fields, moves, conflicts, retries and disconnect behavior. |
| A06 | Not connected | No tenant mail controls are enabled; recurring worker activation is not verified. Require sender self-test receipt and explicit owner activation; prove retries and delivery with dashboard closed. |
| A07 | Broken production topology | CRM project production branch lacks its apps/web root; working CRM is a protected preview. Set correct production branch/domain/environment only after acceptance; public customer routes must not require Vercel sign-in. |
| A08 | Corrected; live customer test pending | Appointment RLS now follows explicit request/customer or job/customer relationships. Portal independently paginates appointments. Database fixtures prove past/future pre-job access, unrelated-customer and tenant isolation, and immediate revocation. |
| A09 | Implemented; live delivery pending | Manual request decline now commits one customer notification with its state change and audit. Owner UI exposes the action; active appointments require calendar decisions instead. Duplicate commands, stale notices and tenant denial pass database tests. Gmail receipt acceptance remains pending. |
| A10 | Both reminders implemented; recurring/live execution pending | Approval now queues separate customer and owner notices at 24 elapsed hours. Owner notice includes contact, address, every selected task and CRM link without customer capabilities. Stale revisions suppress notices at lease and dispatch. Real worker trigger and inbox receipt remain unverified. |
| A11 | Conversation notes implemented; broader timeline partial | Owner/admin can append internal request notes and customer notes with retry protection. Customer history includes explicitly linked request notes; no auto-match by email. Private records deny customer and platform-only access. Full email/service activity timeline remains unfinished; live owner UI acceptance pending. |
| A12 | Not completed | Recurring appointments and exceptions need capacity reservations per occurrence, revisions, reminders and cancellation/reschedule workflows. |
| A13 | Daily call sheet implemented; live acceptance and automatic briefing pending | Owner/admin daily sheet independently loads the selected local day, retains every cross-category task, shows contact/address, confirmed and needs-review status, and links to the correct company order. Printing and Maps navigation controls are built. Exact-count checks refuse truncated data. Date/DST/URL tests pass; real owner data, phone, printed output and navigation still need acceptance. Automated day-of briefing remains unbuilt. |
| A14 | Packing workflow implemented; live acceptance and evening delivery pending | Today/Tomorrow call sheet now builds a packing list from owner-approved exact-task rules. Reusable quantities use the largest requirement for sequential visits; consumables sum. Missing rules, incompatible units, overlapping crews and scheduling review are flagged. Rules retain immutable versions, guarded revisions, retry receipts and rule-linked audits. Unknown or unavailable rules never look complete. Checklist and warnings print with calls. Real equipment review, phone/print acceptance and unattended evening delivery remain open. |
| A15 | Not completed | Location-verified weather rescheduling needs source, timestamp, condition and policy evidence; affected outdoor jobs only; documented cancellation, capacity release and customer emails. No AI-generated weather facts. |
| A16 | Completion and approval implemented; delivery incomplete | Service completion now closes timers independently, leaving drafts editable without issuing invoices or sending mail. Explicit owner approval requires a current saved draft, reviewed exact total and retry receipt; issued invoices and ledger remain immutable. Draft fields lock during saves; old combined RPC is closed. Authenticated invoice document preview now includes approved charges, no-charge work, actual payments and balance with print/save-as-PDF controls. Recipient/address presentation and rendered print acceptance remain open. Customer email/PDF attachment, delivery receipts and retry handling remain incomplete. Current mail dispatcher does not deliver invoice.issued or invoice.paid. |
| A17 | Missing automation | Paid-invoice thank-you and review request need templates, confirmed payment transition and duplicate prevention. Review destination remains owner-configurable. |
| A18 | Not completed | Expenses, income reports, estimated taxes and professional exports need real data models and reconciled calculations. Tax estimates require owner inputs, documented assumptions and current rules. |
| A19 | Partial customization | Published company configuration exists; complete logo assets and consistent branding across website, portal, emails, invoices and reports. |
| A20 | Partial platform controls | Metadata-only platform administrator route exists; developer access has not been provisioned. Prove no customer-data or impersonation permission; subscription CRUD/terms deferred by owner. |
| A21 | Not completed | Source-linked AI assistant and supervised agent automations are not a working full feature. Keep authorization, capacity, money and authoritative state deterministic. |
| A22 | Hardening pending | Auth email SMTP/redirects, leaked-password protection warning, rate limits, backups/restore, monitoring, alerts, secrets rotation and failure recovery require evidence. Do not assume free tiers supply production guarantees. |
| A23 | Deferred | Native iOS is last. Shared tenant authorization and APIs form groundwork; native app, signing, accessibility and Apple review are not complete. |
| A24 | Live review pending | Full desktop/mobile usability, screen reader, keyboard, reduced motion, contrast, copy repetition, SEO and external links need real rendered review. Structural link checks alone do not prove usability. |

## Additional debug finding

A25 — Fixed in source: malformed service entries (including null) were normalized before validation returned, which could throw instead of returning HTTP 400. Validation now rejects these entries before normalization; regression checks passed (HTTP 400 for null, boolean, missing-field and invalid-task entries).

## Verified checks at this checkpoint

- 63 unit tests passed, including malformed public intake validation, CRM bridge failures and real-handler retry behavior.
- Local database migration and integration suites passed, including capacity, customer actions, owner blocks, invitations, platform isolation and invoice waivers.
- CRM optimized Next.js production build and TypeScript passed after the owner-entry change.
- Public website built nine HTML pages. Checked 268 internal links: no missing targets, missing fragments or duplicate IDs.
- Required name, phone, email, street and city controls present on both request entry pages.
- Website JavaScript, request endpoint and build-script syntax checks passed; root TypeScript passed.
- Hosted security advisor reported [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This existing customer-password warning is unresolved; no new database security findings were introduced by these migrations.

These checks do not establish provider delivery, real-browser accessibility, deployed worker execution or production customer availability.

## Owner login and live verification

CRM preview: https://ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app

The deployed /owner page offers passwordless email sign-in. Enter edhemmer@gmail.com, select the email sign-in link option and open the newest email in the same browser. If Vercel shows a protection screen, use your Vercel account. Owner setup no longer requires an authenticator or an account password. The owner claim is now verified; repeat sign-in and logout acceptance remains a separate device check.

Only owner-controlled verification is needed for:

1. Actual sign-in email delivery and same-browser return, owner setup, owner dashboard and logout.
2. Google consent, owned-calendar selection and Gmail sender self-test. Configure company details before enabling customer mail.
3. A designated test customer email and address, then approval/decline and real event/email delivery after the intake connection is implemented.
4. Browser-closed reminder delivery after worker scheduling and both reminder paths are completed.
5. Phone usability, printing and navigation after the route/packing screens exist.
6. Invoice approval, PDF receipt, actual payment status and thank-you delivery after those missing paths are implemented.

Do not test unbuilt features as though they are ready. Provider consent and owner identity setup cannot be replaced by a database grant or fabricated test receipt.

## Architecture and advertising amendment

See platform-and-launch-checklist.md. Independent CRM deployment and per-business website configuration are now explicit build requirements. Company colors must control the owner workspace with actual-surface contrast checks. Website advertising acceptance requires a real phone submission and owner receipt; it does not certify unfinished CRM scheduling, notifications or invoicing. Domain mapping, auth origins, all-channel logo assets and multi-company onboarding remain open.

## Execution order and release gate

1. A01–A02: owner entry and identity setup.
2. A03–A09: durable intake, customer identity/history, Google and decision delivery.
3. A10–A15: durable unattended field scheduling and daily operations.
4. A16–A21: invoicing, customer relationship, reporting, configuration and supervised assistance.
5. A22–A24: production hardening and full acceptance; native iOS remains last.

For each item: inspect source, implement, run relevant automated checks, record deployed commit and live evidence, then change its status. Keep failures on this list until reproduced and resolved. The release gate remains closed while mandatory website/CRM workflows fail or remain unverified.

## October 3 settings usability correction

Owner-facing setup now says Business name, including confirmation and commercial instructions. Clock-time selectors replace minutes after midnight; named weekday checkboxes and explicit duration units preserve canonical values. Tax status is separated and defaults to Not reviewed yet. Settings controls are disabled during publishing; loading and validation errors are clearer. Mobile fields stack vertically. Rendered owner/device acceptance remains pending.

## October 3 packing and call-sheet checks

Approved task equipment rules remain private to each company and require a live owner/admin membership. Hosted checks confirm RLS, no direct client read, no anonymous approval and no generic worker approval grant. Local database fixtures prove retry/stale conflicts, rule history, customer/tenant/platform denial and immediate session/membership revocation. No real equipment rules were seeded or approved on behalf of the owner. A partial appointment query is now rejected even when a lower server cap causes the mismatch. Equipment-read failure leaves complete call details usable with a packing warning. Printing hides unrelated dashboard elements without reserving their page height. Real rendered print/mobile acceptance is still required.

## October 3 owner notification readability

Public website email template deployed at main 5f0b79763f246d52f4e9a8dee9d1fa8e1086e1dc (public Vercel production READY). Customer contacts and call/email/map actions now appear first, tasks are grouped by category, and full request ID is at the bottom. Subject, recipient, customer Reply-To and stable provider retry key are retained. No new real-customer mail was sent for verification.

The CRM owner-request notification now reuses that formatter with its own company name and tenant-bound service request. It includes an authenticated request link, customer Reply-To, HTML and plain-text MIME alternatives. Sender-consent/test guards, delivery lease, begin/finish state and ambiguous-send reconciliation remain in place. Google live connection, receipt and iPhone/dark-mode acceptance remain open under A05/A06/A24; this template change does not enable integrations or certify production readiness.
