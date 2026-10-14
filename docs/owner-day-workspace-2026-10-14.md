# Owner daily workspace contract

The owner opens Today, sees the next confirmed stops and operational totals, then opens a request's existing guided job workspace. No provider or database business mutation occurs on home-screen load.

## Read model

`GET /api/owner-day?organization=<uuid>` requires a verified live session and current owner/admin membership. Queries stay organization-scoped and use the authenticated RLS client. Unknown inputs are rejected. The executable bounded response is in `apps/web/lib/owner-day.ts` and the generated OpenAPI contract.

Return the next 12 reserved appointments whose end has not passed, ordered by work start then ID. Read 13 to detect overflow; show the next three on Today with an explicit Calendar continuation. Customer arrival remains separate from pickup/work start. Appointment dates use the company's timezone. Expired proposals and canceled visits are not confirmed stops. Failure replaces the data with a retry state rather than leaving an actionable stale appointment card. This is a schedule read, not a promise that work is unfinished: opening the job resolves its canonical work/billing state.

Working, paused and completed-uninvoiced totals are exact existing business-snapshot counts, not totals inferred from the first records page. `GET /api/owner-work` queries the unfinished jobs themselves with owner/admin permission, scoped authenticated RLS, exact counts and 20-job pagination. It excludes issued invoices using the existing invoice relationship and orders oldest first. Every quote/request join must resolve or the page fails visibly. Earlier unfinished work stays accessible through Jobs even after its appointment ends. Outstanding invoice balances remain based on recorded receipts; estimates do not contribute.

## Job context and holding invoice

The existing Confirm → Complete → Invoice → Close out workspace retains the confirmed appointment during work, invoice review and payment. A reserved appointment has a pending invoice preview immediately, with the accepted version's scope, time and labor estimate when available. An issued invoice removes that job's holding preview. No agreement means 'Awaiting agreed price'; no invoice number, amount due, payment intent or customer email is created by this preview.

The canonical work completion, invoice review, actual tax/business gates, payment confirmation, exact-replay recovery and audit commands are unchanged. The holding preview is not a persisted financial draft: actual-work draft entry remains inside the work/invoice review flow. Do not advertise a scheduled estimate as an issued invoice.

## Acceptance and remaining scope

Automated checks cover response bounds, strict inputs, company-local dates, pickup separation, rendering, retry and holding states. Production walkthroughs are read-only. Device usability, comprehensive customer/contact/property edit commands, native authentication/sharing, APNs activation, independent security review and Apple distribution remain separate gates; this web increment does not certify or complete them.
