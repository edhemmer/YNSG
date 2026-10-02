# Customer appointment actions acceptance checklist

Authority: active owner directions, master revision 5, scheduler upgrade and production checklist. This change is one part of the required full app; it does not establish production readiness.

| Requirement | Pass condition | Status before implementation |
|---|---|---|
| Scoped access | Hashed, expiring, revocable bearer grant bound to one tenant/request/appointment/current recipient | Implemented; fixture checks pass |
| Scanner safety | GET and email preview cannot mutate; actions require intentional same-origin POST | Implemented; fixture checks pass |
| Privacy | No token in query, logs, HTML metadata or referrer; no unrelated history or invoices | Implemented; fixture checks pass |
| Confirmation | Attendance confirmation does not approve scope/price or rebook capacity | Implemented; fixture checks pass |
| Reschedule | Original remains reserved; owner notified; request and service selections remain intact | Implemented; fixture checks pass |
| Decline-time | Same-request return, reason and service selections; no duplicate request | Implemented; fixture checks pass |
| Revision/retry | Reject changed appointment/response; same committed command resolves safely after HTTP timeout | Implemented; fixture checks pass |
| Reminder | Current 48-hour or immediate under-48-hour action link; obsolete/late reminder suppressed | Implemented; fixture checks pass |
| Accessibility | Large explicit controls, readable text, mobile layout, pending/errors; browser/device review separate | Code/build verified; browser/device review pending |
| Isolation | Second tenant, expired/revoked grant and removed recipient fail; ordinary clients cannot issue grants | Implemented; fixture checks pass |
| Delivery honesty | Provider accepted differs from delivered; uncertain send requires reconciliation | Preserve existing rule |
| Production activation | Real owner Google consent and independent test receipt; background automation verification | Pending owner/integration work |

Preserve official public website/logo/copy/email until full CRM cutover is verified. No new customer email sends in development. No added fees, inferred Community eligibility, raw payment data, automatic schedule change or AI decision. Customer calendar slot selection still requires canonical capacity and verified travel; preference entry must never claim to reserve a slot.

## Evidence and remaining work

42 unit tests pass. PostgreSQL fixture suites cover link expiry/revocation/recipient changes, current appointment and response revisions, repeat commands, owner isolation, original reservation retention and same-request decline-time response. Mail assertions cover accepted-test versus received-test authorization, stale test IDs, duplicate authorization, paused delivery, tenant isolation, exclusive company leases and uncertain-send reconciliation. Root TypeScript and Next.js builds pass. Provider sending and real browser/device accessibility have not been verified.

The customer page currently accepts preferred replacement times for owner review. It does not yet present the required feasible availability calendar or create a customer-selected tentative slot. Existing owner-reviewed proposal/replacement commands remain the only booking path. Do not mark the full scheduler complete.

Background dispatch is implemented through a secret-protected endpoint and fair company leases. It still requires an approved recurring trigger, production environment and live Google consent/receipt. The global delivery switch remains disabled. No real customer emails were sent.

## Hosted checkpoint evidence

Commit `ee22af93457dd2fe0138252c9aa6baaf153db345` deployed READY as `dpl_Ax673xYvyNSUe1QVsZ3YvrHpKZ2k`. The customer page returned HTTP 200 with noindex/no-referrer metadata. GET `/api/customer-request` returned 405; an unauthenticated worker GET returned 401. These read-only checks do not establish signed-in browser, email-scanner JavaScript execution or real-device accessibility coverage.

Hosted migrations `customer_request_actions` and `verified_mail_dispatch` applied successfully. Privilege checks verify server-only customer actions and worker company selection; the server role cannot authorize company mail delivery, and ordinary clients cannot read the link table. Hosted customers, appointments and enabled mail-control counts remain zero. No real customer notices were sent.

The database advisor identified 17 app-owned foreign-key index gaps and three caller-ID RLS evaluation warnings. An additive follow-up migration covers those relationships plus the preference queue and preserves the exact policy predicates. Empty-schema migrations and all PostgreSQL fixture suites pass with those changes. The follow-up migration applied successfully. The hosted performance advisor no longer reports the 17 missing-FK-index findings or three RLS caller-ID warnings. The private invitation table now has an explicit deny policy; its security informational notice is cleared. Newly created indexes are reported as unused because the hosted app has no operating records; these are retained for their intended relational/queue access paths. Leaked-password protection remains a separate existing Auth configuration warning requiring resolution before the applicable production authentication release.
