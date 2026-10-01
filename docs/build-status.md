# Build checkpoint — September 30, 2026

Branch codex/crm-workflow from remote main 4f34df9. Website baseline inspected; no public content or form behavior changed. CRM not production-ready.

Completed: full master revision4 and available matching governing plans reviewed; latest remote baseline recovered; empty YNSG database and free organization inspected; governance, requirement matrix, authority, rule contracts, journeys, schema map, permissions, threats, providers, recovery, budgets and costs documented. Foundation, commercial workflow and scheduling/outbox migrations applied to Supabase YNSG; security advisor clean. Commit `5613e8f` pushed to `origin/codex/crm-workflow`. Vercel deployment `dpl_8d1sYQR7DeBo3u69Z28DwnBxFg5S` is ready at `https://ynsg-repo-efzu3y9ej-edhemmer-5018s-projects.vercel.app`; custom YNSG domain was not moved.

Current: implement/test first protected tenant and intake transaction migration, shared contracts and deterministic pricing. Preserve legacy endpoint behind explicit cutover flag. Quote/schedule/job/invoice/payment command surfaces compile and pass embedded/hosted migration checks; continue through Gmail/Calendar adapters, durable worker, portal, native iOS and recovery evidence.

External gates: actual sender/calendar/auth mail; owner setup checklist; hosting eligibility; private-file backup/restore; iOS signing/devices. Do not mark these passed from mocked tests. No changes to BRIX or AgencySuite.

Next commands: dependency version discovery and pinned install; migration creation via Supabase CLI; database integration tests; npm check/build; push branch and Vercel preview; update per-requirement evidence.
