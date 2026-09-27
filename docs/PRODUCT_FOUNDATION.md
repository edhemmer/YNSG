# YNSG product foundation — 2026-09-27

**Status:** governing implementation blueprint; no production application code yet.  
**Authority:** Master Business Plan → Technology Product & Architecture Plan → this reconciled foundation → detailed contracts → code. A discrepancy goes back to the higher authority for resolution.  
**Repository:** `edhemmer/YNSG`. The repository currently contains only a README. No YNSG Supabase project or Vercel linkage has been verified.

## 1. Product and release definition

Your Neighborhood Service Guy (YNSG) is an owner-operated **HOME & YARD** service for DeKalb, Sycamore and Cortland. Public promise: **We're Here to Help.** The first release must operate an actual job end to end: request → human review → exact quote and policy snapshot → approval → feasible appointment → field work and approved changes → one invoice → externally collected or manually verified payment → receipt, customer history, audit and export. A beautiful website without this workflow is incomplete.

The website is a responsive public entry and the application is a secure, installable iPhone-friendly PWA. A native App Store app is a later decision if device capabilities or distribution needs justify it; Apple review compliance is not implied by a web app. Safari, Home Screen installation, safe areas, touch targets, reduced motion, camera upload and keyboard/screen-reader behavior are release checks. No customer must install an app or create an account to request service.

The business serves everyone. Community Rate wording: “We serve everyone, with a Community Rate for seniors 70+, veterans, single moms, and neighbors with disabilities.” No hardship test, diagnosis or income disclosure, and no automated inference. The customer may request this rate voluntarily. Eligibility data should be a minimal program selection, not a stored medical, military or family dossier.

### Reconciled payment boundary

“No payment storage” means **no card numbers, CVV, banking credentials or payment tokens in YNSG's own database**. The app still needs invoice status, amount, payment method category, provider reference, allocations, refunds and audit history to support the requested customer history and bookkeeping. A hosted payment page owns card entry. Redirect success does not mark paid; a verified, deduplicated provider event does. Cash and Zelle are manually confirmed by authorized staff. Payment integration remains disabled until provider and business account are chosen.

## 2. Application map

| Surface | Routes or navigation | Primary action |
| --- | --- | --- |
| Public | /, /services, /services/[slug], /pricing, /about, /request, /privacy, /terms, /accessibility | Understand scope and price, request service, call/text |
| Account | /sign-in, /account, /account/requests, /account/appointments, /account/invoices, /account/properties, /account/profile | Track work, approve exact quote/change, request reschedule, pay hosted invoice, repeat service |
| Secure action | /action/[one-time-token] | Identity-verified quote approval or invoice access without forced account, bounded to the specific record |
| Operator | /app/today, /app/customers, /app/work, /app/money, /app/more | Resolve exceptions and perform work; iPhone first |
| Operator details | /app/work/[id], /app/customers/[id], /app/money/invoices/[id] | One Job Brief, chronology and permitted transitions |
| Tenant settings | /app/more/services, /pricing, /hours, /team, /policies, /integrations, /health | Govern catalog, pricing and behavior with permission checks |
| Platform administration | Separate privileged /platform surface | Tenant status, usage, integration failures and audited support actions; disabled until SaaS need |

Public navigation: Home / Services / Pricing / About / Request Service, with Sign In discreetly accessible. Homepage: brand, HOME & YARD, one practical proposition, Request Service and Call/Text, geography and concise service pathways. Authentic imagery only with rights and consent. Never use veteran/disability/single-mom imagery as a badge; no fake reviews, guarantees or “insured” marketing. Formal brand descriptor is HOME & YARD, not handyman.

Public services: lawn, yard/outdoor, residential snow and help around the home, plus “Something Else?” for review. Clearly describe the exclusions. No work above five feet, roofs, gutters, second story, tree work, wiring (including low voltage/landscape lighting), HVAC repair, structural work, major remodeling, chemical applications, commercial snow, plowing or deicer. Smart locks, hardwired exterior lighting and minor plumbing stay disabled pending compliance decisions. Customer-supplied parts do not alter those boundaries.

### New customer journey

1. Select service(s); only 3–5 relevant conditional questions per service in the normal path. Collect full name, service address, phone and email. Photos and notes optional. Offer call/text as an alternate access path.
2. Review entered information, consent for operational photos where relevant, and submit once using an idempotency key. Show a reference and “request received; we'll review it” with no implied booking or price promise.
3. Owner sees the original facts and a concise suggestion. Owner asks one useful follow-up, quotes, declines or refers regulated work.
4. Customer approves the exact quote and policy version by verified account or scoped link. Feasible scheduling follows approval; never show an unverified travel slot as bookable.
5. Customer sees plain statuses, appointment, changes, invoices and receipts. A verified relationship grants only the relevant property/work visibility.

### Operator journey

Today emphasizes appointments and exceptions, not widgets. A Job Brief includes customer, responsible contact, address, scope/version, photos, access, expected duration, price, materials and relevant history. Field controls: Arrive → Start → Add/Change → Approve → Complete & Invoice. Offline drafts may preserve notes, but approval, schedule, invoice and payment transitions fail closed until online verification succeeds.

