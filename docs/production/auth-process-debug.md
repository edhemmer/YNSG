# Authentication process debug — incident 153

Baseline: production `4d2105a85d2288efb3defbf2cb2380d698d79a2d`. Owner reported a raw request-denied response after native form submission. Previous HTTP tests explicitly supplied Origin and did not execute document referrer policy.

## Pass/fail scope before edits

- [ ] Reproduce actual browser form Origin behavior with the old page policy and prove the corrected policy, including WebKit/mobile emulation and JavaScript disabled.
- [ ] Trace entry, credentials, denial, recovery request/rate limit, PKCE callback, password save, fresh sign-in, renewal and owner permissions end to end with synthetic data.
- [ ] Preserve exact origin checks; reject foreign, null and missing origins before provider work. Browser rejection must show a usable HTML page without echoing credentials.
- [ ] Dedicated native forms keep credentials out of React state, URLs, logs and browser storage; no cloud keyboard handoff, anonymous owner bypass, new required MFA, Google activation or paid provider.
- [ ] Failed recovery/callback preserves useful state on provider outage, routes clearly to recovery and never reports success without provider acceptance.
- [ ] Password save validates current same-account identity; interrupted/unknown results never trigger automatic password mutation replay.
- [ ] Preserve customer data, identity, permissions, business rules and working owner session. No real customer messages or business mutation for QA.
- [ ] Full release checks and builds plus both exact-head CI jobs pass before merging to the existing production branch. Verify merge tree, both deployments, live routes and read-only owner access afterward.
- [ ] Leave actual physical iPhone keyboard, private credential entry and persistence unclaimed until observed; keep incident 153 open.

## Investigation

The dedicated entry/password pages emit `meta name="referrer" content="no-referrer"`. Fetch's append-Origin algorithm uses an opaque/null origin for ordinary native POST navigation under that policy. The exact-origin guard correctly rejects it. The previous tests created POST requests with a supplied Origin, masking the page-policy defect. Source: https://fetch.spec.whatwg.org/#append-a-request-origin-header .

Real Chromium also reproduced a second failure: opening the reset link from a different site left Strict cookies unavailable on the immediately redirected password page. The callback now redirects to a clean, fixed-destination continuation document before navigating to the authenticated page. JavaScript automatically continues; without JavaScript a normal Continue link does so. Session cookies remain Strict, HttpOnly and Secure. The continuation contains no provider code/token, permits no arbitrary destination and grants no authority.

Corrected both form pages to `same-origin` referrer policy; cross-site referrer disclosure remains disabled. Exact Origin checks are unchanged. Denied native navigation now returns HTML with fixed sign-in/recovery links, never raw provider/credential data. Callback errors preserve the verifier and route to the dedicated entry/recovery screen. Interrupted or otherwise unconfirmed password updates report uncertainty without an automatic retry.

Added synthetic browser-engine coverage for Chromium and WebKit, mobile viewport, JavaScript on/off, actual generated Origin headers, secure-cookie redirect, cross-site email callback, rate-limited recovery/callback, same-account password save, reload without mutation replay, fresh sign-in, access expiry/renewal and membership revocation. The production HTTP harness runs the real app/SDK behind isolated loopback TLS. Browser downloads are blocked in this workstation environment; both engines are mandatory CI checks, not recorded as locally passed.

Focused callback/native handler tests passed. Full release/build/runtime and exact-head CI results must be recorded on the release PR. Physical owner iPhone/Safari keyboard, private credential entry and persistence remain unverified. No customer message, database migration or permission change is included.
