# Invoice customer presentation checklist — October 3, 2026

Reviewed current owner instructions, governance, audit A16, issuance/approval migration, document API, document formatter, page, and invoice regression fixtures before implementation.

- Capture only customer name, email, phone and service address in the immutable invoice at owner approval, from the explicitly linked request/property in the same company.
- Retain approval, reviewed total, completed-job, draft revision, finance entitlement, retry, quote approval and immutable ledger guards.
- Never match customers by email or use unrelated latest contact data.
- No automatic sending, payment collection, private waiver reasons, raw configuration, internal notes or overrun policy on documents.
- Use Business name, not Seller. Preserve recorded terms and exact cents/payment balance.
- Clearly flag older invoices without recorded customer details; never silently substitute current mutable customer data.
- Readable phone/print layout and appropriate navigation for owners/customers.
- Verify database snapshot isolation, customer edits after issuance, tenant/auth denial, document field filtering, null legacy handling, both builds and deployment.

Live customer/owner device rendering and printed output remain open. This component does not complete invoice email/PDF delivery or payment follow-up.
