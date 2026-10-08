# Production completion continuation — October 8, 2026

Current owner instruction: complete for production. This record supersedes historical release status only where newer evidence is recorded. Public website main 52f3e7d is published; CRM stable preview head 5be538f remains the isolated working application.

Before changes: preserve verified live owner/member authorization, canonical billing and scheduling, exact money calculation, command idempotency, approved business rules and full official branding. No real customer changes, fictitious revenue, actual charges, provider consent changes or authentication bypass. Live owner browser remains signed out; authenticated acceptance cannot be substituted with privileged SQL.

Issues found: payment form interprets receipt date/time in device timezone instead of company timezone; payment submission key remains unchanged after successful partial payment; reviewed invoice/command errors are filtered into generic failures; a no-time request receipt refers to a requested time that does not exist.

Acceptance: payment amounts parse exactly to cents, company-local time converts deterministically and rejects DST gaps/repeats and invalid dates; successful payment resets its form and rotates key, while failed retry retains its key; reviewed billing messages remain readable while unknown diagnostics remain hidden; no-time receipt promises coordination without suggesting a selected appointment. Run meaningful boundary tests, TypeScript, full existing suite and optimized build; deploy only changed CRM files against current CRM branch.

Live audit at 18:59 UTC: 30 mail cron runs and 30 calendar cron runs succeeded in the preceding 30 minutes; all 11 supported existing outbox records accepted (five customer receipts, five owner alerts, one decline); zero public tables lack RLS. Scheduler success alone does not prove Google event operations. No new live payment or invoice is recorded by this continuation.

Outstanding gates: authenticated owner calendar create/move/decline/cancel and Google projection; actual invoice/PDF email and isolated test settlement/follow-up; phone notification receipt; provider token longevity, external alert/restore acceptance, second-tenant operator acceptance and native device release. Production certification remains pending evidence for these gates.

Verification: 171 application/unit checks passed, root TypeScript passed, optimized Next.js production build passed including application TypeScript and route generation. New payment fixtures cover exact cents, two company timezones, invalid monetary values, invalid calendar dates and DST gap/repeat refusal. Existing email tests verify no-time wording in HTML/plain text and all selected services. No database schema or provider credentials changed.

Release evidence: CRM commit de1691d496ff9b3646fe9132c1559375ec47f85a, tree b2908182687d8740e5c631e590957ce07fc1415a, deployment dpl_6ZNVdG8ZLrftx8UGGwBMeoTEvVEZ is READY and assigned the existing codex-crm-workflow stable alias. Public website production remains 52f3e7d. Independent root source checkpoint tree c41747577308fd2f3ccc062fb1285355f223d603 is preserved remotely at 9d06292a4b652e106fd6bc1e7584182b1d741607.

At 19:04 UTC, all 60 scheduler HTTP responses in the preceding 30 minutes were HTTP 200 without timeout. No grouped runtime errors were returned for intake, calendar decisions, billing commands, invoice delivery or either worker in the preceding hour. This does not establish exercised financial or calendar actions; the owner browser still requires sign-in.

## 15:49 CT continuation: invoice delivery status

Pre-change checklist: keep explicit reviewed invoice sending, immutable recipient, stable retry key and same-company authorization; polling must only read status, never send; avoid overlapping requests and hidden-tab polling; abort on invoice/company change; ignore an old invoice's pending send response; clear stale delivery state if status cannot be read. Browser restarted and currently has no authenticated owner session. No live billing mutation is authorized through a privileged bypass.

Change review: automatic delivery-status reads every minute while visible, no overlapping reads, aborted/inactive reads ignored, reads suspended during sending, changed invoice identity rejects prior send results; failed reads remove stale status, and manual refresh remains available on errors. Explicit reviewed sends, per-invoice retry key and provider-accepted wording are preserved. 171 tests and optimized production build passed. Signed-in visual and real invoice delivery acceptance remain pending; no global production certification.

## Email-link browser switch blocker — 16:33 CT

Owner reports the email link opens a different browser. Live test browser still shows Sign in to your workspace after refresh. Successful sign-in on the owner's phone is not evidence of a session in the test browser. Current sign-in UI/API already supports email OTP (6–10 digits); current delivered authentication email has a link without a code.

Pre-change pass/fail checklist: preserve the provider ConfirmationURL link; add only the provider Token variable for optional code sign-in; do not print/read/copy actual codes or sign-in links; preserve expiry, rate limits, session and tenant checks; no account/credential changes, no arbitrary verification endpoints. Prepare a readable template for the existing hosted Magic Link setting. Connected Supabase tools have no auth-config update operation, and no Supabase management credential is available locally. Hosted application is pending owner/provider setting access; a repository HTML file does not configure hosted email.

Primary source: Supabase passwordless email guide and local-development email template guide, retrieved October 8, explain that Magic Link and OTP share signInWithOtp, hosted email templates are edited in the dashboard, Token provides a code and ConfirmationURL preserves the link. Supabase changelog markdown fetch failed due unsupported content type; no SDK/schema change is proposed.

Prepared supabase/templates/magic-link.html with an optional provider code and unchanged provider ConfirmationURL. Review passed for both required placeholders, sole link destination, no scripts or invented expiry, and readable typography. Hosted setting is not applied. October 8 full PGlite migration/workflow assertion suite passed; actual owner/calendar/billing browser acceptance remains blocked.

## Owner Settings cleanup — 16:46 CT

Latest owner directive: apply the hosted sign-in email code template and remove technical setup steps from Settings; owners should not manage implementation details. Checklist before editing: remove infrastructure instructions, credential rotation/preparation and deployment/testing checklists from owner screens; preserve accurate connection/automation/failure status, owner Google consent/calendar choice, pause controls and sender receipt approval; preserve business contact/hours/pricing/tax/invoice preferences, current authentication/membership guards and legacy links. Never label a connection healthy solely from saved configuration. Technical setup moves to internal documentation. Hosted email template remains pending authenticated Supabase dashboard access.

Owner Settings review: removed infrastructure checklist, credential rotation/preparation controls and Google Cloud/deployment instructions. Preserved business forms, Google consent/calendar selection, send receipt approval/pause, authenticated membership guards and actual worker-health/queue warnings. Website connection is explicitly Configured rather than a claim of live delivery. All 171 tests, root TypeScript and optimized web build passed. Supabase dashboard authenticated as edhemmer, YNSG production project verified. Hosted Magic link or OTP template editing is disabled on the current free default-email service: UI requires custom SMTP, Pro or Send Email hook. No paid upgrade, SMTP credential or security change made; numeric-code template remains pending this provider prerequisite.
