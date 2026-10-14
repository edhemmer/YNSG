# Customer navigation and booking

The public request page previously displayed every service group, month, time and contact field together. Mobile navigation repeated large boxed actions and a fixed bottom bar. This release presents three stages: services, time, details. Navigation keeps labeled links visible and uses a compact call/request header with no fixed bottom action bar.

## Behavior and boundaries

- Existing service catalog, 15-job bound, pricing and service area remain authoritative. Something else requires a meaningful note. One category opens at a time; selections from other categories remain.
- Three next available dates lead to explicit time selection. A labeled month calendar remains available for other dates. Choosing a date never reserves a visit. Only a successful canonical hold receipt enables continuing with a selected time.
- Customers can explicitly choose to arrange a time instead. This clears an existing hold. Requests remain subject to owner review and confirmation.
- Back navigation retains entries. Expired holds return to time selection without discarding contact details. Clearing a draft returns to services.
- Name, phone, email, street and supported city remain required. Final validation reveals the stage containing an invalid field.
- Unknown delivery freezes editing and preserves the exact payload and idempotency key for retry. Definitive conflicts restore editing and refresh availability. No new endpoint, database command, notification or financial transition is introduced.
- Navigation targets remain at least 44px and inputs/primary buttons at least 48px. Reduced-motion behavior and keyboard focus are retained.

## Evidence and remaining gates

Synthetic DOM tests cover stage guards, explicit arrange-time, expired holds, recovery locks, Enter behavior, actual service selection, required details, bounded selections, draft clearing and identical-payload delivery retry. Existing calendar tests cover stale availability, canceled/lost selections and background expiry. Required release and native PostgreSQL CI must pass the exact published head. Public preview/live layout must be inspected before declaring the release complete.

Browser layout checks do not constitute physical iPhone/iPad or assistive-technology certification. Apple signing, APNs delivery, independent human review and the separately recorded native security gates remain outstanding. Owner customer/contact/property editing is a separate unfinished work item. Stripe remains excluded at the owner's instruction.
