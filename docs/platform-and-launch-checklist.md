# Platform architecture and advertising acceptance — October 3, 2026

Latest owner direction: add independent CRM and branded business websites to the build sequence; build remaining gaps so advertising can begin this week. Preserve all earlier service, accessibility, intake, security and workflow requirements. This document sets scope; it does not certify readiness.

## Pass/fail requirements

- One CRM implementation, independently deployed from business websites; each company uses isolated memberships, records, integrations and settings. No per-customer code forks or domain-as-authorization.
- Website origin maps to company on the server; form cannot choose a company. Unknown/unverified domains fail closed. Developer administration stays metadata/subscription-only.
- Published company colors apply to its owner workspace, with contrast checks against actual surfaces. Invalid/unavailable colors fall back to readable defaults; clear company changes do not retain prior branding.
- Every owner's website gets its own domain, official logo, catalog, permitted services, contact information, legal content and rates. Website/logo/email/invoice customization remains unfinished until each channel passes acceptance.
- Separate CRM custom domain or subdomain is optional; no domain purchase/DNS/production-branch change in this pass. Auth callback origins, cookies, customer links, CORS and provider callbacks must be verified before switching.
- Public advertising acceptance: live mobile request submission with all required fields/multiple categories, visible confirmation, owner inbox receipt/reply path, retry behavior, working call/text links, clear scope/rates/terms and no unproven scheduling promises.
- Full CRM acceptance still requires connected Google, unattended notifications, calendar decisions, customer journeys, invoice delivery, reports, weather/recurrence, branding, recovery and mobile checks. Advertising website acceptance does not substitute for CRM completion.

## Build order amendment

1. Keep public request/email flow working while completing the CRM. Verify real public phone journeys and owner receipt before advertising.
2. Establish independent CRM product boundary and effective tenant branding now. Keep common contracts and APIs for the future iOS app.
3. Finish durable intake/backup mail, customer identity, company/domain binding, provider setup and verified scheduling. Resolve protected-preview production topology before exposing customer account links.
4. Finish invoice document, explicit send/PDF, paid thank-you; daily/evening briefings, recurrence, weather and reports. Use deterministic records and supervised AI actions.
5. Complete branded website configuration, assets and tenant onboarding. Prove second-company isolation without seeding a real paying owner or accessing another company's customer data.
6. Production hardening and end-to-end live acceptance; subscriptions and native iOS remain later as previously directed.

Open owner-controlled checks: actual mobile form receipt; Google consent and Gmail self-test receipt; domain selection when ready; browser-closed notifications and service/invoice journeys. No promises of readiness or advertising date until these checks pass.

Verified in this pass: 68 unit tests, root TypeScript, public syntax checks, nine-page website build and optimized CRM build pass. Published palette is sanitized server-side and applies only to the selected company workspace; unsafe/missing palettes reset to defaults. Actual white/card/secondary/header surfaces receive contrast checks. Public home and request routes returned HTTP 200. Hosted read confirms zero connected Google accounts and zero enabled tenant mail controls. These checks do not prove form delivery, visual/mobile acceptance or unattended workflows.
