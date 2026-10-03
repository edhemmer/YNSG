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
| Invoice owner review and approval before delivery; actual paid/unpaid balances, waived work recorded | Partial: deterministic ledger, custom labor, owner-reviewed email and PDF built; live delivery/device verification incomplete |
| Owner daily route, previous-evening packing, verified weather workflow | FAIL: not completed |
| Configurable SaaS branding and platform administration without customer-data access | Partial foundation; not a completed SaaS product |

## Canonical worklist

Completed below means component checks passed, not that the whole live journey passed.

| ID | Classification | Finding and completion test |
|---|---|---|
| A01 | Owner claim verified | October 3 hosted read confirms one company and an active owner membership tied to verified edhemmer@gmail.com. Owner has reached settings in the provided screenshot. No database impersonation or administrative claim was performed. |
| A02 | Deployed; live identity test pending | Dedicated /owner entry prefills edhemmer@gmail.com, requires no account password, and grants no permissions merely from that email. Build passes; deployed /owner returned HTTP 200 with the prefilled email. Live email return remains pending. |
| A03 | Implemented; activation/live test pending | Public endpoint now supports server-bound durable CRM intake with all selections, stable retry key, HMAC abuse-control digest and atomic owner outbox intent. Existing Resend mode remains active until owner/company/Gmail worker setup is verified. See website-crm-intake.md for exact variables and acceptance. |
| A04 | Customer repeat intake implemented; website/account activation partial | Verified linked customers now reuse stored contact and property details for multi-category repeat requests, with one atomic request, selected items, owner outbox intent and retry receipt. Account invoice links use authenticated documents. Public header login, optional post-submission signup, real phone acceptance and calendar slot selection remain open; public intake stays email-only. |
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
| A16 | Completion and approval implemented; delivery incomplete | Service completion now closes timers independently, leaving drafts editable without issuing invoices or sending mail. Explicit owner approval requires a current saved draft, reviewed exact total and retry receipt; issued invoices and ledger remain immutable. Draft fields lock during saves; old combined RPC is closed. Authenticated invoice document preview now includes approved charges, no-charge work, actual payments and balance with print/save-as-PDF controls. New invoices freeze and display linked recipient/address details; older invoices without a snapshot show a warning. Rendered print acceptance remains open. Separate owner-reviewed invoice email request, unique delivery event, status view and HTML/plain-text dispatcher are implemented. PDF attachment and authenticated PDF download are implemented and synthetic renders checked. Live Gmail receipt, recurring worker execution and real device PDF acceptance remain incomplete. Issuance alone never sends; invoice.paid remains unsupported. |
| A17 | Implemented; live delivery pending | Future fully settled invoices queue one thank-you using confirmed integer-cent payments and the immutable recipient. Partial payments and historical paid events cannot send. Optional review destination is owner-configurable and frozen with the payment event. Current paid state is checked at lease/send; ambiguous delivery needs reconciliation. Owner can see follow-up status. Synthetic payment/lease/template tests pass; real Google receipt and recurring trigger remain open. |
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

## October 3 invoice recipient snapshot

A16 customer/address presentation is now implemented for new invoices: the existing owner-approved issuance transaction freezes the explicitly linked request contact and service-property address in the invoice. The trigger is SECURITY INVOKER, exposes no new API, grants no anon/customer execution and requires same-company customer/job/quote/request/property relationships. Existing issued invoices are not rewritten; documents warn when legacy customer details are absent. The document exposes only recipient presentation fields and recorded business contact, excluding private notes and waiver reasons. Layout now wraps long work descriptions, keeps money aligned, stacks controls on phones, repeats table headers when printed and returns to the shared workspace entry.

Local PostgreSQL fixtures prove snapshot persistence after account/address edits; 73 unit tests, root TypeScript and both optimized/static builds passed. Hosted migration applied to YNSG only; trigger and execution revocations verified. No real invoices existed and no real customer invoice was created or sent. Live owner/customer rendering, physical print acceptance, invoice email/PDF attachments, explicit Send action and receipts remain open. A16 is still incomplete overall.

## October 3 explicit invoice email request

