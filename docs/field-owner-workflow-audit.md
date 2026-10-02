# Customer and field-owner workflow audit — October 2, 2026

Authority: latest owner directions. Subscription terms are later. Owner operations, reliable automation and customer accounts are the immediate release scope; iOS implementation is last. Public pricing must not describe the owner's private charge adjustments. Reminders are now due 24 hours before arrival.

This is a source, database-fixture and deployment audit, not proof of a completed live user journey. The CRM preview is protected; owner sign-in/MFA, provider consent, public topology, verified account mail and actual background delivery remain release gates.

| Journey step | Current evidence | Remaining work |
|---|---|---|
| Enter website | Public website and required-contact guest form exist; multi-category selections retained | Header sign-in connected to a public customer host; visual/device accessibility audit |
| Guest request | Working email handler has server validation and sends owner backup mail | One durable CRM request before acknowledgement; shared idempotency/retry across dashboard + email; scoped post-submit account offer |
| Customer account | Password/recovery screens; verified owner-issued history invitations; tenant access tests | Live account mail/verification, automatic request proof linking, profile/contact editing and consent |
| Repeat customer request | Authorized history/property reads exist | Reuse saved contact/property; work selection + available calendar only; no repeated full form; durable write/confirmation |
| Owner receives request | CRM queue and outbox intent exist separately from website email path | Connect website intake; automatic worker trigger and live delivery; backup email with details and request link |
| Owner opens/contact/notes | Request review, contact display, quote and job controls exist | Audited customer contact timeline, private account/service notes, communication outcome and follow-up reminders |
| Approve or decline | Scoped appointment approval/time-decline/service-decline commands and templates exist | Public selection/hold flow; confirm all request-level declines generate customer updates; live mail + calendar reconciliation |
| Private unavailable time | Owner block commands/UI, schedule lock, conflict checks, epoch invalidation and audit pass fixture tests | Real owner/mobile flow and multi-connection collision testing; public calendar never shows private reasons |
| Calendar booking | Canonical reservations, resources/buffers, reviewed Google synchronization exist | Customer available-slot selection/holds; recurrence; live Google/calendar freshness and recovery tests |
| Day-before reminder | Latest timing changed to 24 hours; customer template includes immediate rescheduling email instruction | Owner reminder copy/intent; recurring worker activation, actual delivery/timing/recovery tests |
| Next-day preparation | Resource records exist | Approved service-to-tool mappings; consolidated truck/trailer/materials list; previous-evening digest; unknown equipment flagged for owner review |
| Day-of field view | Today appointments and service request records exist | Date-based complete route list with customer/phone/address/all tasks, route order, one daily app notification, private notes, next-job action and print layout |
| Navigation | Addresses stored | Tap address to open Maps/navigation from current device location; no stored location tracking needed; platform-aware fallback |
| Weather | No working weather engine found | Verified property location, timestamped authoritative facts, outdoor classification and owner-configured thresholds; affected-day review/automatic policy; weather-reschedule reason/history, customer notices and calendar projection |
| Close work | Start/pause/resume and recorded sessions exist | Reviewed closeout of actual time, all tasks/materials, concerns/photos and remaining work; separate invoice review before email |
| Invoice | Approved quote snapshots; custom labor drafts with zero-charge reasons; immutable issuance; balanced charged totals pass fixtures | Branded PDF/document, explicit approve/send workflow, approved invoice-email renderer/worker; corrections/credits |
| Payment status | Confirmed payment allocations determine paid/partial/unpaid balances | Customer-facing status, financial delivery and receipt/thank-you automation; zero-charge invoice must say No charge, not pretend a payment occurred |
| Owner control | Requests, customer list, quotes, jobs, money, setup, catalog and integration panels exist | Full reports/expenses/mileage, recurrence, notes, equipment, weather, background action logs and readable operational alerts |
| Future Inlight AI SaaS | Tenant data/configuration and explicit memberships; separate platform metadata read module; no customer rights from platform role | Verified developer-admin provisioning, isolated subscription commands, branding/logo assets and second-tenant acceptance; terms/paid launch later |
| Intelligent automation | Deterministic commands/outbox and provider guards exist | Actual source-linked AI proposals and daily briefing; operational workers, retries, observability and escalation; never fabricate booking/payment/weather facts |

## Target operating behavior

Request submission commits one canonical request and notification intent before reporting success. Guest and account paths converge on the same tenant/request/order; account input is derived from authorized saved records. Selection creates an expiring capacity hold; owner acceptance reserves it atomically and schedules a customer confirmation. Declining sends the appropriate template and retains the original request/history. A selected time is not a confirmed appointment.

The owner receives an evening packing brief and one day-of briefing. The day view includes every selected service, each customer's contact and address, pickup legs where applicable, approved required tools/materials, and map actions. Print mode includes the operational essentials and omits sensitive account notes/access information by default. Changes invalidate stale packing/route plans and notify the owner once with a current view.

The 24-hour reminder goes to the customer and a separate owner reminder notice. It states: “If you need to reschedule, please email us immediately.” Customer rescheduling preserves the original appointment until an approved replacement, except an explicitly recorded weather disruption. Provider acceptance is tracked separately from intent creation; no exact wall-clock delivery claim is made.

Weather automation must first verify the job location and an approved outdoor-weather policy. Record provider/source, fact time, affected interval/location, weather condition and applied policy. An applicable event moves affected appointments to weather rescheduling, frees appropriate capacity, notifies customers and projects the calendar change through a recoverable outbox. No automatic new time is promised without verified availability and the configured approval policy. Unknown location, stale facts or ambiguous risk requires review; unrelated weather must never cancel a job. Indoor jobs remain subject to their actual access/travel safety policy.

AI can summarize tasks, suggest equipment and explain facts. Canonical commands enforce permissions, revisions, approved prices, capacity, payment allocations and recorded weather policy. Once the owner enables a reviewed automation rule, background work executes that rule and reports exceptions rather than demanding that the owner check every few minutes. No active AI agent deployment has been verified.

## Mandatory release checks

- Actual guest and signed-in customer submission through the public host reaches exactly one owner dashboard record and backup email.
- Optional signup and repeat login restore the correct history; no other customer or tenant can claim it.
- Concurrent website/manual selections and private blocks cannot overlap capacity; failed responses reconcile via receipts.
- Approval/decline/reschedule produce the correct current mail and Google event; canceled/superseded notices never send.
- Verified background execution produces customer and owner reminders, evening packing and day-of notification after browser closure.
- Every appointment appears in the dated route/print view; navigation and mobile controls are tested on actual devices.
- Weather tests use verified location/time/policy, preserve reasons, isolate indoor/unaffected jobs and recover from partial notification/calendar failure.
- Completed work reaches a reviewed immutable invoice; waived work stays recorded; delivered/paid statuses reflect provider acceptance and actual allocations.
- Backup restore, cross-tenant isolation, authorization revocation, monitoring and failure recovery are exercised on the intended production topology.

Current evidence: 42 unit tests; empty-schema PostgreSQL suites including account invitations, owner blocks, platform isolation, reduced/zero invoices; TypeScript and Next.js build. Public pricing removal deployed to main. CRM checkpoint 9a920878de92539b5aeb34dd917cdd60c92002e9 deployed READY. Account page was fetched successfully through the owner connector; other protected route fetches were blocked by Vercel Authentication and do not establish customer availability. Full end-to-end release is not passed.
