# Invoice, receipt and expense reconciliation

Advances WEB-08 / #35. Money → Business money activity → Reconcile invoices and receipts connects an explicit read to a guarded single-snapshot database function, strict response validation, an exact-cent opening/closing bridge, paged transaction detail and complete CSV. No production records or messages are manufactured for acceptance.

## Scope / pass-fail contract

- Preserve all original submissions, agreements, issued invoices, receipts, journals and expense/correction rows. This release is read-only apart from additive functions/indexes; it cannot issue a credit, transfer money, refund, send or approve tax.
- Preserve approved business scope, rates, brand, public pages and optional accounts. No practice workspace changes, Stripe/provider/model activation, paid resources or required MFA.
- Authorize every request with the current session and live owner/admin/bookkeeper membership plus finance entitlement. Public SQL is invoker-only; its private guarded function has an empty search path and restricted execute grants. No service-role fallback, direct browser table access or new public table.
- Dates are company business dates. Invoice issue and actual payment received timestamps use the company's timezone; expenses use their saved expense date. Receipt corrections use their recorded received timestamp; expense corrections use reversed_at. Later corrections never erase original earlier-period expense activity.
- Read all opening/closing invoice and receipt amounts from one stable database snapshot. Independently require opening receivable + gross issued invoices − signed receipts = closing receivable. Preserve negative balances for review rather than clamping discrepancies away.
- Return every transaction in the requested range or explicitly fail beyond 10,000. Bound dates to the shared accounting range (end minus start no more than 366 days), page display by 50 and export every verified row, not only the visible page. Unknown/incomplete/duplicate/mismatched amounts, unsafe integer totals and wrong company/range fail before display or download.
- Keep cash/Zelle original, replacement and opposite entries distinct. Include recorded processor fee/refund-fee changes only when already saved; no Stripe activation. An existing manual expense and separate processor fee remain separate saved facts; the system does not invent a deduplication decision.
- Show loading/permission/read-error/empty states distinctly. Explicit load only, single flight, 45-second abort, late company/range results discarded. Parent refresh or pending financial save clears prior results; no stale export. Invoice drill-through includes exact organization and invoice parameters. CSV escapes formula-leading text and preserves signed exact cents.

## Accounting meaning and limits

This is a gross invoice-to-cash timing bridge, not an income-tax basis election or a complete general ledger. Gross invoices/receipts include applicable sales tax and reimbursements. The billed and receipt views each subtract recorded paid expenses and actual processor fees, and differ by receivable movement. They are deliberately not labeled profit or taxable income. This release does not allocate partial receipts into taxable income, compute depreciation, recognize unpaid accounts payable, import bank statements, add owner draws/tax payments or infer unrecorded transactions. The separate complete balanced journal export remains available for audit. QBO remains disabled pending sandbox mapping.

Reports use the currently retained records with effective dates. A newly entered backdated actual receipt/expense can legitimately change an earlier effective-date report; this is not a reconstruction of what the operator knew at a historical instant. No production data is copied into tests or evidence.

The existing summary now follows the same expense correction dates. Expense totals can be negative in a correction-only period. Its expense count refers to original entries in the selected period not corrected by period end; the detail includes every original and correction. The expense management list remains filtered by original expense date; reconciliation exposes a correction even when its original expense lies outside the selected period.

## Verification and deployment

Isolated tests cover exact cents, split/corrected receipts, earlier invoice balances carried into empty periods, negative amounts, correction-only expense periods, later-correction non-erasure, >10,000 rejection, permission/session denial, partial and mismatched reports, company switching, failed refresh/retry, 50-row navigation, scoped invoice links and complete CSV. Canonical lifecycle fixtures exercise actual invoice/receipt commands; native PostgreSQL CI also executes the read-only reconciliation SQL. An existing UTC-midnight fixture bug was corrected to use the company's business date for a synthetic expense; no production time restriction was weakened.

Apply the additive financial_reconciliation migration only after exact-head native CI passes. Verify catalog privileges and migration history, then both production deployment SHAs and public health. PR/issue evidence records executed results. WEB-08 remains working: invoice credits, complete tax-basis reconciliation/accountant review and QBO sandbox mapping remain separate work/acceptance, not waived by this source-backed gross timing bridge.
