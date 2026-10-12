# Independent CRM scheduling — verification and release gates

Active requirements: production scheduling must work without daily Google reconnect; preserve requested date/time/service summary and fast Approve/Decline/Review, two-hour minimum, tenant isolation, holds, owner blocks, travel buffers, recurring visits, local timezone/DST and accurate notifications. Retain all existing appointments and invoice records. Provider sync is optional and cannot decide whether a CRM booking commits. No fake availability, provider facts, payment or delivery outcomes.

## Pass/fail checklist before the architecture review

- PASS (source): canonical appointments, resource reservations, transactional commands and durable outbox already exist. Reuse these components.
- PASS (source): PostgreSQL active resource reservations have tenant/resource/time-range exclusion constraints; repeat commands use stable identities.
- FAIL (current release): /api/public-availability and owner /api/availability depend on live Google access/free-busy.
- FAIL (current release): websiteBookingFacts used by /api/website-hold and /api/website-request requires live Google.
- FAIL (current release): /api/scheduling-review and /api/recurring-preview require Google; database website_provider_clear validates Google connection revision/calendar identity. A client-only change cannot safely decouple booking.
- FAIL (current release): business notifications and sample delivery depend on Gmail OAuth. Independent scheduling alone does not restore customer communications.
- PENDING: explicit tenant scheduling authority/mode, owner-visible description and safe migration of existing appointments/blocks. Existing Google-only busy events must be reviewed/imported or manually blocked before changing authority.
- PENDING: CRM-only availability/hold/submission/approval/reschedule/recurrence paths preserving all capacity, freshness, authorization and transaction checks; never substitute an empty Google busy result.
- PENDING: post-commit optional provider export with per-tenant event mapping, stable event IDs, revision checks, exponential retry and visible connection health; failed sync never reverses or blocks a committed booking.
- PENDING: transactional customer email independent of calendar OAuth with durable intent, duplicate-safe dispatch and recipient/provider acceptance evidence.
- PENDING: simultaneous multi-connection overlap test, stale/repeated requests, hold expiration, all appointment transitions, local DST/recurrence and two-owner isolation.
- PENDING: true disconnected-provider browser -> API -> database -> response test and real customer/owner emails; restored-provider queue reconciliation without duplicate events.

## Recommendation

Use CRM as the authoritative schedule. Deliver one-way export to optional owner calendars first; keep appointment edits/cancellations in CRM. Defer automatic two-way business appointment edits until reconciliation behavior is proven. Opt-in external busy-time import is a distinct feature: preserve imported conflicts and show freshness, with an explicit policy when unavailable; never silently declare stale outside calendars clear. Owners use CRM Block time for commitments that must reliably block booking. Start with the existing Google adapter, then add Outlook through the same provider-neutral interface. A private revocable read-only calendar subscription can be evaluated separately for calendar viewers; it must never serve as conflict authority.

This is the best fit based on the existing engine and franchise requirements; no claim of universal optimality, zero hosting cost, instant provider sync or full production certification. External schedulers are reasonable for simple independent bookings, but introduce another event lifecycle and integration boundary here.

## Verified provider guidance

Google Calendar recommends incremental synchronization using persisted sync tokens, including full resync after HTTP410; push notifications reduce polling cost. https://developers.google.com/workspace/calendar/api/guides/sync and https://developers.google.com/workspace/calendar/api/guides/push
Microsoft Graph requires handling reauthorization, removed subscriptions and missed notifications, plus reconciliation/delta reads. https://learn.microsoft.com/en-us/graph/change-notifications-lifecycle-events

## Release decision

Architecture recommendation accepted by technical review; implementation NOT production-ready. Existing calendar click/reconnect UI repairs are deployed, but independent scheduling and independent transaction email are not implemented. Do not mark the above pending checks passed or restore booking by bypassing Google validation without the explicit CRM authority path.
