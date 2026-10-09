# Day routes and marketing integration acceptance

- Implemented: month calendar, chosen-day visits, colors and numbered stops; stop selection zooms to geocoded address and opens current Google Maps directions.
- Road lines use real Routes encoded polylines with TRAFFIC_AWARE_OPTIMAL, never direct-line substitutes. Google traffic layer is separate from appointment colors. Unresolved/partial geocodes remain unplaced and are reported.
- Appointment metadata is checked every minute while visible. Actual edits trigger refreshed day data and route estimates. Metadata polls do not spend Routes quota. Travel refresh remains explicit; estimates are time-sensitive. Printed plans do not update.
- Existing quota guard applies to Routes calls. Browser map loads/geocoding need separate Google quota limits. No promise of free use or exhaustive construction, stop-sign/signal or detour data.
- Request detail says Request services:.
- Published review services can produce conditional marketing drafts, held services cannot. No global compliance flags or pricing changes.
- Save posting reminder in Google Calendar stores the edited draft in a private transparent event on the existing selected owned calendar. One deterministic event ID per tenant/attempt; same retry recovers it, different input on the same key rejects. No customer invitations/sendUpdates, no appointment time blocked.
- Direct Google Business Profile publishing is not implemented or connected. Google API approval and business.manage OAuth permission are separate from Maps keys. The interface offers the actual Google Business Profile application for manual publishing.
- Automated checks: 196 tests pass, web TypeScript and optimized build pass. New tests cover reference polyline geometry, malformed paths, private/nonblocking events, tenant ID separation, lost-response recovery and changed retries, day edit fingerprints.
- Live acceptance remains pending: no Maps keys are available to this CRM runtime, and owner session in the agent browser is awaiting its email link. No real marketing event or customer appointment created merely as a test.

## Exact Google configuration

Vercel project ynsg-repo; serving branch codex/crm-workflow uses Preview variables.
GOOGLE_ROUTES_API_KEY: server key with Routes API restriction. Do not use HTTP referrer restrictions for server calls; server credentials never appear in browser code. Dynamic hosting IP restrictions require supported fixed egress, otherwise use API restriction and quotas.
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: separate browser key, restrict APIs to Maps JavaScript API and Geocoding API; restrict website origin to https://ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app/* and separately approved custom CRM domains.
Set both on Preview and Production as requested; redeploy CRM after changes. Google Cloud billing must be enabled. Set Google quotas for map loads, geocoding and Routes; billing-budget alerts alone are not a spending cap.
Existing Google Calendar connection is used for marketing planning; no broader OAuth scopes are requested.
