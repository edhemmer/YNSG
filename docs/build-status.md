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
