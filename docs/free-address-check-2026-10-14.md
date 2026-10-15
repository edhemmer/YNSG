# Free advisory address matching

Customers may explicitly press Check address in the Details stage. The server uses the public U.S. Census Geocoder with Public_AR_Current. No provider subscription, paid API key, new account, autocomplete or automatic address change is introduced. Only street/city/state/optional ZIP are transmitted; no name, contact details, job, login or consent evidence is sent to Census. The privacy notice discloses the optional transfer.

Contract: POST /api/address-check accepts strict bounded street/city/state/optional postalCode. The public website restricts the existing three Illinois cities, checks same-origin and the existing durable public-read quota before contacting the fixed HTTPS provider. It returns match/multiple/no_match/unavailable, at most three suggestions and unitChecked:false. Responses are no-store. Redirects, oversized/malformed provider output and twelve-second provider timeouts fail to unavailable. Unknown provider fields and coordinates are discarded. A different returned house number is never suggested. Unit details remain unverified and are retained when present.

The UI uses text content, never provider HTML. Entries stay unchanged until a deliberate Use this street address action. Changing inputs/resetting invalidates earlier results; unknown request delivery prevents applying a previous suggestion. Checks never determine service eligibility, tax jurisdiction, customer identity, ownership or mail deliverability. A failure never prevents submitting a valid service request.

Census matches possible street address ranges and approximate coordinates. A match is not a certified postal or rooftop validation and does not prove that a house or unit exists. Official references verified October 14, 2026:
- https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
- https://www.census.gov/programs-surveys/geography/technical-documentation/complete-technical-documentation/census-geocoder.html
- https://www2.census.gov/geo/pdfs/maps-data/data/FAQ_for_Census_Bureau_Public_Geocoder.pdf
- https://help.bdc.fcc.gov/hc/en-us/articles/5341095744283-How-to-Use-the-Census-Geocoder

Synthetic provider, endpoint and DOM tests cover input/tenant-area limits, same-origin/quota rejection, output stripping, unit preservation, ambiguous/no matches, outage, deliberate correction, stale results and unknown-submit locks. A public federal-building documentation example may be used for a live provider read; customer addresses are not sent for engineering testing. Owner property editing will reuse this matcher when that editor is released; it is not advertised as implemented by this public-form change.
