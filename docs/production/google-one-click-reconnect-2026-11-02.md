# One-click Google reconnect

The owner requested one reconnect action covering the business’s Google services. The workspace notice and Google settings now share a direct Reconnect Google action. It starts the existing Calendar/Gmail OAuth flow without requiring a separate disconnect or settings navigation. Google may still require sign-in or consent; the CRM cannot suppress Google’s security decisions.

## Retained settings and authority

The encrypted OAuth state binds company, initiating live owner/admin session, exact connection revision, prior subject and calendar. The callback checks current identity/access, full existing scopes, verified Google identity and ownership of the saved calendar before a server-only atomic reconnect. The existing connection survives cancellation, wrong-account consent, inaccessible calendar and stale revision. No new Google service scopes are added. Offline access and incremental grants are requested; existing automatic token refresh remains in place. Google can expire or revoke authorization, including provider testing-mode limits ([official OAuth guidance](https://developers.google.com/identity/protocols/oauth2/web-server)).

The atomic command retains the existing selected calendar and historical mail-test/receipt approval for the same verified sender. It never enables a previously paused owner mail control, changes worker environment flags, sends a test, flushes messages, creates a calendar/event, approves a different sender or changes the independent business-email provider. First-time calendar selection and unapproved mail setup still require the existing explicit choices. Calendar and Gmail use this OAuth connection. Maps/routes use their existing separate configuration; reconnect does not invent access to unimplemented services.

Returning from Google opens Settings with Google setup expanded, showing Calendar/Gmail authorization and enabled/paused delivery separately. Navigation validates Google’s consent host, PKCE code flow and the CRM callback. Unsaved or unconfirmed financial work retains its existing leave guard. Lost startup responses retain the prior connection; no automatic disconnect is attempted. Provider errors/codes/tokens are not displayed or logged.

## Validation

Local types/lint and empty-schema PGlite tests pass. Synthetic SQL covers same-account reconnect, retained selected calendar and receipt evidence, recovery after credential removal, explicit mail pause, wrong account, unknown calendar ownership, incomplete scopes, other-tenant actor, stale attempts and no generated mail/calendar. A native race checks reconnect versus background token refresh. Real-component Chromium scenarios exercise notice/settings buttons, unsaved-entry cancellation, one connect request, direct mocked Google consent, no disconnect/send/calendar-create actions, selected-calendar retention and light/dark phone/desktop readability: 48 checks, zero findings. These do not claim an actual owner Google consent or real provider-delivery test.

The new migration remains pending until native CI passes, followed by applied-name/history verification, final exact-head CI, tested-head merge, both deployments and live read-only smoke. Existing independent human security, actual provider/device, business/tax and native distribution gates remain separate. No paid service is activated.
