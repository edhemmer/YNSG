# Owner decisions — October 8, 2026

Scope: clarify the existing proposed appointment workflow and make dashboard recommendations accurate.

Pass/fail requirements reviewed against the complete changed components:

- Accept proposed time opens the required scheduling review and displays the exact customer arrival and reserved work window in the business timezone.
- Choose another time opens a distinct release-and-reschedule form. It explains that the current proposal is released and a customer message queued before a replacement date is chosen.
- Decline proposed time defaults to declining only that time, keeps the request open, and returns to the request overview. Declining the entire service is a separate, explicit choice.
- Back without changes does not submit a decision.
- Missing or failed business totals never imply a clear workspace. Failed checks offer retry.
- Recommendations include pending time changes, proposals, queued messages, active/paused jobs, sent quotes and positive unpaid balances.
- Existing membership, revision, idempotency, calendar availability, travel, scope, equipment and pickup checks remain in force.
- Ed and Request service appt remain the approved wording. No brand, pricing or public website changes belong in this release.

Validation: 17 targeted scheduling, customer-action, request-inbox, visit-start and dashboard tests passed; final dashboard tests and optimized Next.js build with TypeScript passed. Reviewed hooks, effect cleanup, form labels, keyboard buttons, explicit mutation intent and existing authorization boundaries.

Limit: this is a source/test/build verification. The authenticated owner browser flow, real Google Calendar projection, received customer decision email, invoice settlement and phone notification still require live end-to-end evidence. Rescheduling an unconfirmed proposal remains two saved operations; a confirmed appointment retains its existing replacement-until-approval behavior. No payment, real customer record, provider activation or authorization policy was changed.
