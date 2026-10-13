# Email UX acceptance — October 13, 2026

Scope: current YNSG source, owner email previews, notification wording, appointment/invoice messages and redundant owner booking mail. Latest owner direction overrides older sample-count and owner-confirmation requirements.

## Pass/fail checklist

- Preserve official logo, Ed Hemmer signature, company-specific contacts and tenant permissions.
- Use natural customer language; keep deployment, credentials, IDs and backend setup out of customer messages.
- Request receipt does not claim a booking; retained appointment stays booked until a replacement is approved.
- Customer confirmation/reminder each has two distinct actions; no overlapping third button.
- Owner booking is shown in the workspace; no extra owner booking email is queued. Retain new-request alerts, reschedule alerts and useful 24-hour reminders.
- Preserve customer confirmations, pricing, scope, invoice numbers, approved invoice amounts, terms, actual-payment gates and optional review rules.
- Preview messages without sending; send only the selected sample to the approved owner address. Existing accepted/pending/uncertain results cannot be resent by the screen.
- Existing accepted, leased, sending and uncertain owner emails remain untouched; unsent owner booking notices are suppressed with a reason, never deleted.
- Owner email setup follows the independent Business email service, not a mandatory Gmail reconnection.
- Readable responsive preview cards, clear customer/owner filters, accessible preview focus, status feedback and disabled duplicate-send controls.
- Unit, PostgreSQL, type, syntax and production-build checks pass; no test mail or customer transaction is sent during this update.

Reviewed every changed template, full preview screen, notification screen, delivery summary, SQL change and assertions. Source review verifies escaping, safe links, exact financial values, private contacts and retained authorization. Browser/mobile visual acceptance is separate: this managed workspace has no supported control-browser skill, so no browser QA is claimed.

Local verification: 258 tests, empty-schema migrations and PostgreSQL business fixtures, root/web TypeScript, public syntax, ten-page website build and optimized Next.js build passed. Live deployment and hosted migration acceptance are checked separately before handoff.
