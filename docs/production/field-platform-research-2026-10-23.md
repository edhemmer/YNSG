# Field platform comparison and YNSG implementation priorities

Research date: October 23, 2026. Scope: WEB-09 and WEB-10. This is a product comparison and implementation backlog, not a claim of production readiness or 95% automation.

## What to adopt

| Platform / primary source | Documented pattern | YNSG application |
| --- | --- | --- |
| [Jobber mobile](https://www.getjobber.com/features/field-service-management-app/) and [AI voice/chat](https://help.getjobber.com/en/articles/jobber-ai-voice-and-chat-beta/) | Phone-based quoting, scheduling and payment; voice interaction for administrative tasks | One job workspace; capture observations by voice into an editable draft, with the original retained; use existing canonical commands for decisions |
| [ServiceTitan Atlas](https://help.servicetitan.com/docs/atlas-in-mobile) | Job-specific answers using equipment and service context | An optional question box inside the current job, with answers linked to exact saved evidence; avoid a competing dashboard |
| [Housecall Pro CSR AI](https://help.housecallpro.com/en/articles/9740104-csr-ai-overview) | Intake, appointment handling, call summaries and configurable permissions | Prepare complete request records and proposed appointments from intake; keep scheduling rules and explicit confirmation authoritative |
| [Workiz Genius Phone](https://www.workiz.com/features/phone-system/) | Unified communications, searchable summaries and event-triggered reminders | Keep communication history with the job; derive drafts from saved milestones; reconcile delivery before retries |

These are vendor-documented capabilities, not independently measured quality or usability rankings. Text-answering availability differs by vendor and rollout; do not infer general availability from a marketing headline.

## Current source findings

Production source is `codex/crm-workflow`, not `main`. Baseline `ba203307f7fdc1f3ce86035013212601c88ff2ce` already contains the end-to-end field redesign from PR 198.

- `apps/web/app/command-center.tsx`: prioritized, deduplicated work/visits/request queue; bounded reads and immediate permission-denial hiding. Before this change, locating another loaded job required scanning collapsed sections or navigating away.
- `apps/web/app/service-workflow.tsx`: saved-state appointment → agreement → actual work → invoice → receipt flow. Preserve this single workspace and its recovery guards.
- `apps/web/lib/field-agent-plan.ts`: deterministic recommendations and template drafts. This is not a live language-model integration.
- `apps/web/lib/field-preparation.ts`: evidence-based preparation without external calls. Keep the deterministic path usable when AI is unavailable.

## Implemented in this candidate

An accessible, mobile-sized local finder searches customer names, addresses where available, service/task words and work status across the loaded queue. It uses all query words, tolerates case/diacritics, deduplicates the same job across sources, opens the existing canonical job workspace and never sends queries externally. A clear control restores the next-action view. Results explicitly cover loaded records only; Jobs, Calendar and Requests remain available for the full lists. Company changes scope the query and private reads to the new organization.

## Free automation first

Owner clarification in this session: do what is possible for free; this chat is the owner's only AI. Do not activate paid inference, transcription or AI hosting. No provider or budget selection is outstanding for this candidate. Keep the model contract below as a future design only. Current features must be described as automatic preparation or suggestions, not live AI.

Use existing saved-state rules for task ordering, draft scope from requested services, route/day preparation and invoice preparation from recorded work. Keep manual corrections and original evidence available. The local finder adds no dependency, provider call or usage charge.

## Future optional AI implementation contract

The target is **95% of eligible administrative preparation**, measured over real observed tasks, not 95% of business decisions or physical work. Record eligible tasks, successfully prepared drafts, owner corrections, exceptions, latency and actual provider cost. Report both task coverage and correction rate; do not count a generated draft as correct merely because a model returned text.

Only if separately authorized in the future: job-scoped draft preparation using an owner-approved provider/model and explicit spending limit. Input contains the minimum authorized job context, record IDs/revisions, the user's request and allowed draft kinds. Output contains a typed draft, supporting record references, missing information and review requirements. Treat customer text and model output as untrusted data. Reject unsupported evidence references and stale revisions; do not give the model mutation credentials. Pricing, availability, permissions and financial calculations remain deterministic.

Implement in this order:

1. Job brief / questions with linked evidence and visible unknowns. No invented equipment facts, prices or appointment availability.
2. Voice-to-draft field notes with editable transcript, explicit microphone action, clear recording state, stop/cancel and manual fallback. Do not activate remote transcription until its provider and data handling are approved.
3. Scope and communication drafts from saved requests, with original customer wording retained and edits reviewable.
4. Invoice preparation from actual time/materials, with owner review and existing authoritative calculation/issue commands.
5. Exception-first daily preparation: missing agreements, incomplete notes, overdue decisions, unsuccessful delivery. Keep marketing in its existing destination.

Paid activation is outside the owner-approved free scope. No API keys belong in chat or browser code. Prepare a server-only integration behind disabled configuration, with timeouts, per-company budgets, audit metadata and no-provider fallback before activation.

## Pass/fail acceptance

- Search opens the matching saved job; active/scheduled/request duplicates produce one result.
- No match is not described as proof that the customer has no other jobs. Partial/failed reads and pagination remain visible.
- A company switch or permission denial never displays another company's results.
- At 320, 390 and 768px and 200% text: no horizontal page overflow; search/clear/results reachable by keyboard; controls at least 44px.
- Existing request-to-receipt journey and stale/replay/permission tests continue to pass.
- AI answers must be evaluated on missing, contradictory and malicious source content, stale saved state, provider outage, exhausted budget and user correction before making automation claims.
- Actual owner device/time-on-task acceptance remains open. This candidate does not close whole-product gates.
