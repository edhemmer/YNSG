# Customer portal completeness and recovery

Advances WEB-06 / #33 and WEB-05 account-facing receipt visibility. The portal previously trusted unchecked API JSON and nested payment arrays. A truncated receipt relation could therefore understate the amount received; incomplete profile/history reads could look empty. These checks preserve customer-facing scope and current RLS, with no schema migration or record mutation.

## Scope checklist

- Preserve optional accounts, current invitations/delegates, original invoices, signed receipt corrections, approved rates/services and existing account navigation. No mandatory MFA, Stripe/model/paid activation or production QA writes.
- Validate account relationships and complete history contracts on both server and client. Correlate the requested organization/page, reject malformed/duplicate records and invalid timestamps/timezones, and preserve legitimate null arrival values with the existing reserved-start fallback.
- Use exact counts for account relationships, companies, customers and properties. Explicitly bound metadata to 1,000 records. A missing count, truncation or incomplete result produces an unavailable/retry state, never a successful empty account.
- Read receipts separately for exactly the displayed invoices and selected organization, with current RLS and an exact count. Bound at 10,000; a server row ceiling or incomplete read fails before returning a balance. Reject duplicate or foreign receipt identities. Retain original positive and opposite correction amounts without clamping away discrepancies.
- Keep 20-row history pages and a 21st-row continuation probe. Reject null or oversized provider arrays rather than silently slicing an unverified response. Recheck the customer's current relationship/capabilities before returning history; access changes invalidate the assembled response.
- Preserve authenticated-only, no-store responses. Auth loss returns sign-in; data/verification failures return 503 with retry. Unknown responses never claim a save or alter financial evidence.
- Synthetic checks exercise malformed contracts, organization/page mismatch, partial count/data combinations, duplicate/foreign receipts, signed corrections and account-screen retry to the verified balance. Production checks remain read-only and sanitized.

This is a current-record read, not a historical as-of report or a replacement for financial reconciliation. Issued totals are immutable; the complete receipt read supplies their current signed receipt evidence. Large accounts beyond explicit bounds fail visibly rather than returning partial financial facts. No customer data was used in fixtures.

Full WEB-06 privacy/retention/deletion, controlled delivery, actual device acceptance and independent security review remain separate tracked work. This change does not claim those gates are accepted.
