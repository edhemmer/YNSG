# Validation security patch

Scope: WEB-11 / WEB-17 release dependency gate. The October 24 post-merge audit of PR 199 reported GHSA-mrhx-c7xc-m3w5 against Zod 4.6.5, after the October 23 exact-head CI had passed. All 922 application tests continued to pass; the dependency audit correctly stopped the release. Do not bypass or suppress that check.

[Advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) and [upstream fix](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd): constrained collections must reject oversized input before walking every member and allocating validation issues.

Pin the root and CRM dependencies to patched 4.6.6 and regenerate both root lockfiles. Retain existing request size limits, schema bounds, permissions, canonical commands and financial rules. Add regression coverage through the actual public request and field queue schemas: oversized invalid collections produce one collection-level issue instead of one issue per element; valid empty queue responses remain accepted.

Pass/fail release requirements: generated contracts unchanged; lint/types and application/database tests pass; production dependency audit clean; public and CRM builds pass; exact-head Linux CI including native PostgreSQL and both browser engines pass; verify the released SHA and read-only public request, sign-in and health checks. The local Windows recovery-file tests have existing POSIX permission/symlink assumptions and must be verified by Linux CI, not weakened.

No SQL migration, paid provider, model activation or new customer action is introduced. Native dependency distribution remains separately gated by its existing security register. This patch does not declare whole-product completion.
