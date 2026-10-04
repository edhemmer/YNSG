# Customer appointment calendar — October 4, 2026

Source: active conversation, master business/scheduler requirements, current main and CRM branches.

## Pass/fail requirements before release

- Replace “A day or time that usually works?” with plain appointment selection.
- Show a readable month grid with labeled controls and large touch targets; keyboard-operable dates/time buttons. No images, jargon, raw errors or customer details in availability responses.
- One-time request starts must be future and within 30 local calendar days in America/Chicago; server validates, not only the browser.
- Recurring request records weekly same weekday/local time for 12 calendar months; DST must preserve local time.
- Calendar only offers times actually checked against business calendar, owner blocks and resource reservations; setup/provider failure must never fabricate availability.
- Customer requests remain subject to owner approval. No claim that a selected time is locked or a year is reserved unless the reservation engine has actually committed it.
- Required name, phone, email and address; multi-category services and working existing email flow preserved.
- Privacy, approved name, copy, logo, rates, exclusions and no new pricing promises preserved.
- Exact-date/30-day boundary, recurrence/leap-year, provider failures and forged input tests; full build and database regression checks.

## Known live blockers

Live YNSG configuration count is zero. There is one available operator. Existing website-to-CRM intake remains disabled. Guest holds and recurring occurrence reservations are not implemented. This change must not claim completion of those workflows. Owner setup and end-to-end live availability/approval/notification tests remain necessary before activation.

## Implemented and locally checked

- Appointment picker replaces the rejected free-text question. Month/calendar and time buttons have labels, 48px targets, keyboard focus, explicit press/click instructions and selected-state text. Actual mobile/VoiceOver testing remains outstanding.
- One-time and first recurring selection reject past, weekend, non-half-hour, outside 8a–3p and more-than-30-local-day starts on the server. The configured owner's narrower hours/lead/horizon can further restrict offered slots.
- Weekly request records weekday, local time, first date and exclusive 12-calendar-month ending in the canonical preferredTime field; the existing request and email retain it. Calendar dates, not elapsed 168-hour additions, represent weekly intent across DST. This is a requested pattern, NOT committed occurrences.
- Read-only server availability is scoped to a server-configured company and one available operator, checks a published configuration and scheduling entitlement, owner blocks, active resource reservations and Google free/busy. Incomplete/truncated/malformed/provider/setup responses fail closed. No names, addresses or event details are returned.
- Public proxy rechecks a selected slot before accepting a request; it does not reserve the slot. Reservation/approval remains a separate necessary workflow. Both applicants can still request the same currently open slot; no double-booking guarantee is claimed for this interface.
- Calendar remains hidden on setup/provider failure, with a clear call/request fallback. Existing email flow remains available without a time; no raw errors are shown.
- CRM production build, 107 unit tests, full PGlite migration/workflow regressions, public nine-page build/syntax checks and five public gateway/intake tests passed.

## Release gaps / required next work

1. Publish complete business settings with reviewed scope, hours, lead time, travel buffer and resource rules.
2. Configure the public-to-business availability bridge and verify real Google busy events, owner blocks, dates and provider failure. Never bypass deployment protection to expose the rest of the owner app.
3. Complete guest atomic hold/proposal lifecycle and 12-month occurrence generation/approval with conflicts handled before any series commits. Connect that workflow to website intake, account requests and manual owner entry; currently the pattern is request information only.
4. Verify customer/owner notification and calendar sync for recurring changes, pauses, cancellation and rescheduling; do not create an unbounded Google recurrence as a substitute for individually recorded appointments.
5. Actual live calendar/browser/mobile selection and concurrent customer/provider tests remain release gates. No owner settings or approvals were fabricated.

## Follow-up: owner weekly review

- Corrected the new-company scheduling template from 36 hours to 30 days (43200 minutes), with a days-based setting. Existing published company settings are never silently overwritten.
- Added a private owner-only weekly preview alongside request scheduling. The server checks every calendar-date occurrence for 12 calendar months against live Google free/busy, tenant-scoped owner blocks and reservations for every selected resource. Missing resources, truncated responses, stale or malformed provider results fail closed.
- The same local time is converted separately for each date; daylight-saving transitions do not shift the requested local hour. The first date is constrained to 30 local days; later dates are reviewed beyond the one-time horizon. Operating hours, lead time, duration and travel buffers still apply.
- Preview is explicitly advisory and creates no appointments, reservations, calendar events, invoice records or notifications. Atomic recurring approvals and individual per-visit job lifecycles remain required implementation work.
- Live setup checked: Google connected with calendar selected; scheduling entitlement enabled; no published configuration; Gmail test not yet verified. Vercel environment-variable listing is denied by the connector (403), so availability bridge activation was not verified.
