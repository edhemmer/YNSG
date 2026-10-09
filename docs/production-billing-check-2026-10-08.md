# Billing and message status — October 8, 2026

Owner instruction: continue production build. Reviewed the active conversation, current source, prior production requirements and latest deployed CRM commit 9b8126e1b29f64ce937a73679793b56a29464182.

Story: owner records reviewed work, saves exact invoice cents, approves the issued invoice, explicitly requests PDF email delivery, records a received payment and inspects the queued paid follow-up.

Pre-change checklist:

- Preserve Ed, Request service appt, official branding and current business rules.
- Charges must retain exact cents, allow documented zero-charge work and reject fractions of a cent instead of silently rounding.
- Save and approval must retain membership, job revision, reviewed-state and idempotency controls.
- Late invoice responses must not change a different job/business/revision or update an unmounted form.
- Message polling reads status only, avoids concurrent reads, stops on unmount, skips hidden-tab periodic reads and clears stale data on failure.
- No real charges, fabricated paid revenue, authentication bypass, credential changes or provider activation.
- Passing source/tests/build is distinct from live owner/calendar/email/payment/phone acceptance.

Changes: invoice amount inputs retain raw dollar text and validate exact cents before save or approval; invalid totals show a correction prompt. Invoice loads abort on target changes; late mutation responses are ignored for another target or unmounted view. Messages to check refreshes every 30 seconds while visible, with abort/in-flight/error guards and manual refresh.

Verification: 176 application checks passed; optimized Next.js build and its TypeScript check passed. Root TypeScript detected an extension missing from the previous dashboard helper import; corrected it and verified root TypeScript. Exact-cents boundary cases include zero, one cent, single-decimal input, maximum supported charge, fractional cents, exponents, negative values, empty values and invalid strings. Entire changed components reviewed against the checklist, including approval guards, retry keys, role-controlled parent usage, input labels, zero-charge reasons, sums, fetch cleanup and prohibited wording.

Live baseline: owner browser reaches sign-in and has no authenticated session. Recent CRM runtime error clusters were empty. Current company configuration version 2 has Ed Hemmer; Gmail delivery is enabled. Eleven existing outbox records are provider-accepted with no pending/failed records. This establishes queue state, not recipient receipt or phone notification.

Remaining evidence: signed-in owner request-to-confirmation and Google event operations, issued invoice PDF email receipt, isolated test settlement/paid follow-up and actual phone notification. Full production certification remains pending. No live financial record was created by this continuation.
