# Mobile owner request experience — October 20, 2026

Scope: WEB-03, WEB-04, WEB-05 and WEB-10; production baseline `59c2f2f`, branch `codex/crm-workflow`. Latest owner directive takes precedence over earlier preview-before-completion wording.

## Pass/fail acceptance checklist

- Unconfirmed request: Confirm appointment opens the existing scheduling review; Decline request opens the existing branded, editable reason/message form. Both decisions remain available for quoted requests where the canonical command permits them.
- Explicit approval is required to queue a decline email. Reason choices include service, timing, area and other; proposal time-only decisions remain distinct. Preserve Ed Hemmer's existing signature and contacts.
- No unconfirmed work, complete, invoice, preview, payment or closeout controls, even when retained linked records exist. Do not delete history.
- Use saved appointments, accepted agreements, job status and issued invoices for progressive actions. Preserve cancellation, rescheduling, roles and canonical revision/idempotency protections.
- All entry points provide a clear next action without bypassing scheduling review. No authentication changes, service/pricing changes, provider activation or production QA mutations.
- Customer/header, status/timing, next action, services/notes and supporting records follow a concise hierarchy. Light/dark navy/forest/gold; readable text and accessible focus/touch controls.
- Check 320/375/390/430/768/desktop; keyboard-sized viewport, rotation and enlarged text; no page/dialog/control overflow or overlapping buttons. Capture synthetic screenshots.
- Keep dirty decline/scheduling/notes entries on failures and guard leaving; freeze ambiguous writes and replay the exact saved command. Reject double submission and stale reads/commands safely.
- Exercise confirm, alternative time, decline, work, completion, invoice, partial/settled payments and closed requests with synthetic fixtures. No real emails, payments or appointment changes.
- Full release checks, optimized builds, isolated browser coverage and exact-head native PostgreSQL CI pass before merge. Verify production commit/project/domains and retain rollback SHA. Physical iPhone/VoiceOver/provider delivery acceptance stays separately identified.

Verification and release evidence will be recorded below after execution. This checklist does not assert acceptance or whole-product completion.

## Implementation and isolated verification

- Inbox Confirm opens the existing scheduling panel directly; full request and Jobs entry points retain confirmation and branded decline decisions. The default proposal decline now concerns the service request, with time-only decline still explicit.
- Newly submitted requests can be reviewed for scheduling without a preliminary status mutation. The canonical booking transaction advances a submitted request only after successful approval. Request revision, current calendar/travel facts, resource capacity and actor-bound replay protections remain authoritative.
- A quoted, unconfirmed lead can be declined with its customized message. Pending quote offers are closed atomically, versions are retained, accepted work cannot use this lead-decline path, and later approval of a declined offer is rejected. No authentication functions or settings changed.
- The drawer shows appointment/timing, a single primary decision area, services and the complete customer note before supporting notes/history. Work, invoice previews, related billing links and closeout are absent before a saved reservation exists. Closed requests do not expose later phase navigation. Existing invoice issuance, tax, actual receipts and exceptions retain their guarded components.
- Draft guards now protect editable decline messages. Unknown writes freeze the message and replay the same serialized decision/key. Failed/stale reads block new decisions and offer a refresh while retaining current content.
- `npm run verify:release` passed with 826 application tests, root/web TypeScript, generated contracts, migration inventory integrity, PGlite database fixtures and production dependency audit. Public build and optimized Next.js build passed. Synthetic SQL covers quoted decline/replay/stale revision/late approval, preservation of accepted jobs, submitted scheduling context and booking-only status progression.
- `scripts/verify-owner-mobile.mjs` passed 150 Chromium checks locally with actual React components and the production stylesheet: request drawer at 320/375/390/430/768/1366 in both themes across ten saved states; connected workflow at 320/390/768 across eight states; direct inbox scheduling, confirmation, alternative-time review, branded decline, identical interrupted-write replay, keyboard-sized viewport, landscape and 200% root text. No measured page/dialog/control overflow, overlapping buttons or uncaught JavaScript errors in these cases. All API replies are synthetic; external requests are blocked. Sanitized PNGs were visually inspected. Final summary text sizing is also covered by the mandatory CI browser rerun.
- The local browser runtime is Chromium 134 via a separately installed test runner because the configured newer browser downloads returned invalid archives. WebKit host libraries are unavailable locally; CI runs both configured engines. No repository dependency versions were changed to accommodate the local runner.
- Measured new text/background pairs exceed 4.5:1; the gold focus indicator is 3.55:1 against white. Checkbox labels retain a 44px touch region. These measurements are scoped checks, not an accessibility certification.

## Release and owner acceptance

Required before merge: exact-head release and native PostgreSQL CI, including the new Chromium/WebKit browser step. Apply the two reviewed function-only migrations to the verified YNSG project, verify their names/definitions, merge the tested head into `codex/crm-workflow`, and verify the merge SHA on both Vercel production aliases. Rollback reference is baseline `59c2f2f6b2f0da12c08b3b13c379d5675e5a3608`; retain schema additions on an app rollback to preserve records and receipts.

Physical checks for Ed after deployment: use `/owner/practice` for portrait/landscape, iPhone keyboard open during a sample note, largest Dynamic Type and VoiceOver. Check a live request read-only for familiar contact/services/timing. Actual customer decisions and message delivery require Ed's real approved action and are never manufactured as QA. Broader product/provider/operations gates remain open; this is a scoped engineering release.

## Verified release evidence

[PR #160](https://github.com/edhemmer/YNSG/pull/160) merged the tested head `21c81115d3c520b27286768d932ea9b70aa0a1d9` as production commit `06a049418f4e7a912a67e2a358d6d4ea02bb40a1`. Both have tree `4ab78198532a07c1eab808523ee5e6f1094dbab0`, matching the reviewed local candidate.

[Exact-head CI run 39427334366](https://github.com/edhemmer/YNSG/actions/runs/39427334366) passed both required jobs. In addition to all 826 application tests and builds/audits, it passed **300** mobile layout/interaction cases across Chromium and WebKit, native HTTP/browser authentication checks with JavaScript enabled and disabled, native PostgreSQL lifecycle/concurrency/recovery, and native types/lint/SDK/bundle checks. No production customer mutation was used for those tests.

The verified YNSG project `jvigtwjlkmeyavzbxjzl` applied `decline_unconfirmed_quote` as history version `20261020131947` and `submitted_scheduling_review` as `20261020131958`. Read-only catalog verification found every reviewed change in its intended private function, with the existing definer/search-path properties retained. The migration-history map now records both observed names/versions as applied rather than leaving a prepared pending entry.

Production runtime deployments for merge `06a0494`: CRM `dpl_5mv1yB1yb4ousfuNjauqWfu17oag`; public site `dpl_Cd8XZ57CPSWm7GrbEGVzfUvwpsQe`. Final READY/alias and read-only live owner verification are recorded in the release-evidence PR. The follow-up evidence changes are non-runtime and must not trigger another application rebuild. Physical iPhone acceptance remains open as described above.
