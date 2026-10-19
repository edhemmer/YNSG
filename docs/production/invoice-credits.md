# Invoice credits and retained corrections

Scope checklist, before implementation: WEB-05/08 and #35.

- Preserve original issued invoice, work, tax jurisdiction/rates, recipient, receipts and journals.
- Append reviewed charge/tax credit amounts with a customer-facing reason. No invented tax rate/approval, payment, refund or funds transfer. Never exceed remaining original charge/tax components or the unpaid balance.
- Owner/admin issue and correct credits; current billing access reads them. Check live session, company, finance entitlement, exact credit revision, actor-bound idempotency and current invoice lock. Unknown responses replay the exact attempt.
- Mistaken credits get a retained opposite event and balanced journal; no deletion or arbitrary invoice mutation.
- Keep customer history, owner lists, payment cap/corrections, invoice JSON/PDF/email, annual tax detail, journal and dated receivables reconciliation coherent.
- No automatic payment thank-you or review request from a credit. Existing provider/idempotency boundaries remain authoritative. Stripe stays inactive; no paid activation, rate/service/brand changes or mandatory MFA.
- Exercise stale/racing commands, current/expired/revoked access, original/opposite component arithmetic, period/year boundaries and interrupted results in isolated fixtures. Production stays read-only except reviewed schema migration.
- Require full release checks, native PostgreSQL CI, tested-head merge, migration/privilege checks and both production SHAs/aliases/live smoke before release evidence.

Credits adjust an unpaid bill. They do not implement a refund policy or claim tax/accountant/legal acceptance. Charge and each original sales-tax component are explicitly reviewed; the system caps exact integer cents rather than inventing proportional tax treatment. Retention/deletion, provider/device acceptance and independent human review remain separate tracked scope.
