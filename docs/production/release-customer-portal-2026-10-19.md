# Customer account and build selection release

Engineering candidate: `2ca5bba0b0a5b20635e942b497bf4302e7b8e41f`, merged PR #131. Exact accepted head: `bbff1bc22d1f70d3643e41fc5ea3b6ad3ad3a0e0`. GitHub comparison reports no changed files between accepted head and merge. Exact-head CI run 39191925758 passed both jobs, including 726 application tests, production builds, native PostgreSQL lifecycle/race/recovery, and native foundation type/lint/SDK/bundle checks. The separate native dependency audit remains blocked; this is not native distribution acceptance.

## Scope reviewed

- Customer history/balance requires validated complete data, exact receipt/metadata counts, correct business/page, no duplicate/foreign receipts and a final current-access recheck. Household appointment filters apply even if the user also has staff access. Invalid reads show retry rather than an invented empty account or balance.
- Vercel selection uses the full change set since the last successful project/branch deployment. Unknown/runtime/configuration/migration changes, referenced operator modules, unavailable history and same-commit redeploys still build. CI is unchanged.
- No migration, production record mutation, message, financial action, paid activation, pricing/service change or credential disclosure is included.

## Required remaining external actions

### Embedded Maps website authorization

Observed Google error remains `RefererNotAllowedMapError` naming `https://yourneighborhoodserviceguy.app/owner`; the directions fallback is usable. The connected capabilities found do not administer Google Cloud API-key restrictions.

The Google Cloud project owner should locate the browser key configured as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for Vercel project `ynsg-repo`, then review **APIs & Services → Credentials → that browser key → Website restrictions**. Authorize the production `.app` and `www.app` hosts using these narrow website patterns, including the HTTPS scheme:

- `https://yourneighborhoodserviceguy.app/*`
- `https://www.yourneighborhoodserviceguy.app/*`

Keep website restrictions and the key's required API restrictions enabled; do not use an unrestricted key or a wildcard for all Vercel sites. Keep the server Routes key separate. Review Maps JavaScript/Geocoding authorization if a subsequent error names those APIs; do not enable a new paid service or change billing as part of a blind retry. After saving the authorized website entries and allowing propagation, reload Owner → Day routes and select an existing route. Acceptance requires a visible map and no authorization error, without changing appointments or messaging customers. Do not paste keys into chat or Git.

Google's source explains that browsers strip cross-origin referrers down to the origin, so path-specific `/owner` restrictions can fail: https://developers.google.com/maps/api-security-best-practices .

### Backup operation

PR #130's consistent source capture and encrypted isolated restore passed native PostgreSQL CI. An operator still needs to choose the off-provider destination, custodian, retention, separately held key, approved recovery targets, schedule and alert recipient before actual production extraction/restore. No production export or credential retrieval has been performed as QA.

### Acceptance and unfinished engineering

Physical Safari/VoiceOver and actual recipient/work/funds acceptance remain open. Independent human security review and actual company/tax/hosting decisions are not machine-test results. Invoice credits and retention/deletion remain engineering work under #35/#33; QuickBooks stays unconnected pending sandbox mapping. No whole-product completion or invented percentage is claimed.

## Production verification

Observed 2026-10-19T03:01:15.072752+00:00. Both Vercel projects are READY at the candidate above. Public deployment `dpl_CzPMHqn2JSG47NhtiZqWw7imvzoj`; CRM deployment `dpl_2iK8ybphjzx1BuG5o2ATWphvjPLa`. The .com/www.com and .app/www.app aliases point to their corresponding deployments. The read-only production checker passed public request markup, owner entry and fresh worker/mail health. Both installation builds ran normally; non-runtime positive skip verification follows this evidence-only change. No migration was required.

Account session smoke is limited to the existing signed-in account with no connected service records; real customer financial records were not fetched or manufactured. Synthetic contract/UI/SQL checks supply the malformed-history and permission evidence.

## Review checklist

- PASS: exact-head CI, accepted-head/merge tree equality, both deployed SHAs, four aliases and read-only health.
- PASS: optional accounts and existing business rules retained; no production records/messages/funds created.
- OPEN: actual linked-customer/device/provider acceptance and remaining gates listed above. No overall completion claim.