## 3. Domain boundaries and ownership

Use one Next.js TypeScript application on Vercel, Supabase Auth/Postgres/private Storage, server-side command handlers, and durable background work as required. Keep it a modular application, not microservices. Modules: Identity/relationships; tenant configuration and catalog; intake; quoting/approvals; capacity/scheduling; job execution; invoice/payment ledger; communications; documents/storage; automation; reporting; integrations/AI. Modules own their write rules and publish durable events; screens compose read models rather than becoming alternate sources of truth.

**Tenant core:** organizations and locations, memberships and role grants; every tenant-owned row has immutable organization_id. YNSG is tenant one, with logo, territory, catalog, prices, hours and policies as tenant configuration. Customer identity differs from staff identity and platform administration. Avoid a blanket “all authenticated users” policy.

**People and property:** customer/contact, relationship grant (adult child, spouse, manager, billing contact), property and access notes; several properties per customer and several permitted contacts per property. An account claim requires verified email/phone plus a controlled invitation or verified record match, never possession of an address alone.

**Commercial chain:** request and immutable submitted answers → quote with append-only versions/lines → version-bound approval/policy acceptance → appointment → job and change order → issued immutable invoice/lines → payments and allocations/credits → receipt and export. Internal notes are separate from customer-visible notes. Preserve original submissions and snapshots even if catalog/pricing/policy later changes.

**Supporting records:** conversations/delivery attempts, private files, consent records, audit events, provider mappings and sync attempts, owner blocks, travel result freshness, expenses/material reimbursements and mileage. Money is integer cents; timestamps are UTC, presented in America/Chicago. No full accounting package in the app. Issued documents retain exact version, brand, scope and amount.

## 4. Authority, roles and row access

| Actor | Read | Write/decision |
| --- | --- | --- |
| Guest | Published catalog and own scoped confirmation | Submit request; one-time token accesses only explicitly bound action |
| Customer/contact | Only records for verified relationship and visibility grant | Own contact preferences, requests, exact quote/change approvals, concerns and reschedule requests |
| Technician | Assigned jobs and necessary contact/access details | Field notes, time, photos and completion proposal; cannot alter price or record payment unless separately granted |
| Dispatcher | Assigned tenant work/schedule | Schedule and customer communications; override only if explicitly granted |
| Bookkeeper | Tenant invoices, payments, expenses, exports | Reconciliation and permitted adjustments; no catalog/security administration |
| Owner/Admin | Tenant data and settings | Quote, approve configuration, audited conflict override, grant tenant roles |
| Platform admin | Metadata/health by default | Time-bounded, purpose-recorded support access; never blanket customer-data access |

RLS matrix rule: public catalog SELECT only for published and compliance-approved services; guest request INSERT through a rate-limited server command, never arbitrary direct table inserts; customer SELECT by verified relationship joins, and narrowly scoped INSERT/UPDATE commands; staff SELECT/WRITE by active membership, explicit permission and organization; platform administrator has no automatic RLS bypass for customer data. Explicit `WITH CHECK` on updates, no role from editable user metadata, no service key in browser, private Storage policies with expiring signed access. Cross-tenant and cross-contact access tests are release blockers.

## 5. State and money invariants

- Request: Submitted → Reviewing → Approved/Scheduled or Declined/Cancelled. Quote: Draft → Sent → Viewed → Approved/Declined/Expired; revision creates a new version, never overwrites one.
- Job: Needs Review → Waiting Customer → Approved → Scheduled → En Route → Arrived → In Progress/Paused → Completed → Invoice Sent → Paid. Only authorized commands move state; record actor, reason, source version and event.
- Approval binds quote version, amount, scope, policy version, signer identity, time and evidence. Revision invalidates pending approval. Material change creates a separately approved change order before extra billable work when practical.
- Standard hourly labor: two-hour minimum $120; then $30 per 30 minutes. Community hourly labor: two-hour minimum $90; then $22.50 per 30 minutes. Track estimated, quoted and actual minutes separately. Lawn starts at $50 through **and including 1/3 acre**; above that requires review. Community Rate applies only to eligible hourly labor, not lawn/snow/materials/disposal by default.
- Materials, parts and disposal are separate authorized lines at documented actual cost, with no automatic markup. Customer sees additional cost before it is spent. Tax treatment remains an approved jurisdiction/effective-date rule, never an AI guess.
- Complete & Invoice is idempotent: one authoritative invoice for one final approved commercial snapshot. Issued invoice is frozen; correction is void/credit/replacement with traceability. Partial payments and allocations are first-class; an open balance has Pay Now once a provider is active. Never store raw payment credentials.

## 6. Scheduling contract

Normal operating hours 8:00–17:00 Central, starts at :00 or :30 from 8:00 through 15:00. Reserve at least two hours; longer quoted work reserves additional half-hour increments. Each resource and owner block occupies a time interval. For consecutive appointments, earliest next start is prior reserved end + provider-verified address-to-address travel + configured buffer, rounded up to next half hour. The buffer is a **go-live owner setting still unresolved**, not a default silently embedded in code.

