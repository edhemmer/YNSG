# Record export hardening — 19 October 2026

Baseline: PR #139, production 074dd28b189741ffdfcd7cc469d0dac15babfd93. Advances WEB-06/08/10/11 and issues #32/#33.

## Pass/fail checklist before editing

- A complete customer export has an executable, bounded, strict output contract shared by server/client and documented in OpenAPI. Correlate company/customer and reject missing sections, malformed records, duplicate IDs and unexpected/private fields before download.
- Leaving an export screen or changing its company/customer/date range invalidates and aborts its read. A late response cannot download a private file, alter a new selection or unlock another in-flight request.
- Disabling journal export during refresh or lost permission also cancels an outstanding download. A successful server response does not override the current disabled state.
- Reauthentication clears passwords, never auto-downloads, preserves the selected scope and offers same-account sign-in in a separate tab. Old callbacks cannot confirm a different company.
- Preserve canonical permissions, freshness, audit, pagination completeness and issued evidence. No schema, provider activation, customer data, email, financial action, Stripe, required MFA, price/service changes or paid activation for QA.
- Review the entire connected UI/API/session path; run targeted races/malformed-body cases, full release checks, optimized builds, exact-head PostgreSQL CI and production identity/read-only checks. No gate is closed by synthetic tests alone.

Rejected: silently downloading partial records, trusting only the filename/format, automatic retry after reauthentication, losing selection by signing out in the same tab, suppressing native findings or inventing owner/device/provider acceptance.

## Whole-flow review and local verification

Reviewed customer detail → export authorization → bounded canonical pages → final snapshot checks → fresh audit proof → strict response → deliberate browser download. Contacts/properties remain capped at 100 by canonical SQL (excess raises DETAIL_LIMIT); requests/history remain capped at 5020 each by the existing 250-page bound plus initial page. The shared output validator correlates company/customer, requires all sections and rejects duplicate IDs in each section. It does not introduce an atomic database-snapshot guarantee across HTTP pagination; existing change-detection and actual acceptance requirements remain in force.

Reviewed customer/journal/local CSV downloads and all shared reauthentication callers, including report refresh, disabled exports, selection changes, unmount, old responses and overlapping requests. Cancellation applies only to reads; it is not a rollback of an audit already saved on the server. Controller ownership prevents an older finally-handler from unlocking a newer read. Password confirmation stays deliberate, clears the password, suppresses old company callbacks and never downloads automatically. Same-account email-link sign-in uses a separate tab without tokens or selected record details in the URL.

Local verification: 795 application tests passed; root/web typechecks, generated OpenAPI contract check, completion-register integrity, PGlite lifecycle assertions and browser production dependency audit passed. All 11 public pages and optimized CRM build passed. Ten added behavioral/contract/API cases cover private-download cancellation, incomplete/duplicate/unaudited records, current scope/permission checks, selection races and reauthentication. Generated OpenAPI changes are limited to /api/customer-export and CustomerExport. No dependency, database migration or gate-status change. Exact-head PostgreSQL CI, deployment mapping and read-only smoke are recorded in the release PR after execution.

Independent owner/provider/device/security review and the native engineering/security gates remain open. No real customer export, password confirmation, provider message or business mutation was performed for QA.
