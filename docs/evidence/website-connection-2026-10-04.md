# Website connection and navigation checkpoint — October 4, 2026

Latest owner authorization: finish Google/website-to-CRM connections, verify correct request intake and owner notifications, and provide phone navigation from current location.

## Verified

- Hosted Google connection reports connected; one business calendar has been created and a calendar is selected. These saved states do not prove event round-trip or current token validity.
- Hosted synthetic intake transaction: two services across categories, identical retry returns the same receipt, one durable request, two items and one owner notification. Changed payload under the same key is rejected. Anonymous direct RPC execution is denied. All fixtures rolled back; no customer email sent.
- Public handler/bridge tests retain all selections, bind the server-selected company, reject unsafe setup and keep failures from falling back to email-only success.
- Daily call sheet now makes each usable address tappable and labels its navigation button Directions from my location. The link requests driving navigation with no fixed origin. Google Maps uses device location if available; otherwise it offers a route preview/start-point entry. No Maps API key, background location tracking or CRM GPS storage is added.
- Focused intake/navigation tests: nine passed; optimized CRM build passed.

## Activation blockers

- Live company a933d657-14d3-46b6-85e6-21d973e4ed97 is still in setup and has no published configuration. No commercial, tax, invoice or scheduling settings were published on behalf of the owner.
- Gmail self-test status is not_tested; no company mail-delivery authorization exists. Inbox receipt is unverified.
- Vercel environment connector returns 403 Forbidden for both projects. Credential presence and global worker flags could not be inspected or changed.
- Public website requests have not been switched to CRM. No real request has been saved. Existing website email path remains active.
- Live website submission/dashboard visibility/backup email and repeated HTTP retry, unattended worker delivery, real phone Maps launch and Google event round-trip remain open.

## Exact next actions

1. Owner reviews and publishes business settings/catalog; verify the three cities and all six website category names match published catalog. Database intake must be explicitly enabled for the staged test.
2. Owner sends the Gmail self-test from CRM Settings, confirms actual receipt, and authorizes company email delivery. Verify sender/recipient both edhemmer@gmail.com.
3. Configure the public ynsg Production environment: CRM_ORGANIZATION_ID above, SUPABASE_URL https://jvigtwjlkmeyavzbxjzl.supabase.co, matching server-only SUPABASE_SERVICE_ROLE_KEY, independently generated CRM_INTAKE_HASH_KEY (at least 32 characters). CRM_INTAKE_ENABLED remains false until staged end-to-end acceptance.
4. Configure CRM global email sending and an authenticated recurring worker on an eligible host/trigger. Test execution with the dashboard closed. Google Calendar worker is separate and needs its own configuration/verification.
5. Exercise a clearly designated synthetic website request and unchanged retry, confirm one owner dashboard record with every item and one backup email, then enable Production intake and redeploy. Do not recreate an email-only success path after an uncertain CRM result.
6. On the owner's actual phone, open a real confirmed appointment address, allow Maps location, verify destination/start point and turn-by-turn directions. The mapping provider chooses route recommendations; the CRM does not guarantee a globally optimal route or reorder booked appointments.

The connector blockage requires approval before switching to Vercel's browser dashboard. Full production release remains incomplete; saved connection states and mocked tests do not certify it.