A transactionally serialized booking command rechecks capacity and travel at commit. An exclusion constraint or equivalent lock prevents overlapping appointments for the same exclusive resource. Customer self-booking fails closed if travel facts are unavailable; owner can choose a documented manual schedule after a warning. Overrides show conflicts, require permission and reason, emit audit, and never move another appointment silently. Recurrences reserve capacity. Provider adapters return duration/distance, timestamp, status and source; Google is optional, with quota and failure handling.

## 7. Communications, files, automation and AI

One conversation/timeline stores transactional email, optional SMS, portal messages, delivery attempts and opt-outs. Templates and policy wording are versioned. Failed deliveries and replies enter the same exception inbox. No blanket marketing consent from transactional contact. Operational photos use clear notice/consent; marketing permission is distinct. Private tenant-scoped storage limits type/size, scans/processes as appropriate, and serves only authorized expiring links.

Use an outbox event in the same transaction as authoritative state change. Workers retry with bounded backoff, deduplicate on stable event/provider IDs, and send failures to a visible dead-letter queue. Side effects never silently alter commercial records. Integrations each have Disabled/Configured/Test/Active state, secret storage, health, budget, retry and kill switch. Only activate a provider when operationally needed.

AI drafts concise summaries, missing questions, duration/material suggestions and messages from preserved source facts. Output includes evidence pointers, model/version and validation result. Deterministic rules set prices, eligibility never inferred, and owner approves quotes, exceptions and regulated-scope decisions. An AI outage leaves human workflow usable.

## 8. Security, privacy, accessibility and operations

WCAG 2.2 AA target: semantic navigation and headings, visible focus, keyboard operation, labeled errors, adequate contrast, 200% text zoom, touch targets, reduced motion, no color-only status, dictation-friendly fields and simple language. Test with VoiceOver on iPhone Safari and keyboard/screen reader on desktop. Avoid implying legal certification from a design target.

Threat gates: RLS and server authorization, relationship IDOR, session fixation/revocation, CSRF on cookie actions, token scope/expiry/replay, rate-limited anonymous intake, upload validation, injection/XSS, dependency and secret scanning. Sensitive values absent from logs. Privileged actions append audit records. Retention, export and deletion have accounting/legal holds, consent and incident procedures.

Environments: development, staging and production with separate Supabase projects/secrets and Vercel env scopes. Migrations are reviewed and tested in staging; backups and a practiced restore with documented RPO/RTO precede paid production use. CI: typecheck, lint, build, domain tests, RLS isolation, permission/IDOR, idempotency/state, accessibility smoke and mobile journey. Monitor failures in requests, outbox, payments, mail and integrations; alert on unresolved exceptions. Feature flags disable unready integrations without breaking the core.

## 9. Engineering-hardening deliverables in order

1. Reconcile owner decisions and service compliance; freeze release acceptance examples.
2. Exact ERD/schema: keys, foreign keys, ownership, indexes, snapshots, delete/retention and integer-money constraints.
3. Permission matrix and per-table RLS matrix with executable tenant/contact isolation tests.
4. State transition commands, event/audit taxonomy, idempotency keys and failure outcomes.
5. Service/question definitions, pricebook fixtures, quote/change/invoice/ledger invariants and tax boundary.
6. Scheduling capacity/travel/recurrence/override specification and concurrency tests.
7. Consent, communication, document/file and retention contracts.
8. Payment, accounting, location, email, optional SMS and AI adapter contracts, with disabled states.
9. Threat model, CI/CD, observability, backup/restore and incident runbook.
10. Route wireframes/design tokens, WCAG checks and end-to-end acceptance catalog.

**First implementation slice after these contracts:** organization/auth/roles/RLS/audit and design system, then the public service site plus guest request intake and operator review. Continue through the golden workflow before calling the app production ready. No fake dashboard data or nonfunctional Pay Now.

## 10. Decisions that block particular activation

| Decision | Needed before | Current safe posture |
| --- | --- | --- |
| YNSG legal entity/DBA, local registrations, insurance, tax and regulated service boundaries | Public paid launch/catalog activation | Services remain compliance-pending; do not claim licensure |
| Operating travel buffer and initial capacity/resource | Customer self-booking | No automatic bookable slots |
| Business phone/SMS consent and email sender/domain | Call/Text and automated messages | No invented contact details or messages |
| Payment provider/business account, fees and tax treatment | Hosted Pay Now | Invoice can be issued; paid only by verified/manual record |
| YNSG Supabase dev/staging/prod and Vercel project/domain | Deploy/configure environments | Do not reuse BRIX projects |
| Authentic images/logo rights and exact business identity/contact copy | Public publication | Use approved text and licensed assets only |
| Customer account claim/identity verification method | History access | No address-only claim |

The website can be previewed privately while those gates are resolved. Public claims and actual service activation depend on the applicable gates, not an arbitrary “MVP” label.
