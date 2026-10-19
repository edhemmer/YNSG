# Verified payment history and failed-read recovery

Advances WEB-05 / WEB-11 and #35. Existing canonical receipt/correction commands remain authoritative. This release connects strict scoped GET response validation to invoice payment display and prevents a failed refresh from enabling another financial action on an unverified balance.

## Scope / pass-fail contract

- Preserve every original invoice, receipt, correction, journal and exact saved attempt. No invoice credits, funds transfer, refund command, message, practice expansion, public redesign, paid/model/Stripe activation or required MFA.
- The API calls the existing actor-scoped invoice_payment_context RPC, validates its bounded output, and correlates the response with its exact requested organization/invoice. This correlation is not an independent database provenance signature: SQL permissions and supplied RPC arguments own source scope.
- Require typed admin state, IDs, dates, method/sign combinations, unique original receipts and valid original/opposite cash/Zelle links. A correction must match the original method and exact opposite amount, and cannot appear twice. Validate aggregate integer cents; the client additionally checks nonnegative receipts do not exceed the immutable issued total it already displays. Invalid records fail closed instead of being clamped into a paid state.
- Bound each returned receipt/order/processor array to 10,000. No silent truncation or empty-success fallback. This validation does not add database-side pagination for larger histories or independently reconcile a provider/bank statement.
- Validate checkout URL origin, optional credentials, known order states and one pending checkout. Preserve an open checkout with no URL for deliberate existing recovery. Minimize alert details to the status/event type consumed by the screen. No payment-provider connection is activated.
- Failed reads mark prior figures stale and disable new receipt, correction and invoice-record actions until a successful verified refresh. The local receipt draft stays mounted. A denied session hides the saved-history container while retaining local unsaved inputs for restoration; this is display handling, not secure erasure of data already viewed by the user.
- Distinguish read failure from unknown save. Unknown receipt/correction attempts retain their existing exact-body/key recovery and navigation lock. A read retry sends no financial command. Failed reads alone do not trap navigation.
- A reference flag marks the read unverified before awaiting network work, so a same-event receipt submit cannot race the visible stale-state update. Late invoice/company responses are discarded. Reads have a 45-second timeout; authorized restoration requires a fresh verified response before actions re-enable.

## Verification

Contracts test duplicate/orphan/mismatched/overpaid receipt data, invoice identity, original/correcting pairs, checkout origin and pending-state integrity, provider row arithmetic and alert minimization. API tests distinguish bad input, malformed private source data, denied access and read failure without exposing raw errors. Interaction tests retain dirty receipt fields across failures and denied/restored access, block further receipt submission, reject wrong-invoice/invalid paid states, preserve document drafts and continue existing exact unknown-save replay scenarios.

No migration, customer QA mutation, device/provider-delivery proof or independent human acceptance is added. Issue #35 retains invoice-credit and full tax/accounting acceptance work; WEB-11 still requires the named independent reviewer.
