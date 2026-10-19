# City and ZIP address entry

Owner direction: select city, then select a ZIP associated with that city. Applied to new public requests, owner property editing and returning-customer requests using saved addresses.

## Acceptance checklist

- Public City → ZIP controls require deliberate ZIP selection; city changes clear incompatible selections.
- Standard choices for advertised service cities: DeKalb 60115, Sycamore 60178, Cortland 60112. No paid lookup and no additional customer data sent to a new provider.
- Submitted ZIP survives draft/unknown-result recovery, API validation, immutable request JSON, existing route formatter, owner email, inbox and workflow directions.
- Census address checking includes the ZIP and clears stale suggestions after a ZIP change.
- Owner editing preserves other cities/states and existing unusual ZIP evidence rather than silently replacing it. Other locations permit manual ZIP entry; this is not a national postal directory.
- Returning requests show the saved ZIP or require a selection for supported cities. Canonical SQL uses the saved property ZIP when present; a customer cannot replace it through the request form. A ZIP supplied for an older property with no ZIP belongs to the new request snapshot and does not edit that property.
- Historical submissions and frozen legacy requests remain unchanged. ZIP is optional at the canonical legacy boundary, but required by new applicable forms. Explicitly supplied malformed ZIP fails validation. Public API checks supplied city/ZIP combinations.
- Migration applied to connected YNSG Supabase as `20261019020939_city_postal_code_intake`; ZIP whitelist, validation, locked search paths, grants and legacy context shape verified read-only.

## Source and coverage

The city government sites publish these address combinations: https://www.cityofdekalb.com/ (DeKalb IL 60115), https://www.cityofsycamore.com/ (Sycamore IL 60178), https://www.cortlandil.org/ (Cortland IL 60112). Checked October 19 UTC / October 18 Eastern, 2026. These are standard local service-address choices, not an exhaustive USPS address certification or promise that postal boundaries equal municipal boundaries. The existing explicit street-match check remains advisory; ZIP selection alone does not prove a house or unit is correct.

## Release dependency

Apply `20261019015607_city_postal_code_intake.sql` and verify its function definitions before publishing the new clients. It extends existing function JSON whitelists while keeping the existing returning-customer RPC response unchanged, preserves canonical permissions and audit, and does not rewrite saved rows. Deploying only the form would cause the old strict SQL whitelist to reject ZIP-bearing submissions. Native PostgreSQL CI, exact-head review, approved publication and a live read-only check remain required.

## Verification

Local Chromium walkthrough completed at 320, 393, 768 and 1366 CSS pixels: Services → arrange time → Details → select city/ZIP → change city (old ZIP clears) → select new ZIP → reload (draft city/ZIP retained). All four pages remained within their viewport; the 393px address controls were visually inspected. [Browser measurements](../evidence/city-postal-browser-2026-10-19.json).

Behavioral tests cover city-filtered ZIP choices, required selection, old-ZIP clearing, owner other-state/manual entry, tab recovery, malformed/mismatched supplied ZIP, explicit postal route formatting, saved-property ZIP in request snapshots and API context, and immutable request persistence/exact replay/conflict. Canonical database tests run against synthetic PGlite; native PostgreSQL CI and live migration/provider acceptance remain separate.

The final local release command passed: 709 application tests, both typechecks, generated API contracts, completion register, synthetic database assertions and dependency audit (no known vulnerabilities). Supabase migration application and read-only function checks passed. Public and optimized CRM production builds passed. Native PostgreSQL CI and both live deployment checks are recorded in the release PR.
