# Production completion batch — October 2, 2026

Base reviewed: CRM 931e34cf668d9112a9eab68c5587ac9b10c368ed. Full master and scheduler requirements remain release requirements. Separate branch codex/production-completion preserves the active CRM branch and current public deployment.

Implemented in this batch:
- Multi-service request items/shared contract/CRM rendering from PR #1; latest main website selection changes merged without rewriting public copy or assets.
- One minute-based settings contract with commercial fields, exact 36-hour precision, legacy horizonDays read compatibility, protected versioned publication, contrast checks and a review/publish interface.
- Platform-invited new-owner setup provisions service-app module entitlements and a primary operator. Tenant configuration cannot grant roles, entitlements or Google activation.
- Protected Start/Pause/Resume commands with recorded sessions, revision checks, audit/idempotency and completion closing open time. Existing invoice still uses approved quoted labor; actual-time/material/change-order billing expansion remains required.
- Every requested category must be reviewed and hourly-approved before quoting. Integer-cent half-up quote pricing agrees with the pure domain calculation.
- Workspace pagination and future-oriented agenda instead of silently showing only the oldest 50 appointments. Dashboard financial total remains labeled as the current view, not an organization-wide report.
- Private Google events include contact details, all requested services and an authorized request link. No access codes or staff notes are exported.
- Schema readiness guards disable new publication/field actions when the reviewed migration has not been applied.

Verification: 30 domain/contract/Google/auth/session tests pass; empty-schema migration and foundation/commercial/scheduler/Google/owner/operations SQL assertions pass locally. TypeScript and Next production build pass. Static check/build produces nine pages. Operations assertions cover cross-category persistence, one request/outbox on retry, second-category compliance rejection, versioned settings, stale publication, start/pause/resume, one invoice on retry, session closure and tenant isolation. No real messages or provider operations occurred. Browser/mobile visual checks and concurrent real PostgreSQL sessions remain unverified.

Hosted changes: multi_service_intake applied successfully. The broader production_workflows rollout was rejected by automatic approval review, citing its live schema/functions/triggers/privileges and owner/configuration blast radius. It has NOT been applied. No workaround was attempted. Its exact reviewed SQL is supabase/migrations/20261002174208_production_workflows.sql; approval is required before hosted application. A review deployment can coexist with the older schema through readiness guards.

Rollback/recovery: this migration adds work_sessions and narrow commands, replaces validated scheduling/quote/owner functions and adds a completion trigger. It does not delete business records or enable provider delivery. Before approval/application, retain a schema/data export and verify restoration; restoring former function definitions is the forward repair path if needed. Do not drop tables containing real work records to roll back. Migration history timestamps differ between prior hosted applications and repository names; reconcile by audited migration name/content, never blindly push duplicate existing migrations.

Remaining full-product gates: actual invited-owner sign-in/MFA; approved hosted rollout; live company settings/Google consent/Calendar/Gmail; customer slot calendar, scoped customer actions and reminders; recurrence; field closeout/material/change approvals; invoice presentation/delivery/corrections and paid receipt/review; portal/delegation/private photos; load sheets/equipment/weather/waitlist/concerns; expenses/mileage/reports/tax fixtures; intelligent assistant; integrations; branding assets/rollback; native iOS; production topology, live concurrency, accessibility, monitoring, backup restore and full release evidence. These are not waived or marked complete.
