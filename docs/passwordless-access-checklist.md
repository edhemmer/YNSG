# Passwordless access change — October 3, 2026

Latest owner instruction: remove 2FA and continue the build. This supersedes earlier mandatory authenticator requirements in plans and historical audit records.

| Acceptance check | Required result |
|---|---|
| Ed login | Email sign-in link/code; no password or authenticator step |
| Owner setup | Verified live email session plus active invitation; one idempotent company claim |
| Tenant access | Active stored membership; no email-only role grant or user-metadata authorization |
| Customer privacy | Explicit unexpired customer relationship; no tenant crossover |
| Google and scheduling | Verified live owner/admin session; no AAL2 requirement; fresh provider facts and capacity controls unchanged |
| Platform administration | Explicit stored platform grant; no tenant customer-data access |
| Revoked/deleted/banned identity | Denied even with a stale token |
| UI and API | No authenticator enrollment UI, MFA error copy or hidden AAL2 gate |
| Notifications | Removing 2FA does not activate mail, invent a provider receipt or enable customer delivery |
| Migration | New versioned migration; preserve prior immutable migrations |
| Verification | Full database suites under AAL1, unit/type/build checks, hosted definition/advisor checks and deployed login-page check |
| Remaining build | Work against the canonical audit; no production-complete claim while mandatory flows are missing |

## Evidence

Full local migration/database suites passed using AAL1 owner/staff sessions, including invitations, revocation, tenant isolation, Google access, scheduling, calendar blocks and invoice commands. 43 unit tests and optimized CRM production build passed. Hosted migration applied; definition checks confirm removal of mandatory MFA from staff access, owner claim and scheduling evidence. Security advisor introduced no new database findings; the existing customer-password protection warning remains. Live owner sign-in and claim remain owner-controlled checks.
