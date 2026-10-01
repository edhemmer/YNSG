# Google integration: implementation and setup

## Implemented

Connect Google (owner/admin + live MFA session), authorization-code OAuth with PKCE and single-use encrypted state, browser-bound callback, verified Google identity, minimum scopes, offline refresh, AES-256-GCM tenant-bound token encryption, revision checks preventing disconnected tokens from being restored by stale callbacks/refreshes, owned-calendar picker, health checks, explicit Gmail self-test, and local-first disconnect with Google revocation attempt.

Calendar adapter: paginated owned calendar list; fail-closed free/busy; deterministic event IDs; tentative vs confirmed projections; conditional ETag writes; mapped missing/externally changed events marked for review instead of altering CRM appointments; manual bounded queue worker and reconciliation. Expired leases retry the same event ID. No customer invites or Google notifications are sent by calendar writes.

Gmail adapter: MIME encoding, header validation, send-only scope, no automatic send retry after an ambiguous response. Self-test is persisted before sending and retry-safe. Outbox dispatcher code supports owner notifications, confirmations and decline notices but is disabled. Existing public api/requests.js remains untouched. No Resend/Apps Script cutover occurred.

## Missing configuration (not missing code)

Google OAuth client ID and secret; Supabase server key. These belong directly in Vercel, never chat or Git. Live Google consent, calendar access, token refresh/revocation and test-message receipt cannot be verified until configured. CRM owner membership/MFA and auth-email delivery also need real setup; the database currently has no live organizations.

Configured on the isolated Vercel project ynsg-repo, Preview branch codex/crm-workflow: APP_ORIGIN (stable branch alias), SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, GOOGLE_TOKEN_ENCRYPTION_KEY (generated securely and submitted directly). No secret values in this document.

## Unfinished broader workflows (not disguised as credential blockers)

Customer scoped Confirm/Reschedule links and their reminder template, recurring bookings, owner review/apply UI for external-calendar proposals, and end-to-end operating release tests are still required. Manual calendar sync and the authenticated background worker endpoint are implemented; no scheduler is activated. The Gmail dispatcher is not enabled: customer reminder intents intentionally are not delivered without the required action-link workflow. Changing a selected calendar with mapped visits is blocked pending a reviewed migration flow. The existing website email must remain active until live delivery and the single-path intake cutover are verified. Google connection success alone does not make scheduling production-ready.

## Google Cloud setup

1. Select/create one project for YNSG. Enable **Gmail API** (`gmail.googleapis.com`) and **Google Calendar API** (`calendar-json.googleapis.com`). No Maps, Drive or Sheets API is needed for this implementation. Do not enable paid quota increases.
2. Google Auth Platform → Branding: app name **Your Neighborhood Service Guy CRM**; support/developer contact your Google account. Public home https://www.yourneighborhoodserviceguy.com/ and privacy https://www.yourneighborhoodserviceguy.com/privacy. Use your owned public domain for branding. This connection is for the operator; website customers do not authorize Google.
3. Audience: **External**, because the owner uses a personal Google account. Start in **Testing**, with **edhemmer@gmail.com** listed as a test user. Testing grants/refresh tokens expire after seven days for these scopes; this is suitable for verification, not unattended long-term use. Review Production publishing/verification after the tests. No Google Workspace subscription or service account is required.
4. Data access: add exactly the six scopes below.
5. Clients → Create client → **Web application**. Name **YNSG CRM preview**. **Authorized JavaScript origins: leave empty** (server-side OAuth). **Authorized redirect URI**, derived from deployed APP_ORIGIN and the implemented route:

```text
https://ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app/api/google/callback
```

No trailing slash. Do not substitute the public website, localhost, Supabase auth callback, or an individual changing deployment URL. Open the stable CRM alias in the same browser and complete Vercel preview access first. The deployed /google-setup page computes the same URI. If the CRM origin changes, update APP_ORIGIN and this Google redirect together.

| Scope | Purpose |
|---|---|
| `openid` | Verified Google subject/identity |
| `https://www.googleapis.com/auth/userinfo.email` | Verified sender account address |
| `https://www.googleapis.com/auth/gmail.send` | Send email; no inbox reading |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | Select from owned calendars |
| `https://www.googleapis.com/auth/calendar.events.owned` | Read/create/update/remove projections on owned calendars |
| `https://www.googleapis.com/auth/calendar.freebusy` | Check availability without reading unrelated event details |

## Exact environment variables

Vercel project **ynsg-repo**, **Preview**, Git branch **codex/crm-workflow**. Redeploy after changing values. None use NEXT_PUBLIC_.

| Name | Value/source | Status |
|---|---|---|
| `APP_ORIGIN` | `https://ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app` | Configured |
| `SUPABASE_URL` | `https://jvigtwjlkmeyavzbxjzl.supabase.co` | Configured |
| `SUPABASE_PUBLISHABLE_KEY` | YNSG Supabase publishable API key | Configured |
| `SUPABASE_SERVICE_ROLE_KEY` | YNSG server-side service-role JWT key; enter directly from Supabase project API keys into Vercel Sensitive value | Missing |
| `GOOGLE_CLIENT_ID` | Web application OAuth client ID from Google Cloud | Missing |
| `GOOGLE_CLIENT_SECRET` | Secret from that same OAuth client; Vercel Sensitive value | Missing |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Random 32-byte base64 secret | Securely generated and configured; do not rotate without a token re-encryption/reconnect plan |
| `GOOGLE_GMAIL_DELIVERY_ENABLED` | Keep absent or `false` during setup | Disabled; not a substitute for release/cutover approval |

No GOOGLE_REDIRECT_URI, Gmail password, manually copied refresh token, or GOOGLE_APPLICATION_CREDENTIALS variable is used.

Optional background Calendar worker: POST `/api/google/worker` with `Authorization: Bearer <GOOGLE_WORKER_SECRET>`. Requires `GOOGLE_CALENDAR_WORKER_ENABLED=true`, `GOOGLE_WORKER_ORGANIZATION_ID` (the exact live YNSG organization UUID), and a random `GOOGLE_WORKER_SECRET` of at least 32 characters. No secrets in query strings. These are currently unset/disabled. An external scheduler must be configured within the free-platform constraint; no paid schedule or hosting upgrade was enabled. GET returns 405 and never runs work. Until a schedule is configured, use Sync calendar now. This endpoint does not send customer email.

## Verification and evidence

Synthetic tests cover tenant-bound encryption/tampering, HTTPS callback construction, paginated calendar ownership, partial free/busy errors, header injection, ambiguous send without retry, deterministic event IDs, external edits, missing events, owner vs other-tenant access, private-store denial, OAuth replay, self-test replay and disconnect fencing. Hosted rollback SQL passed and Supabase security advisor returned no lints. Passing mocked adapters does not prove Google consent or email delivery. A self-test result accepted means Google accepted the message; the owner must confirm receipt separately.

## Official references

- OAuth server flow: https://developers.google.com/identity/protocols/oauth2/web-server
- Calendar scopes: https://developers.google.com/workspace/calendar/api/auth
- Free/busy scopes: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- Gmail scopes: https://developers.google.com/workspace/gmail/api/auth/scopes
- Testing audience/expiry: https://support.google.com/cloud/answer/15549945
- Personal-use verification exceptions: https://support.google.com/cloud/answer/13464323
- API quotas: https://developers.google.com/workspace/gmail/api/reference/quota and https://developers.google.com/workspace/calendar/api/guides/quota

Standard API usage is subject to free quotas and account sending limits. No billing upgrade or paid quota was enabled. Existing Vercel hosting eligibility remains a separate open issue in cost-dependencies.md.
