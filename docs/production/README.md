# Your Neighborhood Service Guy — production completion charter

Effective 15 October 2026. Accountable product owner: **Ed Hemmer**. Engineering lead: the engineer/agent executing the tracked work; this role does not imply a hired human reviewer. Ed assigns an operations custodian and independent human reviewer before their gates can close.

This is the controlling completion plan for the website, CRM and native app. It replaces conflicting *status* statements in dated checklists. The latest owner instruction and business rules in [governance](../governance.md) still control scope. Earlier documents retain historical evidence; their test counts, “pending” labels, empty-database claims and deployment notes are not current state. Original promised features remain required unless Ed explicitly changes them.

## What complete means

| Outcome | Required result | Release command |
| --- | --- | --- |
| Website and CRM for daily operations | Every WEB gate accepted, complete customer-to-owner-to-invoice journey, usable mobile interface, actual provider/device acceptance and operational recovery. | `npm run completion:gate -- --release web --candidate <40-character-SHA>` |
| Native iOS distribution | WEB plus every IOS gate, matching native evidence register and actual Apple distribution decision. CRM acceptance precedes native distribution. | `npm run completion:gate -- --release ios --candidate <40-character-SHA>` |
| Multi-company product for sale | WEB plus every SCALE gate, repeatable tenant onboarding, isolation, support and real business/legal acceptance. Native readiness is declared separately; never market it as included/ready until IOS also passes. | `npm run completion:gate -- --release scale --candidate <40-character-SHA>` |

These are delivery milestones within the full product commitment, not permission to drop iOS or broader company features. Shipping a safe improvement is different from declaring a milestone complete. No completion percentage based on test count. No whole-product “done” while a promised milestone is open. No award, accessibility certification or Apple approval claim without actual evidence.

## Single tracked register

[contracts/production-completion.json](../../contracts/production-completion.json) owns gate status, role, dependencies, next action, acceptance and evidence. Run `npm run completion:report` to see the next available gates. Gate IDs/milestones and R01–R21 coverage are pinned by [the checker](../../scripts/check-production-completion.mjs); removing a gate or required scope fails CI. [Execution protocol](execution.md) defines how to advance it; [acceptance runbook](acceptance.md) defines owner/provider/device proof.

Statuses: **open** (needs verification/work), **working** (actively assigned), **blocked** (a named dependency prevents its next action), **verified** (accepted evidence for a specific candidate). Initial gates are open because aggregate production acceptance has not been re-established, even when substantial implementation is deployed. This deliberately does not relabel deployed features as missing. Historical evidence is starting material, not automatic full-gate acceptance. WEB-01 must produce the detailed feature inventory; every partial/missing promise gets an issue and gate before it can pass.

Each verified gate needs a reviewable HTTPS evidence record, candidate SHA, reviewer, timestamp and result. Record private proof in a restricted location; public Git contains only sanitized references. Evidence must name the actual build/environment, case IDs, observed outcomes, remaining findings and reviewer. A green structural checker cannot authenticate a link or replace human/provider/device evidence. Candidate changes require fresh evidence or an explicit reviewed carry-forward record at the new SHA explaining why the old result still applies. Same-candidate evidence prevents quiet reuse after material changes.

## Non-negotiable product constraints

- Preserve official logo and navy/forest/gold/cream, natural neighborly wording and approved business name/contact. Use “Request service appointment”; no “Request help” CTA. Public owner name placement follows governance. No fake reviews, rankings or security guarantees.
- Keep public mobile navigation visible and restrained, with recognizable buttons; avoid oversized navigation. Customer request is Services → Time → Details; account optional; name, phone, email and address required. Calendar is easy to find and honest about hold versus confirmation. Free address matching remains optional/advisory, including provider outages.
- Preserve standard $60/hour and Community $45/hour, one combined two-hour minimum and latest approved service catalog/settings. No newly enabled regulated/held work, above-five-foot work, ladders, herbicides, deicer or unapproved fees. Supplier-prepaid material is never billed again; customer water note where relevant. Historical conflicting acreage/service notes do not authorize catalog changes.
- Owner phone/iPad workflow is open/read → confirm → complete → issue invoice → close out. Use date/time/status graphics and concise next actions; preserve full customer notes. Show the pending invoice after scheduling as a preview, never an issued bill. Keep actual work, tax review, issuing, delivery and receipt deliberate and traceable.
- Current company permissions, exact revisions and canonical database commands own business state. Retain submissions, agreements, issued snapshots and audit. Unknown responses reconcile the exact attempt; no blind retry, invented consent/work/funds, duplicate messages or hidden service-role client authority.
- Required MFA stays removed. No paid service, address provider, AI budget, Apple enrollment/build charge or hosting purchase without explicit owner authorization. Stripe remains excluded from current development/activation; cash/Zelle correctness remains required. Exclusion is recorded, not silently reintroduced as a blocker to this release.
- AI is a supervised proposal/coordination tool. Saved evidence, deterministic pricing/tax/scheduling and permissions remain authoritative. No paid model activation; no claim that the current deterministic coordinator is a fully activated external AI agent.
- No real customer messages, bookings, work, invoices, payments, consent or tax approval manufactured for QA. Isolated synthetic tests first; production stays read-only unless the owner authorizes a specific real action or controlled recipient test. No public customer screenshots, credentials or production data in test fixtures.

## Design and operational definition of done

Every included flow has a working entry point, a clear primary action, loading/empty/error/permission states, safe retries, preserved drafts, next-step confirmation and a discoverable way back. All advertised controls must connect to real guarded behavior; placeholders are removed from release surfaces until implemented. Unfinished optional connections show their actual status. Full supported customer/property/contact/note/settings entry and correction abilities must be inventoried and verified, including permission denials and immutable evidence boundaries.

Before completion: zero unresolved blocker/high defects in included scope; current full automated checks; exact-head PostgreSQL CI; full edited and surrounding workflow review; intended production merge SHA on both domains; migration/configuration verification; read-only live smoke; owner/device/provider acceptance; accepted backup/monitoring/support ownership. Lower defects need an assigned issue and explicit product-owner disposition; they cannot hide a broken promised flow. A verified gate reopens after a regression or invalidated dependency.

This package establishes governance. It does not itself complete the product. The execution rule is to close the remaining engineering and acceptance cases against this finite register, not append another unowned checklist after each run.
