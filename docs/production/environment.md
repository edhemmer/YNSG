# Environment variables

Names only. Never commit values. This inventory is generated from a scan of the source (`apps/web`, `apps/mobile`, `api`, `lib`, `site`, `scripts`, `packages`) and is guarded by `tests/environment-inventory.test.mjs`: reading a variable in code without listing it here fails CI.

**Kind is inferred from the name only.** Confirm it before relying on it for secret handling. This table does not record where each value is set (Vercel project, GitHub Actions or local); add that as each one is confirmed. Stripe stays excluded from current development and activation (see [the completion charter](README.md)); its variables are listed because code references them.

| Variable | Kind | Read by |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | secret | `apps/web` |
| `APNS_PRIVATE_KEY` | secret | `apps/web` |
| `CRM_AVAILABILITY_BYPASS_SECRET` | secret | `lib/transactional-email.js`, `lib/website-availability.js`, `lib/website-guard.js` |
| `CRM_INTAKE_HASH_KEY` | secret | `lib/public-intake.js` |
| `CRON_SECRET` | secret | `apps/web` |
| `GOOGLE_API_KEY` | secret | `apps/web` |
| `GOOGLE_CLIENT_SECRET` | secret | `apps/web` |
| `GOOGLE_MAPS_API_KEY` | secret | `apps/web` |
| `GOOGLE_ROUTES_API_KEY` | secret | `apps/web` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | secret | `apps/web` |
| `GOOGLE_WORKER_SECRET` | secret | `apps/web` |
| `OWNER_PUSH_WORKER_SECRET` | secret | `apps/web` |
| `PUSH_TOKEN_ENCRYPTION_KEY` | secret | `apps/web` |
| `RESEND_API_KEY` | secret | `apps/web`, `lib/transactional-email.js` |
| `STRIPE_MERCHANTS_JSON` | secret | `apps/web` |
| `STRIPE_WEBHOOK_SECRET` | secret | `apps/web` |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | `apps/web`, `lib/public-intake.js`, `scripts/capture-recovery.mjs` |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | secret | `apps/web` |
| `APNS_BUNDLE_ID` | configuration (not secret by name) | `apps/web` |
| `APNS_ENVIRONMENT` | configuration (not secret by name) | `apps/web` |
| `APNS_KEY_ID` | configuration (not secret by name) | `apps/web` |
| `APNS_TEAM_ID` | configuration (not secret by name) | `apps/web` |
| `APP_ORIGIN` | configuration (not secret by name) | `apps/web` |
| `CRM_AVAILABILITY_URL` | configuration (not secret by name) | `lib/website-availability.js`, `lib/website-guard.js` |
| `CRM_ORGANIZATION_ID` | configuration (not secret by name) | `lib/public-intake.js`, `lib/transactional-email.js` |
| `GOOGLE_CLIENT_ID` | configuration (not secret by name) | `apps/web` |
| `GOOGLE_WORKER_ORGANIZATION_ID` | configuration (not secret by name) | `apps/web` |
| `PUBLIC_SCHEDULING_ORGANIZATION_ID` | configuration (not secret by name) | `apps/web` |
| `REQUEST_FROM_EMAIL` | configuration (not secret by name) | `lib/transactional-email.js` |
| `STRIPE_SECRET_KEY` | configuration (not secret by name) | `apps/web` |
| `SUPABASE_URL` | configuration (not secret by name) | `apps/web`, `lib/public-intake.js` |
| `TRANSACTIONAL_EMAIL_FROM` | configuration (not secret by name) | `apps/web`, `lib/transactional-email.js` |
| `YNSG_AI_MODEL` | configuration (not secret by name) | `apps/web` |
| `CRM_INTAKE_ENABLED` | feature flag | `api/requests.js` |
| `REQUEST_LEAD_SOURCE_ENABLED` | feature flag; set `true` only after migration `20261106150000_request_lead_source` is applied, otherwise the optional "How did you hear about us?" answer is validated and dropped | `api/requests.js` |
| `PUBLISH_HOME_CARE_PLAN` | build-time feature flag; `true` publishes /home-care-plan/ and its footer link once the owner confirms plan pricing | `scripts/build.mjs` |
| `GOOGLE_CALENDAR_WORKER_ENABLED` | feature flag | `apps/web` |
| `GOOGLE_GMAIL_DELIVERY_ENABLED` | feature flag | `apps/web` |
| `OWNER_PUSH_ENABLED` | feature flag | `apps/web` |
| `PUBLIC_AVAILABILITY_ENABLED` | feature flag | `apps/web` |
| `YNSG_AI_ENABLED` | feature flag | `apps/web` |
| `EXPO_PUBLIC_APNS_ENVIRONMENT` | public (ships to browser or app) | `apps/mobile` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | public (ships to browser or app) | `apps/web` |
| `NEXT_PUBLIC_LOGIN_BRAND` | public (ships to browser or app) | `apps/web` |
| `SUPABASE_PUBLISHABLE_KEY` | public (ships to browser or app) | `apps/web` |
| `NODE_ENV` | platform-provided | `apps/web`, `scripts/verify-careers-labor.mjs`, `scripts/verify-customer-service-insights.mjs`, `scripts/verify-email-templates.mjs`, `scripts/verify-field-system.mjs`, `scripts/verify-google-reconnect.mjs`, `scripts/verify-job-companion.mjs`, `scripts/verify-owner-mobile.mjs`, `scripts/verify-owner-network.mjs`, `scripts/verify-readability.mjs`, `scripts/verify-service-preparation.mjs`, `scripts/verify-team-field-work.mjs`, `scripts/verify-workspace-navigation.mjs` |
| `VERCEL` | platform-provided | `apps/web`, `lib/public-intake.js`, `lib/website-guard.js` |
| `VERCEL_ENV` | platform-provided | `scripts/ignored-build-step.mjs` |
| `VERCEL_GIT_COMMIT_SHA` | platform-provided | `scripts/ignored-build-step.mjs` |
| `VERCEL_GIT_PREVIOUS_SHA` | platform-provided | `scripts/ignored-build-step.mjs` |
| `PGDATABASE` | test or operator tooling | `scripts/capture-recovery.mjs` |
| `PGHOST` | test or operator tooling | `scripts/capture-recovery.mjs` |
| `PGPORT` | test or operator tooling | `scripts/capture-recovery.mjs` |
| `PGSSLMODE` | test or operator tooling | `scripts/capture-recovery.mjs` |
| `PGUSER` | test or operator tooling | `scripts/capture-recovery.mjs` |
| `PLAYWRIGHT_MODULE` | test or operator tooling | `scripts/verify-field-system.mjs`, `scripts/verify-owner-mobile.mjs`, `scripts/verify-public-layout.mjs`, `scripts/verify-workspace-navigation.mjs` |
| `YNSG_BACKUP_PROJECT_REF` | test or operator tooling | `scripts/capture-recovery.mjs` |
| `YNSG_BROWSER_OUTPUT` | test or operator tooling | `scripts/verify-owner-mobile.mjs` |
| `YNSG_BROWSER_PORT` | test or operator tooling | `scripts/verify-owner-mobile.mjs` |
| `YNSG_CHROMIUM_EXECUTABLE` | test or operator tooling | `scripts/verify-careers-labor.mjs`, `scripts/verify-customer-account.mjs`, `scripts/verify-customer-service-insights.mjs`, `scripts/verify-email-templates.mjs`, `scripts/verify-field-system.mjs`, `scripts/verify-google-reconnect.mjs`, `scripts/verify-job-companion.mjs`, `scripts/verify-owner-mobile.mjs`, `scripts/verify-owner-network.mjs`, `scripts/verify-public-layout.mjs`, `scripts/verify-readability.mjs`, `scripts/verify-service-preparation.mjs`, `scripts/verify-team-field-work.mjs`, `scripts/verify-workspace-navigation.mjs` |
| `YNSG_COMPANION_OUTPUT` | test or operator tooling | `scripts/verify-job-companion.mjs` |
| `YNSG_FIELD_OUTPUT` | test or operator tooling | `scripts/verify-field-system.mjs` |
| `YNSG_FORCE_BUILD` | test or operator tooling | `scripts/ignored-build-step.mjs` |
| `YNSG_INSIGHTS_OUTPUT` | test or operator tooling | `scripts/verify-customer-service-insights.mjs` |
| `YNSG_NETWORK_OUTPUT` | test or operator tooling | `scripts/verify-owner-network.mjs` |
| `YNSG_PUBLIC_OUTPUT` | test or operator tooling | `scripts/verify-public-layout.mjs` |
| `YNSG_READABILITY_OUTPUT` | test or operator tooling | `scripts/verify-readability.mjs` |
| `YNSG_SERVICE_PREP_OUTPUT` | test or operator tooling | `scripts/verify-service-preparation.mjs` |
| `YNSG_TEST_POSTGRES_CONTAINER` | test or operator tooling | `scripts/verify-postgres.mjs` |
| `YNSG_WORKSPACE_OUTPUT` | test or operator tooling | `scripts/verify-workspace-navigation.mjs` |
