> Historical snapshot: these October 1 presence and implementation findings are superseded by [the current production audit](full-production-audit.md). Do not use the missing-credential or missing-callback statements below as current setup instructions.

# YNSG integration setup audit — October 1, 2026

Audited branch: codex/crm-workflow. Presence checks never reveal values. The active CRM is Vercel project ynsg-repo, Preview branch codex/crm-workflow. The public website is the separate ynsg Production project.

Key finding: SUPABASE_SERVICE_ROLE_KEY exists in CRM Production only, but is missing from the active Preview. Google client credentials are absent. The database has no live organization, owner membership, Google tokens, selected calendar, active Gmail dispatch or active AI connection. Supabase Auth SMTP settings were not accessible to this audit and are unverified, not confirmed missing.

Setup destinations:
- CRM Preview variables: https://vercel.com/edhemmer-5018s-projects/ynsg-repo/settings/environment-variables (select Preview and codex/crm-workflow).
- Public website Production variables: https://vercel.com/edhemmer-5018s-projects/ynsg/settings/environment-variables.
- Supabase project: https://supabase.com/dashboard/project/jvigtwjlkmeyavzbxjzl.
- CRM: https://ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app.

| Exact variable or explicitly non-environment setting | Purpose / requirement / integration | Presence | Obtain value / direct setup link | Destination | Exposure |
|---|---|---|---|---|---|
| APP_ORIGIN | Required: auth origin checks and Google callback base | Preview present; Production absent | Stable CRM origin above; deployed /google-setup computes callback | CRM Preview; separately configure before any Production release | Public URL |
| SUPABASE_URL | Required: CRM database/auth | Preview present; Production absent | https://supabase.com/dashboard/project/jvigtwjlkmeyavzbxjzl — project connection settings | CRM Preview/ eventual Production | Browser-safe URL |
| SUPABASE_PUBLISHABLE_KEY | Required: Supabase authenticated client | Preview present; Production absent | Same Supabase project's API keys | CRM Preview/ eventual Production | Browser-safe with RLS |
| SUPABASE_SERVICE_ROLE_KEY | Required: private encrypted Google store bridge | Production only; missing Preview | Same project's legacy service_role JWT API key, as required by current bridge | Add directly to CRM Preview, branch codex/crm-workflow | Server secret; never browser |
| GOOGLE_CLIENT_ID | Required: Gmail/Calendar OAuth web client | Absent | https://console.cloud.google.com/auth/clients | CRM Preview | Public identifier |
| GOOGLE_CLIENT_SECRET | Required: OAuth code exchange/refresh | Absent | Same Google web client's secret | CRM Preview | Server secret |
| GOOGLE_TOKEN_ENCRYPTION_KEY | Required: AES-256-GCM private token storage | Preview present | Already generated securely: 32 random bytes, base64. Not a Google-issued key; do not rotate casually | CRM Preview | Server secret |
| GOOGLE_GMAIL_DELIVERY_ENABLED | Optional flag; true permits dispatch only after other readiness guards | Absent / disabled | Operator release choice, not issued credential | CRM Preview; leave disabled | Nonsecret flag |
| GOOGLE_CALENDAR_WORKER_ENABLED | Optional background calendar projection; exact true enables | Absent / disabled | Operator scheduling choice | CRM Preview when ready | Nonsecret flag |
| GOOGLE_WORKER_SECRET | Required only for background worker; random 32+ characters | Absent | Generate securely; scheduler sends Authorization: Bearer | CRM Preview and scheduler secret store | Server secret |
| GOOGLE_WORKER_ORGANIZATION_ID | Required only for worker; existing live tenant UUID | Absent; no live organization | CRM organization after protected bootstrap; never invent UUID | CRM Preview | Tenant metadata, not authentication |
| RESEND_API_KEY | Required for current public request email | Website Production present | https://resend.com/api-keys | Public ynsg Production | Server secret |
| RESEND_API_Key | Optional legacy alternate casing supported by website | Absent | Same Resend key; do not duplicate when primary exists | Public ynsg Production only if using fallback | Server secret |
| REQUEST_FROM_EMAIL | Not read by current handler; does not configure sender | Website Production present but unused | No operative value in current implementation | Existing website setting; no new setup needed | Email address, not credential |
| No env: custom SMTP host, port, username, password, sender address/name | Required for general external Supabase OTP delivery | Unverified | https://supabase.com/dashboard/project/jvigtwjlkmeyavzbxjzl/auth/smtp ; Resend option: https://resend.com/docs/send-with-smtp and https://resend.com/domains | Supabase Auth SMTP settings, not Vercel | SMTP password/API key secret |
| No env: email provider, OTP email template and Site URL | Required: customer/owner email-code sign-in; template must contain {{ .Token }} | Unverified | https://supabase.com/docs/guides/auth/auth-email-templates and https://supabase.com/docs/guides/auth/redirect-urls | Supabase Auth settings | Nonsecret configuration |
| No env: owner organization, membership and MFA | Required before protected Google controls can be used | Absent | Protected owner bootstrap/setup workflow; this workflow still needs completion | CRM / Supabase protected provisioning | Private account data; MFA secrets never public |
| No env: Google tokens and selected calendar | Required for live Gmail/Calendar use | Absent | CRM Connect Google, then select an owned calendar | Tokens encrypted in private.google_accounts; calendar chosen in CRM | Tokens secret; not global env variables |
| No env: settings.sender and settings.notificationRecipient | Required for Gmail dispatch; sender must equal connected account | No live organization/settings | CRM versioned settings; publishing/setup workflow still incomplete | CRM configuration | Email addresses, not credentials |
| No env: Gmail active status and secret_ref readiness guard | Required dispatcher guard; activation command not implemented | Inactive | Requires reviewed implementation, not manual SQL activation | CRM integration lifecycle | Server-controlled state |
| No env: Drive, Sheets, Maps | No adapters/API-key variables implemented; keys cannot unlock them | Not implemented | No setup requested yet | Future implementation | N/A |
| No env: AI provider | No provider client or API-key variable implemented; SQL ai enum is only a placeholder | No configured active provider | No key required yet | Future implementation | N/A |

