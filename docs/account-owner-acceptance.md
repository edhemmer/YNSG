# Account and owner module acceptance

Authority: owner directions October 2, 2026; business and technical governance. iOS implementation comes last and uses canonical records.

| Requirement | Release condition | Status |
|---|---|---|
| Password access | Provider hashing, verified email, recovery, readable controls | Code/build verified; live Auth email pending |
| Optional account after request | Durable request proof plus verified identity; guest path preserved | Pending |
| Returning customer intake | Saved authorized contact/property, work and calendar selections | Pending |
| History | Tenant-scoped requests, appointments and invoice balances; no internal notes | Code/build verified; live connected customer pending |
| Owner private blocks | MFA, lock, conflicts, retries, audit, availability exclusion | PostgreSQL fixtures pass; live owner flow pending |
| Owner operations | Recurrence, closeout, expenses, reports, communications and settings | Partial |
| Invoice waivers | Record work and explicit zero charge/reason; no rewriting issued invoices | Labor drafts and immutable issuance implemented; reduced/zero fixtures pass; PDF/delivery pending |
| Billing revision | Remove half-hour website pricing; 10–60 minute overrun full hour | Copy changed; canonical policy pending |
| SaaS administrator | Owner accounts/subscriptions only; no customer data/impersonation | Isolated read module implemented; subscription mutations/activation pending |
| Owner contracts | Versioned subscription agreement and policy acceptance | Pending |
| Website account connection | Header sign-in and request-success offer on public eligible host | Pending |

Do not infer treatment of 1–9 minute overruns. Accepted quotes and invoices retain their terms. Paid SaaS remains disabled until pricing and agreements are reviewed. Platform subscription administration uses separate roles and narrow commands, without tenant staff membership or customer-table read rights.

## Account release configuration

Supabase Auth must enable email confirmation and password signup, allow the exact CRM `/auth/confirm` URL, and use a verified production SMTP sender. Gmail job notifications are a separate integration; enabling Gmail does not configure Supabase account mail. PKCE email links must be opened in the same browser. Account-link tokens travel in fragments, are removed from browser history and stored only in a short-lived HttpOnly cookie across signup. Owner-issued invitations expire after 24 hours and connect only the recorded, verified email to one explicit customer. Replays cannot restore revoked access. No historical records are claimed by name/address/phone.

The `/platform` role is not automatically assigned to any signup or tenant owner. A verified MFA user must be explicitly provisioned after identity verification. The module queries only company/owner/subscription metadata. No customer tables, notes, invoices, integrations, impersonation or tenant membership are added by that role. Paid subscription setup and policy publication remain disabled.

Evidence: 42 existing unit tests, empty-schema PostgreSQL migration suites plus owner-block, invitation and platform isolation fixtures; root TypeScript; Next.js production build. No real browser, live signup/recovery SMTP, provider delivery or multi-connection concurrency has been proven. Full production acceptance remains open.

Hosted evidence: four additive migrations applied. Anonymous callers cannot block times; server-role callers cannot claim customer invitations; authenticated clients cannot read the platform administrator list. Advisor review reports no new security findings after moving privileged commands to private schema. Existing leaked-password protection remains disabled; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. Performance findings are unused indexes only on the empty database.