Owner/admin Money controls now require review of the issued invoice and frozen recipient before requesting delivery. The server enforces verified identity, same-origin POST, live company permission, finance entitlement, an owner-approved immutable invoice and receipt-tested enabled Gmail. Stable invoice event keys and command receipts produce one logical email across repeat clicks and retries. Only invoice.delivery enters worker selectors; historical invoice.issued events remain excluded. Delivery status distinguishes waiting, provider acceptance, failure and unknown results; ambiguous sends require reconciliation. Emails include exact charges, no-charge work, current confirmed payments/balance and terms in HTML/plain text. Private waiver reasons, recorded minutes and internal notes/configuration are excluded. No PDF is attached in this increment, and the owner interface states that limitation.

Synthetic PostgreSQL tests cover disabled/unreviewed sends, cross-company denial, repeat-click deduplication, leased explicit delivery and excluded issuance. Template tests cover escaping, recipient absence, exact balances and private field filtering. Hosted activation is not performed by the migration. Real sender consent, receipt, scheduled worker, device interaction and PDF delivery acceptance remain open.

## October 3 PDF invoice attachment

The invoice dispatcher now generates a PDF from the same filtered document used by the email, before begin_delivery. The MIME envelope nests HTML/plain alternatives and a safely named application/pdf attachment. The invoice page offers an authenticated PDF download through its existing RLS-protected endpoint, with no public invoice storage links. New font and PDF dependencies are pinned. DejaVu Sans is embedded with its license included in the PDF; font and license assets are explicitly traced into both server functions. Unsupported characters, excessive page count and attachment size fail before sending instead of silently changing content.

Synthetic one-page and ten-page invoices were generated, text-extracted, checked for exact totals/private-data exclusion, rendered and visually inspected. Body/attachment MIME round-trip and unsafe-filename tests pass. This is not a tagged-PDF accessibility certification. Live iPhone download, Gmail attachment receipt, provider consent and worker execution remain pending; A16/A24 stay open.

## October 3 paid-invoice follow-up

A17 now uses the existing confirmed-payment transaction and unique invoice paid event. SchemaVersion 2 events freeze the immutable recipient and the then-published review setting; legacy events stay excluded, so enabling Google cannot email old paid invoices unexpectedly. Leased events and final send both verify exact settlement, approved invoice and recipient. The dispatcher produces an escaped HTML/plain-text thank-you, optionally a neutral review request with an owner-enabled HTTPS URL. The owner invoice panel shows the paid follow-up status. Review settings are editable and locked during publishing. No real customer email or payment was created.

80 unit tests, synthetic PostgreSQL migration/integration tests, TypeScript and optimized CRM build pass. Tests include partial/full/repeated payment, historical exclusion, changed recipient suppression, unknown-provider-result no-retry and cross-company denial. Google activation, unattended trigger and inbox receipt remain pending. Customer accounts, recurrence, weather, reports and other canonical gaps remain open; this increment is not a production-readiness certificate.

## October 3 customer repeat intake

Verified customer accounts now offer Request service appt using explicitly linked properties and contact records matching the already-verified signed-in identity. This email comparison narrows a permitted contact; it never creates customer access or imports history. Multiple jobs across categories, optional notes/time preference and Community Rate inquiry persist under one request. The database uses the existing guest validation/atomic intake implementation, adds customer/property linkage and actor auditing, and scopes the receipt to a separate customer command. Required contact fields come from stored records. No appointment is reserved by this increment.

The form locks during sending, retains a retry key for unchanged details and changes it for edited requests. It shows loading, failure and saved states, and refreshes account history. Switching businesses clears draft fields and ignores old-company completion messages. Customers can open invoices and download PDFs through the existing RLS-protected document endpoint. Owner-workspace navigation was removed from the customer account.

82 unit tests and synthetic PostgreSQL integration checks pass, including linked-only property disclosure, both selected categories, retry after contact edits, one owner notification, explicit customer actor, unrelated/other-tenant denial, revoked access, edited retry rejection and forged contact fields. TypeScript and optimized CRM build pass. Hosted helper grants and explicit link guards are verified; Google mail remains disabled. Real customer login/device journey, website header/account signup integration and calendar selection remain open.
