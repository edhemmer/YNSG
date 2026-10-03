# Engineering specification

Status: approved-input implementation design; unimplemented portions remain tracked. Preserve root static-site build. Add TypeScript shared packages, isolated Next CRM app and Expo client. One Supabase database owns business state; no browser service-role keys. No cross-project data reuse.

## Routes and journeys

Public existing /, /services, /pricing, /about, /request, /privacy, /terms, /accessibility, /service-agreement stay intact. Public request remains account-optional.
CRM /sign-in, /auth/confirm, /account, /setup; operator /today, /customers, /customers/[id], /work, /work/[id], /calendar, /money, /money/invoices/[id], /money/expenses, /money/reports, /more/settings, /more/integrations, /assistant. Customer /portal, /portal/requests, /portal/quotes/[id], /portal/appointments, /portal/invoices/[id], /portal/messages. Platform /platform is separate privilege, not implicit tenant access.

Every list paginates; screens have honest loading/empty/error/retry states. Request → review → exact quote approval → feasible reservation → job brief/actions → approved change → invoice → confirmed payment → receipt/history is the vertical acceptance journey. Offline permits private bounded drafts, never confirmed commercial/scheduling state.

## Schema map and ownership

All tenant tables use UUID id, organization_id, composite UNIQUE(organization_id,id), composite FKs, UTC created_at; mutable aggregates additionally revision >=1. Default delete RESTRICT for business/financial history. Index tenant plus list date/status and every composite FK. Auth identity is auth.users, not a customer row. No broad client mutation grants.

| Tables / explicit relationships | Keys / constraints / indexes |
|---|---|
| organizations, organization_locations, memberships | slug unique; membership(org,user) unique; role constrained; revoked_at; active membership lookup index |
| configuration_versions, entitlements, subscriptions, usage_meters | config(org,version) unique, immutable publication; entitlement(org,module) unique; subscription separate software-billing provider ID |
| customers, households, contacts, customer_access, properties | access(org,user,customer) unique with capability scope/expiry; property FK customer; contacts separate from login; no email uniqueness implying household merge |
| catalog_services, service_compliance, form_versions, pricebook_versions, policy_versions | published version keys; compliance reviewed/held/approved; submitted form answers tied to exact version |
| service_requests, request_answers, request_files | original snapshot + nullable explicitly linked customer/property; intake key(org,key) unique; list(org,status,created_at) |
| quotes, quote_versions, quote_lines, approvals, change_orders | quote version(org,quote,version) unique; approval exact version/hash; lines integer cents and source; change linked job |
| resources, appointments, reservations, schedule_holds, availability_exceptions, recurring_services, route_segments | capacity exclusion(org,resource,time range) for active reservations; occurrence(org,series,local date) unique; route ordered stops, supplier readiness |
| jobs, job_assignments, time_entries, job_materials, job_notes, checklist_results, concerns | job linked accepted quote/reservation; visible/internal notes separate; time end>=start; material payer/source explicit |
| invoices, invoice_lines, payments, payment_allocations, credits | one original invoice(org,job); number(org,number) unique; immutable issued snapshot; positive payments, bounded allocations/reversals |
| ledger_accounts, journal_entries, journal_lines, reconciliations | unique source transaction; balanced deferred posting validation; immutable posted lines; reversal FK |
| expenses, receipts, mileage_trips, vendors, equipment, tax_profiles, tax_rule_sets | documented business share, tax-year/rule version; restricted tax profile; duplicate receipt/source hashes |
| conversations, communications, delivery_attempts, tasks, automation_rules | unique milestone key; recipient/template snapshot; unknown send distinct; lease/attempt identity; pending queue index |
| documents, document_versions, private_files | org/version immutable; private object path owner; content hash, MIME, byte count and purpose/consent |
| integration_connections, external_mappings, sync_runs, outbox, command_receipts | encrypted secret reference only; unique provider mapping/event key; lease token/expiry, bounded retries, dead letter |
| audit_events, ai_executions, ai_evidence, data_exports, retention_actions | append-only; actor/session/correlation, object/version; no raw secrets/access codes/private payload in audit |

Consolidation: operational photos and receipts reference private_files rather than duplicate storage metadata. Immutable commercial/document JSON is schema-versioned evidence; normalized lines own arithmetic. Live editable domain state does not hide in unvalidated blobs. Exact executable constraints are in staged migrations; proposed tables are not advertised as implemented.

## Permission and RLS matrix

