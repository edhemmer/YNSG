# Mobile routes and money repair

Baseline: live CRM c1d0c5501d9eee08e040f7596d53cdcafb42cbc0 on codex/crm-workflow, verified with Vercel deployment metadata. Screenshots supplied by Ed show the route month wrapping vertically, Maps initialization failure, a date input extending beyond the trip form and crowded expense pagination.

## Acceptance checklist

- [x] Preserve current production payment-history changes, pricing, services, brand and canonical commands.
- [x] Bound month arrows to 44px; reserve remaining width for month/year; keep seven calendar columns and stacked visit counts.
- [x] Remove intrinsic fieldset width and constrain trip/date fields, including WebKit date presentation.
- [x] Give expense pagination fixed grid tracks and clear 44px controls.
- [x] Handle Google's documented gm_authFailure callback even after script readiness; hide failed map and keep stop details/directions accessible.
- [x] Bound geocoder requests and overall map preparation; prevent late results from overwriting the failure state; remove subscribers/timers on unmount.
- [x] Correct cross-origin referrer policy so website-restricted Maps keys can receive the site origin without private paths/query strings.
- [ ] Confirm actual Google API error and key restrictions, enabled APIs and billing in the connected account. Vercel environment listing denied 403; no configuration change made.
- [ ] Physical iPhone/Safari visual and actual authenticated Maps acceptance after deployment. Local browser installation failed because the browser archive download was invalid; no visual pass claimed.
- [ ] Publish PR, exact-head CI including native PostgreSQL, merge and verify deployed SHA. Automatic approval review rejected GitHub push; publication awaits explicit owner authorization.

Google references: https://developers.google.com/maps/documentation/javascript/events#auth-errors and https://developers.google.com/maps/api-security-best-practices . Existing same-origin referrer policy is a concrete compatibility defect for website-restricted keys, but the screenshot alone does not establish Google's actual error code.

No migration, provider activation, production record mutation, customer message or financial transition is included. WEB-03/08/10/17 remain open to their full acceptance requirements. The code repair is not a whole-product completion claim.

## Local verification

`npm run verify:release` passed after the final code changes: completion register, syntax, generated API contracts, root/web typechecks, 700 application tests, PGlite database assertions and production dependency audit (no known vulnerabilities). Optimized Next.js production build passed. `git diff --check` passed. Native PostgreSQL CI, physical-browser visual checks and live deployment remain unverified; they are not replaced by these local results.
