# Owner notes acceptance — October 3, 2026

| Requirement | Pass condition |
|---|---|
| Request conversation | Append a note before a customer account or job exists |
| Customer relationship | Include direct customer notes and notes from explicitly linked requests |
| Privacy | Owner/admin only; no customer portal or platform-admin access |
| Reliability | Stable retry key, one note and audit record; changed replay rejected |
| History | Append-only records; browser/API cannot overwrite or delete notes |
| Company permissions | Verified live identity and active stored membership; no 2FA gate |
| UI | Request/customer notes, clear saved/error state and mobile-sized controls |
| Bounds | Maximum 4000 characters, 50-note page plus lookahead, stable ordering |
| Proof | Local DB isolation/replay/revocation tests, build/type checks; live owner entry remains pending |

Local database tests passed: request note before customer/job creation, identical retry, changed replay rejection, no guessed customer linkage, direct overwrite denial, linked customer history, customer and cross-company denial, one audit record per note and immediate owner revocation. Optimized CRM build and TypeScript passed. Real owner mobile usage remains a live acceptance check.

Hosted verification confirms note RLS is enabled, no direct authenticated SELECT/UPDATE, anonymous and service-role note creation denied, and the read command checks owner/admin membership. Security advisor found no new database findings.