| Role | Operational reads | Commercial writes | Money | Configuration |
|---|---|---|---|---|
| Owner/Admin | org-scoped | approved commands | scoped records; tax Owner only | org configuration; no entitlement escalation |
| Dispatcher | customers/schedule | quote/schedule permissions only | no tax/private finance | no membership changes |
| Technician | assigned jobs and minimum brief | time/notes/permitted job transition | no general ledger/tax | none |
| Bookkeeper | billing contacts | no scope/schedule changes | invoice/payment/expense permissions | no membership changes |
| Read-only/Support | explicitly allowed operational records | none | explicit permission only | none |
| Customer | explicit customer_access scope | own request/approval/reschedule request | shared invoices/receipts | own account only |
| Platform Admin | operational platform health only | no hidden customer impersonation | software subscription only | platform entitlements, audited |

Policies query current membership/access, not editable user metadata. Sensitive staff paths require verified email identity and a current session. Private Storage paths are org/file IDs with authorized lookup, no public bucket. Revocation checked on commands and reads. Views use security_invoker. SECURITY DEFINER only narrow command/helper functions with locked search_path, explicit actor/session checks and restricted EXECUTE. No generic user-supplied SQL/table name.

## Providers / topology

Interfaces: Email.send(intent), Calendar.push/reconcile, TravelTime.route(snapshot), Location.validate, Payment.verifyEvent, Accounting.export/reconcile, AI.propose, Storage.authorizeObject, Notifications.push. Return typed evidence/status, never boolean claims of delivery. Connections Disabled/Configured/Test/Active; disabled makes zero calls.

Public same-origin /api/requests stays on existing host. Separate preview CRM uses its own host-only secure HttpOnly SameSite cookie if SSR sessions are selected; never parent-domain cookies. Browser commands require same-origin CSRF checks. Native bearer API validates identity/session/revision, no wildcard credentialed CORS. Redirects/deep links allowlisted. Deployment-specific URLs are setup, not invented app subdomains.

Outbox claims use FOR UPDATE SKIP LOCKED and unique lease token; renew bounded leases. Intent persists before provider calls. Ambiguous send becomes needs_reconciliation, including crashed sending lease. Safe transient failures may back off; attempts bounded then dead_letter. Approved manual recovery has reason/audit. Gmail send/read scopes are separate; QBO mapping sandbox and Calendar live tests required before active status.

## Threat model / privacy

Trust boundaries: public user→intake; authenticated client→command API; API→DB; worker→provider; private file→renderer; model output→proposal validator. Threats: tenant/IDOR attacks, stale JWT, CSRF, hostile uploads/HTML/PDF URLs, replay, forged provider events, email ambiguity and financial mutation. Mitigations: live role checks+RLS+compositeFK, bounded schemas, origin checks, verified webhooks, restricted file types/bytes, no arbitrary renderer fetch, idempotency and immutable posting.

Public data: approved brand/catalog. Confidential: contacts, properties, job communications/photos. Restricted: tokens, access notes, tax profile, security metadata. Original request consent/policy version retained. No diagnosis, raw card/CVV, SSN or ordinary Gmail password collection. Retention lengths require owner/legal decision; deletion requests lock and review legal holds, do not silently erase invoices. Exports require reauthentication, scope and audit. Update public Privacy Notice at persistence cutover.

## Design and budgets

Navy #10283c, forest #315842, gold #edbd6b, cream #f8f6ef; original logo only. Readable system type, 16px minimum body, 44px controls, visible focus, reduced motion, labeled errors. Operator Today/Customers/Work/Money/More. Brand validation measures WCAG contrast; no arbitrary injected HTML/CSS.

Targets before implementation: p95 API reads <750ms and commands <1500ms excluding providers at 10 concurrent operators/10k synthetic records; page LCP <2.5s on mobile test profile; notification queue age <2min when worker enabled; Calendar reconciliation <5min with missed-notification repair. These are unmeasured targets, not achieved results. Task usability <=2min new intake, <=1min returning, 30–60sec review.

## Recovery / cutover

Proposed RPO24h/RTO4h require owner acceptance and timed proof. Encrypted daily DB export plus separately exported private object bytes/manifest, off-provider restricted destination, restore into isolated DB/bucket, compare counts/hashes and permission checks. No automatic backups on Free. CI tests blank+upgrade migrations; no live customer fixtures. Cutover only after release acceptance: deploy backward-compatible code with flag off, migrate/verify, configure+test providers, update privacy, turn one intake path on, monitor. Rollback disables cutover and preserves durable records; never destructive down-migration or dual email send. Document queued records for manual reconciliation during rollback.
