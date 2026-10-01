# Deterministic rules and contracts

Pure functions take rule version, UTC clock and provider-fact snapshot explicitly. No network, random IDs, implicit Date.now or model output inside decisions. Money is bounded safe integer cents; multiplication/division uses integer arithmetic and explicit rounding. USD only at launch.

Command envelope v1: command, organizationId, idempotencyKey, expectedRevision, input. Trusted route binds public organization; staff selection is checked against current database membership. Error v1: code, safe message, correlationId, retryable. Codes include VALIDATION, UNAUTHORIZED, FORBIDDEN, STALE_REVISION, IDEMPOTENCY_CONFLICT, TRANSITION, SETUP_REQUIRED, CAPACITY_CONFLICT, PROVIDER_UNAVAILABLE.

Each command checks live authorization/entitlement, validates inputs and transition, locks relevant rows, compares revision and prior idempotency payload, writes domain/audit/outbox in one transaction. Only after commit can a leased worker call a provider. Retry with a changed body is a conflict; replay with the same key returns the committed result.

## Transitions / event taxonomy v1

| Command | Preconditions → result | Event |
|---|---|---|
| SubmitRequest | valid guest data, throttle → submitted | request.submitted |
| ReviewRequest | submitted/reviewing + revision → reviewing/declined | request.reviewed |
| PublishQuote | reviewed scope, pricebook/policy → immutable sent version | quote.published |
| ApproveQuoteVersion | authorized contact, current sent version → accepted | quote.accepted |
| ReserveAppointment | accepted scope, setup, fresh travel/busy, locks → reserved | appointment.reserved |
| MoveAppointment | current revision, same feasibility checks → new reservation | appointment.moved |
| ApproveChange | current quote/change version + permission → approved | change.accepted |
| TransitionJob | approved → scheduled → en_route → arrived → working ↔ paused → completed | job.transitioned |
| CompleteAndInvoice | working/paused, approved final scope, seller/tax/terms resolved → completed + one issued invoice + balanced journal | invoice.issued |
| RecordPayment | confirmed collector/provider, valid unallocated funds → allocation + journal | payment.recorded; invoice.paid only crossing to fully paid |
| ReversePayment | authorized original receipt → linked reversing journal/allocation | payment.reversed |
| PublishCompanyConfiguration | current draft revision, permission/contrast/schema → new published version | configuration.published |

Invoice lifecycle issued/void/credited is separate from delivery state and derived unpaid/partial/paid/overdue. A fully credited or written-off balance is not a paid service. Receipt/thank-you eligibility requires actual settled allocations and completed work, no owner hold, current authorized recipient/preferences. Unknown Gmail outcomes do not retry automatically.

Scheduling: full reservation at least 120 minutes in 30-minute increments, Monday–Friday, starts 08:00–15:00, ends <=17:00 local. Validate both neighbors, travel+buffer, supplier hours/readiness and resources. Holds expire under the same lock before capacity decisions. Owner override is separate, audited, never silently shifts another job. External facts may race after commit; flag and reconcile, do not claim distributed atomicity with Google.

Financial invariants: approved hourly minimum applied once; supplier prepaid excluded; actual-cost authorized reimbursement separated; issued lines immutable; ledger debits=credits; allocated amount never exceeds available receipt or allowed invoice balance; refunds/credits/reversals explicit. No unapproved partial rounding, due date, tax exemption, late fee or surcharge.
