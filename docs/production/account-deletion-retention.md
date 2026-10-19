# Account deletion and retention

Scope: WEB-06 / IOS-07. Implemented behavior must pass isolated tests before migration/deployment. Owner/legal policy approval and actual device acceptance are separate evidence.

Pass/fail scope: own-account request/cancel; exact revision and replay; current verified fresh session for irreversible confirmation; all linked companies reviewed; versioned owner policies with explicit retention basis and periods; legal holds block processing; no orphaned company owner; immediate application access denial before Auth deletion; server-only irreversible Auth soft deletion; interrupted provider response reconciliation; receipt-only recovery without private record disclosure; retained issued evidence; owner queue and due-review dates; no invented legal periods or automatic financial erasure.

Rejected: hard-delete cascading business history, browser service key, arbitrary target-user deletion, token refresh as reauthentication, automatic hold expiry, declaring all personal information erased, fabricating owner/legal approval or Apple acceptance.

Retention periods begin at account processing for this workflow. They are review eligibility dates, not automatic deletion authority. Original submissions, service, financial, file and audit evidence remains in company custody. Owners must review due records and document any further lawful disposition through the governed records process. This implementation does not silently purge business evidence or backups.


## Available controls and limits

- Account: `/account` → Privacy and account deletion. A fresh verified database session is required to request/confirm. Password confirmation is same-actor; normal email-link sign-in remains available. A saved 256-bit receipt supports status and processing recovery without account access. Receipt values stay out of URLs and logs; the database stores its hash. Requests can be canceled before processing.
- Owner: Settings → Retention and deletion. Publish explicitly reviewed, versioned periods/basis/customer notice; place/review/release holds; approve each linked-company scope under the current policy. Prior reviews and policy versions remain recorded. Completed requests retain their original approved review periods. Record subsequent retention reviews, reasons and next review dates without changing original evidence.
- Policy periods are required owner inputs. No legal periods, approval, automatic financial erasure, customer consent or Apple acceptance is supplied by engineering. Company-wide holds deliberately apply conservatively to all associated deletion requests and never expire automatically.
- The irreversible confirmation revokes all memberships/customer access and blocks `live_identity` before the provider call. New grants to the identity are rejected. Saved device notification credentials are erased and pending device alerts are skipped. Owner queues and legal holds use explicit 50-row cursor pages; an identity with more than 100 historical company scopes requires operator review instead of a partial deletion. Concurrent owner deletions serialize and cannot remove the final owner through this workflow. A sole owner must arrange another authorized owner; no ownership elevation is fabricated.
- Server processing uses Supabase Auth `deleteUser(id, true)` only. This irreversibly removes sign-in identity details while preserving the actor UUID required by retained company history. A live service lease prevents concurrent provider attempts. Before retry, database `auth.users.deleted_at` reconciles an uncertain response; completion requires that same provider-confirmed deletion. No hard delete or financial-row deletion occurs.
- A processing request remains blocked if provider deletion fails. Keep the receipt and retry after the two-minute lease. If Storage ownership blocks provider deletion, an operator must review retained-file custody and supported ownership reassignment; never erase retained files to force deletion. No real account was deleted for release QA.
- Retained business records and backups need their own reviewed lawful disposition and accepted operational retention process. This release schedules and records reviews; it does not claim all personal information, original submissions or backup copies were erased. Provider/device acceptance and independent review remain open.

## Validation and release

Synthetic account, policy, hold, revision, receipt, provider-reconciliation and browser interaction tests are isolated. Native PostgreSQL additionally races owner deletion, hold placement and provider leases and includes privacy tables in encrypted restore comparison. Run `npm run verify:release`, required exact-head native PostgreSQL CI and optimized public/CRM builds before migration and release. Do not use production accounts for deletion QA.

Rollback: never remove a processing/completed request or restore pre-deletion authorization logic. Retain the migration and an account-deletion-aware application while repairing forward. An Auth identity deletion is irreversible; retained history, reviews and issued records must remain intact.