## Exact Google OAuth setup

Enable Gmail API https://console.cloud.google.com/apis/library/gmail.googleapis.com and Google Calendar API https://console.cloud.google.com/apis/library/calendar-json.googleapis.com. No Drive, Sheets or Maps API is used.

Create a Web application OAuth client at https://console.cloud.google.com/auth/clients. Authorized JavaScript origins can remain empty: this is server-side OAuth.

The only verified deployed/configured callback is:
https://ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app/api/google/callback

This is shared by Gmail and Calendar. No trailing slash. There is no established CRM Production APP_ORIGIN/callback to register yet; do not substitute the public website, localhost, Supabase callback or a changing deployment URL.

Exact minimum scopes requested by current code:
- openid
- https://www.googleapis.com/auth/userinfo.email
- https://www.googleapis.com/auth/gmail.send
- https://www.googleapis.com/auth/calendar.calendarlist.readonly
- https://www.googleapis.com/auth/calendar.events.owned
- https://www.googleapis.com/auth/calendar.freebusy

Branding: https://console.cloud.google.com/auth/branding — Your Neighborhood Service Guy CRM, owner support/developer contact, public website https://www.yourneighborhoodserviceguy.com/, privacy https://www.yourneighborhoodserviceguy.com/privacy, owned domain yourneighborhoodserviceguy.com.
Audience: https://console.cloud.google.com/auth/audience — External for a personal Google account; Testing initially; add the connecting owner's Google email as a test user.
Data access: https://console.cloud.google.com/auth/scopes — six scopes above.
Testing grants/refresh tokens expire after seven days with these scopes. Review publishing/verification requirements before unattended operation: https://support.google.com/cloud/answer/15549945.

This integration is operator authorization, NOT customer Google sign-in. Customers use Supabase email OTP. No customer signInWithOAuth route or Google login provider is implemented. The OTP template must expose the typed code; the app does not implement a magic-link callback.

Connect Google requires authenticated owner/admin with live MFA. It exchanges a single-use PKCE authorization code, validates Google identity and stores access/refresh tokens encrypted in private.google_accounts. Calendar selection, health checks and disconnect run through protected CRM controls. There is no GOOGLE_REFRESH_TOKEN, GOOGLE_REDIRECT_URI, GOOGLE_CALENDAR_ID or GOOGLE_APPLICATION_CREDENTIALS variable.

## Supported configuration versus unfinished implementation

Implemented: protected Connect Google, offline refresh, owned-calendar selection, health, disconnect, self-addressed Gmail test, calendar free/busy and guarded event projections, manual sync and POST /api/google/worker. No external scheduler is configured. A protected Vercel Preview also requires legitimate scheduler access through deployment protection; the application worker bearer secret alone does not bypass that protection.

Unfinished: protected owner/bootstrap and configuration publication flow; Gmail activation command; automated Gmail worker; customer confirmation/rescheduling capabilities and reminder template; recurring booking and external-change review/apply workflows; Drive/Sheets/Maps/AI adapters. Setting GOOGLE_GMAIL_DELIVERY_ENABLED alone cannot activate Gmail: the database requires active integration status and secret_ref, which connection setup deliberately does not set. Do not bypass these guards manually.

Public api/requests.js still uses Resend, with its existing hard-coded sender and owner recipient. Keep it working until Gmail receipt and a single-path intake cutover have passed. Supabase SMTP is a separate email path: setting Resend in Vercel does not configure Supabase.

Credential-independent fix in this audit: classify revoked consent, OAuth-client misconfiguration and temporary refresh failures separately; temporary network/provider failures no longer falsely require reconnect. Use the Google SDK's typed S256 PKCE constant. Unit tests, TypeScript and Next production build passed; live Google tests remain pending.

## Numbered setup sequence and subsequent tests

1. Assign the existing Supabase service-role key directly in Vercel CRM Preview for codex/crm-workflow. Preserve the existing encryption key. Test deployment presence diagnostics without revealing values.
2. Configure Supabase external SMTP and email OTP template; complete protected owner organization/membership/MFA setup. Test real OTP delivery, verification, logout and unauthorized/other-tenant rejection.
3. Enable the two Google APIs, configure External Testing/test user and create the web OAuth client with the exact callback and scopes above. Enter client ID/secret directly in Vercel and redeploy.
4. Use Connect Google from the stable CRM alias. Test consent, callback replay denial, token encryption, refresh, account identity, owned-calendar listing, selection, free/busy and connection health.
5. Run Gmail's explicit self-test and verify actual receipt. Test ambiguous-send handling without duplicate retries. Keep existing website email active; do not enable dispatch until activation and intake cutover implementation pass.
6. Test calendar projection, repeated sync/idempotency, external edits, revoked access and disconnect fencing. Configure an optional free POST scheduler only after a live tenant exists; test wrong-secret denial and bounded queue processing.
7. Complete remaining reminder/customer-link and Gmail activation workflows, then test end-to-end intake, approval, confirmation, reminder, rescheduling and failure recovery before any Production release.

References: https://developers.google.com/identity/protocols/oauth2/web-server ; https://developers.google.com/workspace/calendar/api/auth ; https://developers.google.com/workspace/gmail/api/auth/scopes ; https://supabase.com/docs/guides/auth/auth-smtp .

