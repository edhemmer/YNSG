# October 8 request recovery checkpoint

Continued the existing CRM source at `a9de7be` on an isolated review branch. The latest October 5 atomic website holds supersede the earlier notes that guest selection did not reserve temporary capacity. The original October 2 traceability rows below are historical, not current release acceptance.

This batch fixes interrupted submission recovery: the form retains the exact payload and request key, keeps editable fields locked while the result is unknown, and offers an accessible retry with phone/email fallback. A definitive rejection restores original control states; reservation conflicts refresh availability. Saved requests and uncertain sends are never released by navigation. Leaving an unsent form clears its released selection, returning from browser suspension checks the hold clock, and equivalent UTC timestamp formats preserve the selected button state. Hold-release requests use keepalive; database expiry remains the fallback if the browser cannot send.

The normal test command now includes `.test.mjs` regressions. The calendar harness uses the current hold contract; the weekly request test checks the signed durable CRM transport instead of obsolete email-only success. Tests cover interrupted sends, identical retries, rejected retries, failed hold responses, selection state, page exit, suspended timers, uncertain-send preservation and saved-request protection.

Verification: all 154 application tests pass; public syntax and nine-page build pass; shared and CRM TypeScript checks pass; Next.js production build passes; all empty-schema migration/PostgreSQL fixtures pass. Full changed files and generated page/assets were reviewed against `docs/request-recovery-checklist.md`. Local simulated DOM tests are not real iPhone or browser navigation-cache acceptance. No browser executable is available in this workspace. There are no schema, provider, DNS, pricing, service catalog, logo, or main-branch changes in this batch.

Remaining release work: live multi-client booking collisions; owner/mobile request approval, decline, reschedule and cancellation; actual current 24-hour reminders; invoice approval/send/PDF/paid follow-up; account recovery and isolation; encrypted restore and outside-app failure alerts. Twelve-month recurring reservations, durable packing/briefing and verified weather automation remain implementation gaps; native iOS and complete SaaS onboarding remain later work. Do not claim the project is production-ready.

Source delivery is recorded after repository synchronization; no deployment is claimed by these local checks.

# October 2 active CRM update

Owner approved production_workflows; applied and permissions verified. PR #3 merged into codex/crm-workflow at 902259fa1cde1e318797b8c84e375adcad6ea150; Vercel dpl_6fT1eeqdQrMzRtkB6Zs4Pu7VsfJ2 READY. Supersedes the earlier migration-blocked checkpoint below.

Next scheduling batch adds a protected read-only resource/reservation/block snapshot and owner calendar-check panel. It identifies open times for review using current Google free/busy, all selected resources, buffers, exact published minute policy and company timezone. It does not issue scheduling evidence, create a hold, approve a time or activate customer booking. Missing owner sign-in/configuration/Google consent remains visible. See evidence/availability-2026-10-02.md for tests and deployment status.

Required next: trusted feasibility reviews binding exact scope, request/configuration/schedule revision, route/resource/pickup facts and Google connection freshness; connect canonical hold/submit/approve without client-supplied verification booleans. Then guest-scoped customer selection and retained-original rescheduling, durable notifications/reminders and recurrence. Full production checklist remains release-blocked.

# October 2 production-completion review branch

See evidence/production-completion-2026-10-02.md. This batch is prepared on codex/production-completion; the active CRM branch/public site remain untouched by its review deployment. Multi-service hosted migration applied; broader production_workflows application blocked by auto-review and requires explicit approval. New feature readiness guards prevent using unapplied commands. Full CRM remains incomplete; do not claim release readiness.

# Build checkpoint — October 1, 2026

October 2 update: protected owner invitation/claim and MFA onboarding implemented and tested locally, in hosted rollback SQL and synthetic mobile browser flows. See evidence/owner-setup-2026-10-02.md. Google credentials and server key now exist in Preview metadata; owner sign-in/consent and live provider tests remain pending. Notifications stay disabled.

Google update: owner controls, encrypted OAuth + refresh/disconnect, owned calendars, free/busy, event projection/reconciliation queue, bounded worker endpoint, Gmail self-test and disabled outbox adapter added. Google migrations and expanded rollback SQL pass hosted; 15 domain/adapter tests and synthetic mobile UI controls pass. See docs/google-integration.md for exact deployed callback, configuration gaps and unfinished broader workflows. Existing public email unchanged. Google client credentials and Supabase server key pending; live consent/delivery unverified.

This checkpoint supersedes the historical notes below. CRM remains incomplete and is not production-ready.

Scheduler source tracked in docs/scheduler-upgrade.md. Resource exclusion and deferred capacity checks, selection/proposal/owner decisions, retained-original replacement, 48-hour reminder intents and uncertain-send recovery are implemented. Migration 20261001122819_scheduler_upgrade_integrity.sql applied to YNSG jvigtwjlkmeyavzbxjzl. Hosted scheduler rollback assertions passed; security advisor returned no lints. Synthetic fixtures rolled back. No real organization or appointments activated.

Local verification: empty-schema migrations plus foundation/commercial/scheduler SQL assertions, seven domain tests, TypeScript and Next.js production build pass. Static build produces nine pages. This does not establish concurrent-session races, live auth/providers, accessibility or recovery.

Deployment correction: dpl_8d1sYQR7DeBo3u69Z28DwnBxFg5S deployed the static site, not apps/web. Separate ynsg-repo review project is now configured for apps/web. Public ynsg project and custom domain unchanged.

Remaining implementation: recurrence, customer calendar and guest capabilities, provider adapters/workers, setup commands, portal/delegation, private uploads, reports, closeout expansion, native iOS and full workflow verification. Owner policy choices and real provider connections also remain required. No paid upgrades authorized.

## Historical September 30 checkpoint (superseded above)

Branch codex/crm-workflow from remote main 4f34df9. Website baseline inspected; no public content or form behavior changed. CRM not production-ready.

Completed: full master revision4 and available matching governing plans reviewed; latest remote baseline recovered; empty YNSG database and free organization inspected; governance, requirement matrix, authority, rule contracts, journeys, schema map, permissions, threats, providers, recovery, budgets and costs documented. Foundation, commercial workflow and scheduling/outbox migrations applied to Supabase YNSG; security advisor clean. Commit `5613e8f` pushed to `origin/codex/crm-workflow`. Vercel deployment `dpl_8d1sYQR7DeBo3u69Z28DwnBxFg5S` is ready at `https://ynsg-repo-efzu3y9ej-edhemmer-5018s-projects.vercel.app`; custom YNSG domain was not moved.

Current: implement/test first protected tenant and intake transaction migration, shared contracts and deterministic pricing. Preserve legacy endpoint behind explicit cutover flag. Quote/schedule/job/invoice/payment command surfaces compile and pass embedded/hosted migration checks; continue through Gmail/Calendar adapters, durable worker, portal, native iOS and recovery evidence.

External gates: actual sender/calendar/auth mail; owner setup checklist; hosting eligibility; private-file backup/restore; iOS signing/devices. Do not mark these passed from mocked tests. No changes to BRIX or AgencySuite.

Next commands: dependency version discovery and pinned install; migration creation via Supabase CLI; database integration tests; npm check/build; push branch and Vercel preview; update per-requirement evidence.
