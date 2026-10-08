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
