# Independent calendar build acceptance

Active scope: CRM-owned calendar; optional owner calendar view/sync; Google outages cannot stop booking; independent transactional notifications; preserve tenant isolation, current records, scope checks, travel, operating hours, holds, recurring local dates and exact invoice amounts. No fabricated busy intervals, provider acceptance or payments. No “Request help,” Edward, replacement logos, blanket availability or completion claims.

Before implementation: architecture review identified five Google-dependent booking boundaries. Reuse the existing canonical scheduling engine, constraints and durable outbox rather than another scheduler.

Implemented, pending live acceptance:
- Explicit per-organization calendar authority; CRM default for current and new organizations. Guarded CRM facts are bound to authority/configuration versions and a short validity window. Google mode remains distinct for legacy integrations.
- Availability, holds, website submission, owner approval and recurring preview use the selected authority. The SQL commit still rechecks operating hours, owner blocks, resource exclusion, scope/revisions, travel and capacity. Existing Google-only commitments must be blocked in CRM; external calendars are not silently trusted clear.
- Optional private revocable calendar subscription works with Google, Outlook and Apple viewers. Read-only; application-controlled refresh timing; customer details excluded by default; membership revocation invalidates access. Stable UIDs/revisions and cancellation records preserve identity.
- Existing queued Google projection remains optional after commit; reconnect failures cannot roll back CRM booking.
- Signed server-to-server transactional relay uses the website’s existing email credentials. Relay binds the configured organization, recipient, header/attachment limits and stable provider idempotency key. Test-domain senders rejected. Owner test must be accepted before managed mail activation; sender/contact changes and revocation invalidate approval.
- Calendar and email controls expose truthful status; independent scheduling is not marked unavailable solely because optional export is disconnected.

Evidence so far: 233 unit/template/security tests; PGlite empty-schema migrations and existing business assertions; cloned website hold/submission/owner-confirmation flow with Google disconnected; mail activation without Google, feed cross-tenant denial and revocation. Root/web types, website syntax/static build and optimized Next build. True multiple-connection race, hosted migration, live website day/time/hold, signed relay/provider acceptance, real inbox receipt and optional calendar viewer acceptance remain release gates.

No new real customer appointment, invoice or payment is asserted by fixtures. Implementation is not yet labeled fully production-certified.
