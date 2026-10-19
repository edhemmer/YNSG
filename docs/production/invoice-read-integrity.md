# Complete invoice reads

Scope: WEB-05 / WEB-08, issue #35. Before-edit checklist:

- Require complete scoped receipt reads before publishing a remaining balance in owner lists, invoice JSON/PDF or invoice email.
- Reject truncated, duplicate, malformed, foreign, negative-net or overpaid receipt evidence. Preserve original/opposite cash and Zelle corrections.
- Recheck invoice visibility after gathering receipts; never turn access revocation into a successful zero-payment balance.
- Correct the invoice-history capability check to require billing permission, independently of proposal approval. Test billing-only, approval-only, expired/revoked access and sessions, another household and another tenant.
- Validate document query, payment administration and due date; use private no-store responses and retryable errors with no partial financial output.
- Keep canonical payment/correction, mail lease/idempotency and provider confirmation behavior unchanged. No production messages, bookings, invoices, funds or customer data used for tests.
- Preserve immutable issued work/tax/recipient snapshots, optional accounts, approved prices/services, brand, no required MFA, no Stripe/paid activation.
- Run full application/database/build CI, merge only tested head, verify both production projects and live read-only health.

Invoice credits remain separate engineering: issued charges, tax components, journals, receivables, customer documents and reports must all agree before that command is exposed. This read-integrity work does not advertise a credit capability.

## Implementation review

The shared reader validates up to 1,000 invoice identities and 10,000 receipts, uses scoped batches of at most 100 invoice IDs with exact counts, and verifies current parent visibility after gathering all receipts. A configured database row ceiling below the requested receipt bound causes a visible failure rather than a partial balance. Original issued fields are returned unchanged. This is a current read; it does not claim one historical database snapshot across an owner list.

Document JSON and PDF additionally validate the current invoice administration/receipt context and reject a receipt change between reads. Email preparation refuses to cross begin_delivery when receipt completeness, parent access or due-date validation fails; existing lease, current-notice and provider-outcome guards still control actual sending. No email was sent during QA.

The invoice screen can retry an initial read, blocks its print/download buttons after an unsuccessful refresh, hides previously displayed details on denied access while keeping mounted input state, and restores sharing after a verified refresh. PDF requests retain only invoice identity and format; account/workflow return parameters stay in navigation.

Tests cover complete split receipts and opposite corrections, partial/missing counts, null arrays, duplicate/foreign/orphan evidence, exact-cent overpayment, parent revocation, changed totals, batch scope, JSON/PDF equivalence, denied/malformed context, zero send-boundary calls on invalid email preparation, and navigation/retry/stale/denied/restored screen behavior. Native PostgreSQL CI exercises the customer billing permission matrix in the canonical service lifecycle.

Security advisor baseline retains the existing pg_net schema warning, reviewed public owner RPC warnings, two intentionally private RLS-without-policy notices, and leaked-password protection configuration warning. This migration changes one private function permission predicate and adds no exposed definer, table, grant, paid service or business record. Independent human security review remains open.
