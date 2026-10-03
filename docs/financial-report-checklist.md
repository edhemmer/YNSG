# Finance increment acceptance checks

- [x] Only owner, admin and bookkeeper can record, reverse and read company expenses and report data; another company and customers see nothing in synthetic SQL tests.
- [x] Expense capture requires confirmed external payment, positive integer cents, category, vendor and expense date; no card or bank credentials, no supplier-paid customer materials.
- [x] Retries return one result; changed retries, double reversal, future dates and unauthorized writes fail without partial journal entries in synthetic SQL tests.
- [x] Every expense/reversal has a balanced immutable ledger entry and audit event in synthetic SQL tests.
- [x] Date-bounded report totals span more than a 50-row workspace page and distinguish cash received, cash expenses, issued invoice amounts and outstanding balance; basis and range are labeled.
- [x] CSV summary export neutralizes spreadsheet formulas and uses authorized report data; no estimated tax, profit or deduction claim.
- [x] Hosted additive migration and read-only table, grant and RLS checks pass; no live expense was created.
- [ ] Preview deployment and real owner/browser verification; bookkeeping reconciliation remains a separate gate.
