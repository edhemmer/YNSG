# Scheduler integrity stage

Git commit: 0aba7a8, pushed origin/codex/crm-workflow.

Vercel preview: https://ynsg-repo-qr7clheo3-edhemmer-5018s-projects.vercel.app
Deployment: dpl_3sgs1eia8DbYnQ45YsaRoTPudWLE. READY. Next.js 16.3.8, apps/web, remote build completed in 29 seconds. Public ynsg production project unchanged.

Authenticated deployment fetch: homepage HTTP 200, shows accurate unconfigured workspace state. Authenticated CLI GET /api/scheduling: HTTP 405, no mutation. Actual browser/authenticated customer workflow not yet verified. Preview needs Supabase connection configuration and real owner setup; no claim that those work.

YNSG hosted migration scheduler_upgrade_integrity applied. Rollback SQL verified selection, interval exclusion, separate resources, proposal retry, approval, reminder timestamp, replacement, expiry, stale revision, retired unsafe command and ambiguous-send recovery. Deferred capacity constraint checked explicitly. Security advisor: no lints. Database organizations and appointments were empty before migration. Tests are synthetic, never live deliveries.

Local checks: empty database migrations, three SQL suites, seven domain tests, TypeScript, Next production build, nine-page static build. Git comparison to baseline 4f34df9 shows no changes to site/, api/ or scripts/build.mjs. Genuine concurrent transactions, providers, full browser/native workflows and recovery remain outstanding.
