# Production acceptance and franchise foundation — October 8, 2026

The owner's current instruction treats the website and CRM as a working production product, not an MVP. Verify actual connections, execution, notification delivery/receipt, login, edits and website-to-paid-invoice flow. The supplied v16 brand packet is the graphic source; it does not authorize changing its approval record or offering franchise agreements.

| Requirement | Pass condition / current evidence |
|---|---|
| Preserve active product | Audit the current deployed website and CRM; never replace live connections with mock evidence |
| Website intake | Labeled test through visible website, all required fields, cross-category work, one durable request and backup notification |
| Identity | Actual authorized owner/customer login, logout, recovery, request-return and tenant/role denial; no impersonation or auth bypass |
| Clean customer data | Clear normalized contact/property details, explicit account linkage, no automatic identity merge by matching email |
| Scheduling | Hold, approve, conflict refusal, edit/reschedule, decline/cancel and capacity release; current Google event matches canonical appointment |
| Notifications | Actual scheduled-worker execution, queued/accepted/received distinction, no duplicate or stale notices; inspect HTML/text/links and reply targets |
| Billing | Quote approval → job → completion → editable draft → exact owner-approved invoice/PDF → explicit send → test-only settlement → paid follow-up |
| Test safety | Only clearly marked owner test data and verified owner mailbox; no real-customer changes, real payment charge, fabricated work or revenue claim |
| Unattended behavior | Verify workers without open CRM and due/stale/canceled reminder controls; no time-travel of real appointments |
| Production access | Customer and franchise owner links must work without a Vercel account; preserve auth/provider controls while fixing topology |
| Brand | Full supplied logo preserved; badge secondary; website-first/contact hierarchy; preserve readable colors/typography and approval status |
| Franchise scale | One shared product, per-company branding/catalog/hours/origins/integrations/memberships; platform metadata-only; second-tenant isolation and operator readiness gates |
| Business rules | $60/$45 hourly rates, one two-hour minimum, Mon–Fri starts 8–3 CT/end by5, customer materials/disposal/supplier payment, exclusions, no rejected wording/claims |
| Production operations | Current security advisors, OAuth refresh, restore, failed/unknown delivery recovery, monitoring and audit evidence |
| Scope honesty | Distinguish browser app from native iOS; do not claim subscriptions/onboarding/weather/recurrence/AI or inbox receipts without evidence |
| Whole-deliverable review | Review current source and brand standards, all changed code, templates, rendered screens/PDFs, calculations, metadata and final report |
| External changes | Live labeled acceptance test authorized by current request; paid services/domain purchases/security weakening remain unapproved |

Acceptance is pending. Historical documents are checkpoints, not current integration health. Finish or identify concrete blockers; do not certify production while material requirements remain uncertain.

## Latest website acceptance — October 8

- Home: short introduction, six compact category links, visible rates and one request action; detailed services and form on dedicated pages.
- Calendar: closed by default; load availability on first deliberate opening; keyboard accessible; selected hold survives closing/reopening, expiry still applies.
- Bots: verify server honeypot, origin validation, signed bridge, trusted-client quotas, short hold expiry, capacity checks and owner-only confirmation. Do not claim absolute bot prevention.
- Premium usability: readable sizes/contrast, consistent navy/green/gold, mobile layouts without horizontal overflow, unchanged official logo and contact/business rules.
- Release: review the preview before public deployment. Full live billing acceptance remains pending owner authentication and isolated settlement.

## Evidence collected in this pass

- Public cleanup is isolated from main in `codex/website-cleanup-2026-10-08`, PR #5. Commit `0aaeb83e4763dd3e370bbd5f8e21a3f1b27ada15`, tree `30e7ed042e3a7d8339dd0cb5876b5fb566a09483`. Vercel public-project preview `dpl_4KHVPhzcRiuBSMJsP5v9Ph8RCeTh` READY. Public main was not moved.
- 24 public website checks, syntax check, and nine-page build passed. CRM tree: 160 unit checks, TypeScript and PGlite migration/SQL assertions passed. Calendar tests cover no network before opening, preserved hold when closed/reopened, expired hold cleanup, conflict recovery and uncertain-delivery locking.
- Browser: compact home has no embedded request form; six service links lead to the correct expanded category. Calendar closed by default, click/Enter expands and collapses. At 1363px desktop, home height 2366px and no horizontal overflow; request page also has no horizontal overflow. Mobile widths remain a visual acceptance gate in this pass.
- Preview availability returned 503 (preview connection not verified). Actual production `/api/availability` returned 200, America/Chicago and 305 offered slots on October 8; browser also rendered actual dates. Preview HTTP success alone does not establish production integration.
- Exactly one labeled owner request `e889a505-5dc8-4970-9278-9eae17ac7eb4` created at 17:45:38 UTC, status submitted, containing Lawn care / Leaf management and Yard & garden / Planting flowers. Fake address and owner contact only. Zero appointments for this request. No charges, invoice, customer account or revenue created.
- Scheduled mail worker accepted both request.customer_receipt and request.owner_notification on their first attempt. Gmail messages `1a11c9f4a2281bd0` (17:46:03 UTC) and `1a11c9f51ea92fc1` (17:46:05 UTC) have SENT and INBOX labels in the verified owner mailbox. This proves actual receipt in that mailbox, not deliverability to every external provider. HTML and plain text contain both services, correct Reply-To, official logo, and no false appointment confirmation. Owner request link preserves request and organization navigation context.
- Live database quota function restricts availability to 60/minute per trusted client; requests to 20/hour per trusted client and 5/hour per email digest; idempotent retry receipts retained. Anonymous slot holds are one per browser with at most three other active browser holds per trusted client. Holds expire; provider/capacity/business-hours checks apply. Public intake cannot confirm appointments. Distributed bots can still submit within limits; these checks are not a CAPTCHA or proof of human identity.
- Google account reports connected with calendar selected; mail and calendar cron schedules are active. These settings are supplemented by today's actual availability and Gmail receipt evidence, not used alone to certify execution.
- Supabase advisor warnings remain: provider-installed pg_net in public; leaked-password protection disabled. Intentional private owner-signin deny-by-default table notice remains. No paid upgrades or security weakening performed.

## Remaining production gates

Secure owner email-code sign-in timed out without establishing an authenticated session. Appointment approve/decline/edit/cancel, actual Google-event synchronization, invoice send/PDF/payment and paid follow-up remain unverified live. Do not impersonate the owner, read sign-in secrets through Gmail, record fake paid revenue, or call a zero-value invoice full paid-automation acceptance.

Second franchise tenant/operator setup, configurable public website identity/catalog/origins, subscription onboarding, native iOS signing/device acceptance, independent restore/monitoring and Google consent/token longevity remain separate gates. Brand packet v16 README still says OWNER APPROVAL REQUIRED; its planning commercial terms and locked assets have not been changed or represented as approved franchise contracts.

The website change is reviewable; the entire production/franchise product is not certified. No global constraint-pass claim is made while these gates remain open.
