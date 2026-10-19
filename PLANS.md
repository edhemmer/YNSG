# YNSG production completion plan

Updated: 2026-10-18
Status: OPEN — evidence required. This document is not a certification of production readiness.

## Authority and scope
Complete the existing Your Neighborhood Service Guy website, owner CRM, customer experience, scheduling, billing, payments, inventory foundation, integrations, and multi-tenant SaaS/franchise administration. Preserve approved branding, neighborly language, service limits, pricing, mobile-first accessibility, and existing project-specific requirements. Do not silently replace approved functionality with a landing-page-only MVP. Keep internal IDs, administration, secrets, and operational details out of public views.

## Reconciliation finding
The default-branch README inspected 2026-10-18 describes a static site and email-only POST /api/requests; it explicitly says CRM, booking, payments, and accounts are not in that release. This may be stale. Actual code, branches, deployments, database, and runtime must be independently inventoried before declaring any feature missing or complete. No code search result alone proves absence.

## Required evidence and gates
Each gate must record implementation paths, tests, CI run, staging verification, and rollback instructions. Mark PASS only with direct evidence; otherwise OPEN or BLOCKED with precise reason.

- G01 Repository reconciliation: inspect main, active branches/PRs, workflows, architecture, deployment configuration and latest release SHA; update README to match verified reality.
- G02 Public site: approved premium responsive navigation, branded imagery/carousel, readability and accessibility, correct service catalog and exclusions, working links, forms, error and empty states.
- G03 Identity/security: customer/owner/admin roles, password reset and email-link flows, tenant boundaries, server-side authorization, RLS where applicable, rate limiting, audit logs, secret handling.
- G04 Intake: validated address and service data, durable idempotent requests, spam protection, correct notifications, optional post-request signup, safe public references.
- G05 Scheduling: authoritative internal availability independent of calendar connection, holds and expiry, owner approval/reschedule/decline, travel buffers, recurring requests, reminders, calendar sync and conflict tests.
- G06 Owner operations: mobile-first action cards, request history, service notes, route planning, alerts, reporting, customer records and operational override.
- G07 Billing: branded invoices numbered YYYYMM-####, tax rules, payment statuses, Stripe/Zelle/cash reconciliation, split payments, refunds/fees disclosures and archiving.
- G08 Inventory foundation: barcode product identification, unit/cost/tax and receipt capture, inventory consumption and job linkage; defer device-native scanner UI until iOS implementation.
- G09 SaaS: tenant onboarding, data segregation, role administration, franchise configuration, branded contact customization and subscription lifecycle without tenant access to developer systems.
- G10 Integrations: email sender/domain and deliverability, calendar, maps/routing, Stripe/webhooks, production secrets and failure recovery.
- G11 Quality: unit/integration/E2E coverage of happy/error/abuse paths, accessibility/mobile tests, dependency/security scanning, database migrations and rollback.
- G12 Release: staging smoke test, CI green on exact commit, deploy artifact/SHA verification, production smoke tests, rollback ready, monitoring and incident response.

## Execution rules
1. Start with repository and deployment truth; reconcile against approved requirements. Do not claim a gate closed based on plans, mocks, or a successful build alone.
2. Batch related changes into scoped branches and PRs; use isolated worktrees for parallel agents and documented contracts. Never merge failing CI or deploy an unverified SHA.
3. Work autonomously on engineering, fixtures, automated testing and staging. Request owner input only for genuinely external consent, payment/live-provider credentials, or final real-world acceptance.
4. No arbitrary 98% completion claim: show verified pass/fail/blocked state per gate. Never fabricate CI results, customer records, deployment success, or test evidence.
5. Preserve the existing production experience; use reversible migrations and feature flags for risky changes.
6. Before delivery, compare the full change against requirements, exclusions, previously rejected choices, names, dates, links, claims, security and formatting. Record unresolved uncertainty plainly.

## Next execution batch
Inventory repo branches/PRs and current deployment. Inspect actual routes, API, migrations, auth and workflows. Build a traceability matrix linking each approved requirement to implementation and test evidence. Fix critical security/data-integrity and end-to-end request-to-invoice gaps before visual polish. Update this plan after each verified batch.
