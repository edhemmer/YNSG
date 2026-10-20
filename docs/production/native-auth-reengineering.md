# Native browser authentication — incident 153

Scope baseline: production `0c7115e01bf75b80f6f11a9fa2f9eefeb6ab7bec`. This supersedes the incident handoff approach; it does not declare product completion.

## Pass/fail checklist

- [x] Dedicated sign-in, recovery and password-change screens; no customer-history/deletion dependency in password entry.
- [x] Browser-native POST forms and uncontrolled credential fields: typing, autofill and submit work without a React event/JSON fetch path. Visibility is optional enhancement; credentials are never echoed into HTML, URLs, logs or browser storage.
- [x] One shared server authentication handler for native forms and existing JSON clients, preserving provider validation, origin checks and HttpOnly cookie/session renewal.
- [x] Keep customer records, identity and permissions unchanged. No anonymous owner access, hardcoded password, required MFA, unsupported Google option, new paid provider or admin-key exposure.
- [x] Explicit recovery only; truthful rate-limit/unavailable/expired states. Failed recovery retains the previous verifier. Password updates renew expired access, validate the same identity and save the resulting session.
- [x] Preserve fixed return destinations and valid request context. Legacy password-change URLs and recovery callbacks reach the dedicated screen.
- [x] Synthetic tests cover the native browser form → shared handler → provider → secure-cookie redirect → owner workflow, failure/denial, recovery, password update, expiry and replay boundaries. No real business command or customer email for QA.
- [ ] Full release checks, optimized builds and both exact-head CI jobs pass before the existing production branch receives the tested merge.
- [ ] Verify production domains and saved owner access after deployment. Actual iPhone/Safari keyboard and private credential entry remain owner acceptance; do not treat remote browser typing as device proof.

## Contract

`POST /auth/access` accepts a bounded URL-encoded form with `action=password|recover|set-password|refresh`, corresponding credential fields, required confirmation and same-account identity for password changes and an allowlisted UUID request/company context. Cross-origin, malformed, duplicate, unknown and oversized input is rejected before provider calls. It invokes the same server handler as `/api/session`, then issues a 303 to a fixed application page. Provider credentials stay in the POST body; session material stays in HttpOnly response cookies. Failed native submissions redirect with reviewed error codes only.

`GET /sign-in` owns password/recovery entry. `GET /auth/password` owns authenticated password entry and confirmation. The customer account page remains for customer records, with old password-change links redirected to the dedicated screen. Session checks in the password screen use identity/session state and do not load customer records or privacy actions.

## Acceptance status

Local engineering verification passed: 820 application tests, contract/completion checks, PGlite database assertions, dependency audit, public build and optimized CRM build. The production-runtime HTTP test passed native sign-in, PKCE recovery, password save, secure-cookie redirect, same-account denial and fresh owner sign-in against an isolated synthetic provider. No real email delivery or business mutation was used. The runtime test is required in release CI.

Exact-head CI, deployment and live checks remain pending. Incident 153 remains open pending actual owner iPhone/Safari credential entry and saved-session acceptance. No database migration or permission change is included.
