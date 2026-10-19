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

## Rollout and rollback boundary

The migration is additive for stored evidence. During migration/build propagation, older strict tax/report clients may show a retriable unavailable state because new response fields/events are deliberately rejected; they must not assume an empty history. Do not issue a production credit until the credit-aware CRM and public/customer deployment are both READY and aliases have been verified. No real credit is part of release QA.

After the first credit exists, a build predating credit-aware balances is not a safe finance rollback target. Pause finance entry/delivery and deploy a repaired credit-aware build. Retain the migration, credit rows, original invoices, receipts, journals, command receipts and audits; do not use a destructive down migration or delete an adjustment to recover. Resolve a mistaken issued credit only through its exact reviewed opposite command.

## Engineering checks

Local `verify:release` passed: executable/OpenAPI contracts, syntax/types for website and CRM, 751 application tests, blank-schema migration/lifecycle fixtures and production dependency audit. Added API tests cover actual-byte bounds, origin, permissions, mismatched receipts and complete reads. Browser interaction tests cover lost-response exact replay, duplicate submit, draft retention, navigation locks and confirmed-save/read-failure recovery. PDF tests retain original creation metadata and date modification at the latest adjustment; added history paginates without losing totals.

Synthetic SQL covers credit/tax caps, original evidence, balanced journal/audit, exact replay, stale/changed attempts, duplicate correction, receipt overpayment, dated reconciliation and tax detail, cross-tenant denial, bookkeeper read-only and expired-session denial. Native PostgreSQL CI additionally races two credits and credit versus receipt; encrypted dump/restore compares retained credit rows along with invoices, receipts and journal. Exact CI/migration/deployment evidence is attached to PR #134 after those checks finish. This is engineering evidence; accountant/legal acceptance and actual owner/customer document walkthrough remain open.

Native PostgreSQL job 118055682676 in [CI run 39251206595](https://github.com/edhemmer/YNSG/actions/runs/39251206595) passed at candidate `21cca66242748d502e8878863e2df94bf03a2ece`, including both credit races and encrypted restore. Migration `invoice_credits` applied as Supabase history `20261019122223`. Read-only catalog checks confirmed locked search paths, invoker public wrappers, no anonymous execution, no service-role credit mutation, and no direct credit-table grants. Security advisors retain the previously tracked baseline; no new credit RPC exposure warning. Migration map now records 75 repository migrations plus seven Supabase-only history entries. Final-head CI and production deployment checks remain required.
