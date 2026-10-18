# Source-backed outdoor weather review

Scope: WEB-03/09, issue #36. Read-only guidance for reserved outdoor visits. This does not authorize work, move an appointment, cancel service or send a customer message. No practice features, new paid provider, model budget or required integration account are introduced.

## Connected owner path

Calendar → choose a day → an outdoor visit → Outdoor weather review. No external request occurs merely by opening the sheet. Check visit location explicitly uses the existing Census address service with only the saved street/city/state/ZIP. The owner sees the original address, the Census street-range match and a map link. This is not a verified building/unit. After the owner reviews the match, the forecast action rechecks the canonical visit and Census location before requesting NWS data. NWS receives coordinates, not customer contacts or the full street address.

The response includes complete hourly coverage for the remaining visit window and currently active alerts overlapping it, with forecast issue/check/expiry times and official source links. Missing precipitation remains unknown. Unsupported units/shape, stale/future issue time, incomplete coverage, alert pagination, invalid provider targets and provider failures withhold advice. A manual official-weather link remains available. A human-readable NWS forecast is primary; raw source references are optional details.

A review link opens the existing service order. Any actual schedule change still goes through its canonical revision, capacity/travel, customer evidence and notification controls. No provider text becomes a command or an approval. No source-based automatic cancellation or favorable-site/safe-work claim exists.

## Authority and freshness

- Existing google_access is a live owner/admin authorization helper independent of Google activation; canonical appointment/request reads remain tenant-RLS scoped. Both location and forecast operations reread current membership and appointment revision after remote calls. Changed status, timing, address or revision discards the result.
- The location fingerprint binds company, appointment, revision, owner, canonical address/window and provider match. It is a consistency digest, not an authentication credential. Clients cannot supply arbitrary coordinates or provider URLs. Each forecast independently resolves the saved address and compares the reviewed match.
- Only the fixed Census endpoint and allowlisted HTTPS api.weather.gov point/hourly/alerts endpoints are fetched. Redirects are refused. Response size, period/alert counts and timeouts are bounded. Missing/partial alerts fail the entire review; no silent partial success.
- Visits must be reserved, include a recognized outdoor service/task, end in the future, fit within 24 hours and start within six days. Forecast issue age is capped at six hours with bounded clock skew. Advice expires at the earliest of 15 minutes after its check, the visit end or the source-age bound. Expired advice hides its decision content and offers refresh. Focus/visibility changes recheck the client clock; no automatic provider polling.
- UI calls are single-flight and abort on unmount. Company/appointment/version identity remounts the review; late results cannot populate another visit. A failed provider check changes no saved business data and needs a fresh read, not a business-command replay.

## Sources and validation

Official references reviewed 18 October 2026:
- NWS API contract, free access, identifying User-Agent, point-to-hourly mapping, active-alert endpoint and feature formats: https://www.weather.gov/documentation/services-web-api
- Census address/coordinate response and current benchmark: https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html

The shared public address-check response still excludes coordinates. A separate server weather resolver validates/returns a bounded map point for this guarded review only. No customer/provider QA request is made against production to manufacture evidence.

Scenario coverage: no provider call before live permission or explicit UI request; owner location review; strict reviewed fingerprint; canonical changes during geocoding/forecast; no arbitrary coordinates/URLs; complete hourly coverage; source freshness; unknown precipitation; overlapping alert severity; partial alert refusal; outage/manual recovery; synchronous duplicate prevention; stale/late-visit rejection. Full release checks, generated contracts/types, native PostgreSQL CI and optimized CRM build remain required before merge, followed by production SHA/alias and read-only health checks.

Remaining acceptance: actual authorized owner/provider/device review, October 19 route reconciliation and controlled Google/reminder recovery under #36. Weather facts are not a substitute for actual site assessment, approved equipment instructions or the owner's scheduling decision. Whole-gate/product acceptance is not asserted.
