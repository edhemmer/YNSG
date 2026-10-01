# Build checkpoint — September 30, 2026

Branch codex/crm-workflow from remote main 4f34df9. Website baseline inspected; no public content or form behavior changed. CRM not production-ready.

Completed: full master revision4 and available matching governing plans reviewed; latest remote baseline recovered; empty YNSG database and free organization inspected; governance, requirement matrix, authority, rule contracts, journeys, schema map, permissions, threats, providers, recovery, budgets and costs documented.

Current: implement/test first protected tenant and intake transaction migration, shared contracts and deterministic pricing. Preserve legacy endpoint behind explicit cutover flag. Then continue through quote/schedule/job/invoice/payment and clients.

External gates: actual sender/calendar/auth mail; owner setup checklist; hosting eligibility; private-file backup/restore; iOS signing/devices. Do not mark these passed from mocked tests. No changes to BRIX or AgencySuite.

Next commands: dependency version discovery and pinned install; migration creation via Supabase CLI; database integration tests; npm check/build; push branch and Vercel preview; update per-requirement evidence.
