# Customer appointment history correction — October 3, 2026

Audit item A08: portal appointments were selected from a page of jobs, so an authorized customer could lose visibility of appointments before a job existed or when that job was on another page.

| Check | Required result |
|---|---|
| Pre-job appointment | Visible only through an explicitly linked request/customer relationship |
| Job-based appointment | Existing authorized access remains |
| Independent history page | Appointment pagination does not depend on job pagination |
| Tenant separation | Company filter and current RLS both apply |
| Revoked relationship or deleted session | No appointment access |
| Public API data | Customer-facing fields only; no owner block reason, notes, raw intake or provider tokens |
| Bounds | 20 records plus one lookahead, stable ordering and hasMore |
| Verification | Migration/database assertions, production build, then real customer live acceptance |

Local database assertions passed for authorized past/future pre-job appointments, no job dependency, unrelated same-company denial, cross-tenant denial and immediate revocation. Portal query now uses independent bounded pagination. Hosted policy migration applied. Real customer account acceptance remains pending.
