# Request decisions and owner reminders acceptance

Scope: audit A09 and A10. Latest instructions take precedence: email-only owner authentication; 24-hour reminders; no provider activation without verified setup.

- Atomic decline, audit and durable customer email intent; repeated commands create no duplicate notice.
- A request with an active hold, proposal, reservation or unresolved scheduling review cannot be declined through the request action. Use its appointment workflow.
- Request declines use a distinct customer template, without claiming an appointment was confirmed or offering unavailable slots.
- Approval queues separate customer and owner reminders exactly 24 elapsed hours before arrival; revisions and canceled appointments suppress stale notices.
- Recheck current state when leasing and immediately before provider dispatch.
- Owner reminders contain contact, address, all requested tasks and the order link; no customer action capability is created for an owner email.
- Preserve verified mail activation, tenant roles, email-only sessions and uncertain-send reconciliation.
- Run unit tests, database migration/fixtures, TypeScript and optimized production build. Actual inbox delivery and recurring execution remain live acceptance checks.

Results: 50 unit tests pass; all empty-schema migrations and database fixtures pass; root TypeScript and optimized CRM build pass. Hosted migration applied successfully. Provider activation guards remain intact. Duplicate decline, active reservation protection, cross-tenant denial, owner reminder timing, replacement suppression and post-lease stale suppression pass.

Open live checks: owner invitation claim, Google authorization, verified mail receipt/activation, recurring worker execution with dashboard closed, actual customer decline receipt, both 24-hour inbox receipts and mobile decision controls. Customer rescheduling links and CRM order navigation need real rendered acceptance; these checks are not replaced by the build.
