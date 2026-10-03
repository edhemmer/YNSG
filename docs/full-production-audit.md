# Website and CRM production audit

Checkpoint: October 3, 2026. Latest owner instruction removes mandatory 2FA; verified email and live company permissions remain required. Source baseline: CRM e927b8b; public website 2899334. This is an open acceptance worklist, not a production-readiness certificate.

## Required acceptance constraints

| Requirement | Current result |
|---|---|
| Official logo, conversational copy, especially seniors, veterans, single moms and people with disabilities; accessible mobile controls | Partial: source present; real device and assistive-technology review pending |
| Required name, address, phone and email; multiple services across categories | Source and HTML checks pass; real submission journey pending |
| Rates $60/hour standard and $45/hour community, one two-hour minimum; no public overrun rule or half-hour pricing | Public wording corrected; commercial engine reconciliation pending |
| Mulch bulk/bags pickup, delivery and application; supplier prepayment and pickup-start labor; leaf management, weeds, small plants, patio washing and customer water | Source present; full mobile content review pending |
| No rejected services, invented guarantees, customer photos or AI marketing metadata | Continued full release review required |
| Passwordless Ed login; verified identity and tenant isolation | Login implementation passes build; live owner setup incomplete |
| Website-to-CRM durable intake and backup email | FAIL: public endpoint currently email-only |
| No double booking; owner approval/decline; Google synchronization | Database tests pass; live Google integration and concurrency tests pending |
| Customer and owner reminders at 24 hours, independent of an open browser | Partial: customer template/timing built; deployment trigger and owner notice incomplete |
| Invoice owner review and approval before delivery; actual paid/unpaid balances, waived work recorded | Partial: deterministic ledger and labor customization built; delivery/PDF incomplete |
| Owner daily route, previous-evening packing, verified weather workflow | FAIL: not completed |
| Configurable SaaS branding and platform administration without customer-data access | Partial foundation; not a completed SaaS product |

## Canonical worklist

Completed below means component checks passed, not that the whole live journey passed.

| ID | Classification | Finding and completion test |
|---|---|---|
| A01 | Blocked live setup | Ed's verified email identity exists, but has zero staff memberships and has not claimed the invitation. Finish email sign-in and invited owner claim; dashboard must open with owner permissions. Invitation expires October 9 at 7:19 AM Chicago time. |
| A02 | Deployed; live identity test pending | Dedicated /owner entry prefills edhemmer@gmail.com, requires no account password, and grants no permissions merely from that email. Build passes; deployed /owner returned HTTP 200 with the prefilled email. Live email return remains pending. |
| A03 | Implemented; activation/live test pending | Public endpoint now supports server-bound durable CRM intake with all selections, stable retry key, HMAC abuse-control digest and atomic owner outbox intent. Existing Resend mode remains active until owner/company/Gmail worker setup is verified. See website-crm-intake.md for exact variables and acceptance. |
| A04 | Missing website functionality | Header account/login, optional account creation after submission and saved-contact repeat requests are not connected to public intake. Test guest and signed-in journeys on a phone. |
| A05 | Not connected | No Google accounts are connected. Owner must consent, select an owned calendar and verify Gmail sender. Prove contact/address/order-link event fields, moves, conflicts, retries and disconnect behavior. |
| A06 | Not connected | No tenant mail controls are enabled; recurring worker activation is not verified. Require sender self-test receipt and explicit owner activation; prove retries and delivery with dashboard closed. |
| A07 | Broken production topology | CRM project production branch lacks its apps/web root; working CRM is a protected preview. Set correct production branch/domain/environment only after acceptance; public customer routes must not require Vercel sign-in. |
| A08 | Corrected; live customer test pending | Appointment RLS now follows explicit request/customer or job/customer relationships. Portal independently paginates appointments. Database fixtures prove past/future pre-job access, unrelated-customer and tenant isolation, and immediate revocation. |
| A09 | Partial decisions | Appointment approve/time-decline templates exist; manual service-request decline does not create equivalent customer notification. Every decision needs a durable, distinct template and audit record. |
| A10 | Partial reminders | Customer reminder changed to 24 hours. Add separate owner notice and verified recurring execution; include immediate email rescheduling instruction; suppress stale/cancelled reminders. |
| A11 | Not started as complete workflow | Customer/account notes and contact timeline need full owner editing/history and explicit customer-visible boundaries. |
| A12 | Not completed | Recurring appointments and exceptions need capacity reservations per occurrence, revisions, reminders and cancellation/reschedule workflows. |
| A13 | Not completed | Day-of in-app briefing, full route list, printable daily calls and navigation from current location need implementation and mobile verification. |
| A14 | Not completed | Previous-evening packing list needs approved service-to-tool mapping, consolidated quantities and unknown-equipment flags. |
| A15 | Not completed | Location-verified weather rescheduling needs source, timestamp, condition and policy evidence; affected outdoor jobs only; documented cancellation, capacity release and customer emails. No AI-generated weather facts. |
| A16 | Partial invoices | Labor drafts, waivers, immutable issued totals and balanced ledger are implemented. Add owner review/approval then customer email/PDF delivery, delivery receipts and retry handling. Current mail dispatcher does not deliver invoice.issued or invoice.paid. |
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

- 48 unit tests passed, including malformed public intake validation, CRM bridge failures and real-handler retry behavior.
- Local database migration and integration suites passed, including capacity, customer actions, owner blocks, invitations, platform isolation and invoice waivers.
- CRM optimized Next.js production build and TypeScript passed after the owner-entry change.
- Public website built nine HTML pages. Checked 268 internal links: no missing targets, missing fragments or duplicate IDs.
- Required name, phone, email, street and city controls present on both request entry pages.
- Website JavaScript, request endpoint and build-script syntax checks passed; root TypeScript passed.
- Hosted security advisor reported leaked-password protection disabled. This is still unresolved.

These checks do not establish provider delivery, real-browser accessibility, deployed worker execution or production customer availability.

## Owner login and live verification

CRM preview: https://ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app

The deployed /owner page offers passwordless email sign-in. Enter edhemmer@gmail.com, select the email sign-in link option and open the newest email in the same browser. If Vercel shows a protection screen, use your Vercel account. Owner setup no longer requires an authenticator or an account password. Finish the invited owner claim before business records can open.

Only owner-controlled verification is needed for:

1. Actual sign-in email delivery and same-browser return, owner setup, owner dashboard and logout.
2. Google consent, owned-calendar selection and Gmail sender self-test. Configure company details before enabling customer mail.
3. A designated test customer email and address, then approval/decline and real event/email delivery after the intake connection is implemented.
4. Browser-closed reminder delivery after worker scheduling and both reminder paths are completed.
5. Phone usability, printing and navigation after the route/packing screens exist.
6. Invoice approval, PDF receipt, actual payment status and thank-you delivery after those missing paths are implemented.

Do not test unbuilt features as though they are ready. Provider consent and owner identity setup cannot be replaced by a database grant or fabricated test receipt.

## Execution order and release gate

1. A01–A02: owner entry and identity setup.
2. A03–A09: durable intake, customer identity/history, Google and decision delivery.
3. A10–A15: durable unattended field scheduling and daily operations.
4. A16–A21: invoicing, customer relationship, reporting, configuration and supervised assistance.
5. A22–A24: production hardening and full acceptance; native iOS remains last.

For each item: inspect source, implement, run relevant automated checks, record deployed commit and live evidence, then change its status. Keep failures on this list until reproduced and resolved. The release gate remains closed while mandatory website/CRM workflows fail or remain unverified.
