# Production completion checklist — October 2, 2026

Authority: latest owner directions, business/technology governance, master prompt revisions and scheduler upgrade. Full production scope remains mandatory. No mocked evidence establishes live readiness.

| Requirement | Release condition | Current status |
|---|---|---|
| Public website | Preserve approved logo, copy, required contacts, multi-category selection and working email | Preserve; CRM cutover disabled |
| Canonical settings | Same validated units and required commercial fields in contracts, SQL, web and mobile | In progress |
| Tenant setup | Invited verified owner; audited configuration; no first-user-wins or cross-tenant grants | Live owner completion required |
| Intake | One durable request, every service, one notification; idempotency and tenant tests | Multi-service integration in progress |
| Scheduling | Website/manual atomic capacity, travel/resources, fresh Google facts, holds and owner decisions | Partial; full customer flow pending |
| Customer actions | Same-request decline/reschedule, original retention, 24-hour links and scanner safety | Scoped attendance/preference actions implemented; customer availability/hold flow pending |
| Recurrence | Stable occurrences, horizon, exceptions, per-visit reminders, controlled series edits | Pending |
| Field operations | Start/pause/resume, recorded time/materials, closeout, load readiness | In progress |
| Finance | Approved totals, immutable invoices, delivery, actual payments, balanced ledger and corrections | Partial |
| Communications | Verified Gmail; durable automatic worker; receipt/thank-you/review exactly once per milestone | Scoped appointment notices, explicit test-receipt authorization and tenant worker implemented; live activation/trigger and financial notices pending |
| Customer relationships | Portal, history, properties, family permissions, preferences, photos and concerns | Password/history screens and verified invitations implemented; automatic intake linking, repeat request/calendar, delegates and live email pending |
| Business management | Reconciled reports, expenses/mileage, tax inputs and integrations | Pending |
| Company product | Branding/catalog/policies, historical snapshots, entitlement isolation and second tenant | Partial |
| Assistant | Source-linked proposals, explicit consequential commands, injection/outage fallback | Pending |
| iOS | Native app, secure sessions/deep links, real-device accessibility and TestFlight | Pending |
| Release | Concurrency, full flows, accessibility, recovery, monitoring, production topology, costs | Blocked |

Exclusions: no stored payment credentials; no customer pictures for public marketing; no rejected wording; no inferred eligibility/diagnoses; no automatic scope/pricing changes; no unverified claims of booking, delivery, payment or App Store compliance. Standard $60/hour and Community $45/hour, one two-hour minimum per combined visit. Supplier-paid mulch is not reimbursed again; pickup labor starts at supplier pickup; customer water and no herbicides remain explicit.

Owner interaction is required for sign-in/Google consent. Do not bypass it or activate customer delivery using administrative SQL. Never publish this checklist as a completion claim.

## Reviewed scheduling checkpoint

Owner/admin review now records request/configuration/calendar revisions, verified live session, manual scope/equipment/pickup and both travel checks. Server-side Google checks exclude only an unchanged mapped CRM event, retaining overlapping external events. A single database transaction submits the hold or approves the proposal; a completion receipt resolves an HTTP timeout. Fresh review evidence is required after expiry. Calendar and email delivery remain separate outbox states.

Company Settings now loads and edits the company's actual catalog, scopes, exclusions, compliance and pricing modes. It preserves existing service names/identities and offers Held for retiring services. YNSG data is used only through the explicitly selected YNSG template. Logo assets, template configuration, branded workspace rendering, rollback and full second-company acceptance remain incomplete.

Local evidence: 39 unit tests, PostgreSQL fixture assertions including reviewed proposal/approval/retry, root TypeScript check and Next.js production build. This does not establish real Google delivery, multi-connection races, accessibility or native-device readiness.

Deployment evidence: commit `953c3b5a22aaa15a8513439352732f95ec573cce` deployed READY as `dpl_EpiArKstmFM1SCwGJkgmjps9bjRQ`; preview homepage returned HTTP 200. Hosted `trusted_scheduling_reviews` migration applied successfully. Privilege checks confirm authenticated clients cannot mint review evidence, anonymous clients cannot commit reviewed schedules, and the server role can record verified evidence. Hosted customer and appointment counts remain zero. No live provider consent, customer email or calendar event was tested.

A further PostgreSQL regression checks that owner approval honors the original proposal selection clock after the advance-notice boundary has passed, while a new selection at that point is outside the configured lead policy.

## Customer-response and mail-dispatch checkpoint

Secure customer links now open an isolated appointment page for attendance confirmation and preferred replacement times. Request details stay intact; rescheduling retains confirmed capacity and creates one owner notice. Old appointment/recipient/expired grants fail closed; customer GET requests cannot mutate. The sender and messages use company configuration. Explicit owner receipt verification controls company delivery; a protected worker processes due notices without depending on an open owner dashboard. Customer slot/calendar selection and the real recurring trigger remain unfinished/unverified respectively.

Evidence: 42 unit tests; all PostgreSQL fixture suites; root TypeScript; Next.js production build; hosted narrow privilege checks; customer-page HTTP 200, customer API GET 405 and worker unauthenticated GET 401. Source commit `ee22af93457dd2fe0138252c9aa6baaf153db345` deployed READY. Both workflow migrations applied. No customers/appointments/mail authorizations are present in the hosted database. Browser/device, live delivery, multi-connection concurrency and full production release remain unverified.

Database optimization migration applied: 17 foreign-key covering indexes plus the preference queue index; three access policies keep the same predicates while evaluating caller ID once per statement. Hosted advisors report no remaining missing-FK-index or RLS caller-ID findings. The private invitation default-deny policy is explicit. Existing leaked-password-protection configuration warning remains; see https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. No paid configuration change was made.

October 2 owner expansion: customer accounts and private owner blocks precede iOS. See `account-owner-acceptance.md`. Half-hour website pricing is removed; owner controls final charges. Invoice waivers must preserve performed work and a documented zero charge. Platform administrators manage owner accounts/subscriptions separately and receive no tenant customer-data rights.
