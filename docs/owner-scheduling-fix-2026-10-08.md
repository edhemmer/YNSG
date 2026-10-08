# Owner appointment field and phone alerts

Source: October 8 owner report: opening a request and setting an appointment fails in the date field. Owner selected Gmail alerts for new requests.

Acceptance before release:
- Replace combined native date/time field with a labeled visit date and configured half-hour start choices.
- Assemble the exact minute-format localStart expected by the existing scheduling API; preserve timezone, Google verification, approval, travel and retry protections.
- Preserve preferred date/time when it is supported, including weekly request wording.
- Reject missing, impossible, unavailable-day and unsupported times with actionable instructions.
- Verify unit regression, CRM types and production build; inspect the deployed owner route.
- Verify owner email delivery independently of phone notification permission; phone alert remains unverified until observed on the owner's device.

Investigation: the available browser remains signed out. No runtime error cluster or matching recent runtime log was found. The precise original native-field failure has not been reproduced in an authenticated session.

Executed: 164 regression tests passed; root TypeScript/syntax checks passed; CRM Next.js production build including TypeScript passed. The actual marked test request's owner notification and customer receipt are both accepted on first attempt. Inbox receipt was observed in the preceding acceptance pass; today's recheck of Gmail was rate-limited. No phone notification was observed.

Review: configured working days/hours supply the menu, no hardcoded franchise hours; options are candidates, not guaranteed available slots. Invalid/missing input is stopped before the API. Confirming existing proposals preserves their stored times. Canonical scheduling API, provider verification, reservations and outbox are unchanged. Live owner booking remains unverified because the available browser is signed out.
