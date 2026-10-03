# Invoice workflow acceptance — October 3, 2026

Scope: separate service completion and owner invoice approval (A16). Latest owner direction, governance, audit and existing ledger source reviewed. Delivery/PDF and paid thank-you remain separate open work.

- Complete service call closes active work timers, records an audit and retry receipt, and leaves an editable invoice draft. It does not issue an invoice or send customer mail.
- Only live owner/admin members can complete/approve. Company/customer separation and revoked-session checks remain mandatory; no 2FA reinstated.
- Final approval requires completed work, a saved draft matching current job revision, explicit review consent, exact reviewed total and retry key. Changed charges or stale revisions cannot issue an invoice.
- Issued invoices stay immutable; no-charge work and reasons remain recorded; journals balance and confirmed payments drive balances. Approval never enables Gmail or triggers old queued mail.
- Owner UI explains completed-but-not-invoiced and issued states accurately, removes combined completion/issuance, and locks competing job controls while a draft save/approval is pending.
- Database tests cover completion without invoice/mail, closed timers, repeated commands, changed retry payloads, stale approval/total, drafts after completion, authorization and issued immutability. Run full suites, TypeScript and production build.
- Publish only protected CRM branch, verify build and anonymous route denial; no public website/intake/Google activation. Real owner phone and mail/PDF receipt checks remain open.

Results: 63 unit tests, the complete local database migration/fixture suite, root TypeScript and optimized CRM build pass. Completion, timers, no automatic invoice/mail, required draft/review, exact totals, stale revisions, retries, cross-company/customer denial and revoked access are tested. Hosted migration applied successfully; old combined command is inaccessible to clients, anonymous and generic worker approvals are denied. Security review reports only the existing password-protection warning tracked under A22. Protected deployment and live owner interaction remain acceptance checks. Email/PDF and paid thank-you remain unfinished; the full app release gate is closed.
