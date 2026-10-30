# Production workflow and readability audit

Scope: the public website, Services → optional Time → Details handoff, owner review/scheduling/agreement/work/timers, invoice/receipt workflows, and existing customer/administration screens. The Owner network directory is a subsequent requested addition, not represented as included here.

## Readability findings and fixes

The first 44-case audit measured 2,100 visible text elements and found 12–13px utility labels. The expanded owner-shell audit also found inherited 11.67px “Received” labels, slightly weak calendar/address/date text, and dark-mode search placeholders below the 4.5:1 normal-text contrast target.

On-screen utility declarations below 14px were raised to at least 14px; print point-size rules were retained. The owner’s main text remains 18px at default settings and now uses a relative size for text scaling. Input controls are checked for a 16px minimum. Muted request/calendar labels were darkened on light surfaces; dark-mode placeholders now use an explicit readable color. Brand colors, logo, approved pricing and service boundaries are preserved.

`scripts/verify-readability.mjs` and `scripts/readability.mjs` provide a required browser CI check after the public build. The default run covers all 18 public pages, all three request stages, 11 owner workspace sections, and ten request states in both the workflow and detail view, at phone/desktop widths in both themes. It measures settled visible text, foreground/background contrast including alpha, font size, input size and placeholders. Disabled controls and deliberately clipped accessible labels are excluded; any text over images/gradients is recorded for visual review instead of assigning an invented background. The latest default run: **204 cases, 9,086 measured elements, zero findings**.

The task report was separately inspected through the actual development route with isolated sample responses: phone and desktop, light/dark, normal and 200% root text size. Eight checks measured 592 text elements with zero findings and no horizontal page overflow, including open time-review forms. This found and fixed an intrinsic-width issue in the task grid. Phone reports now use native heading/description-list cards; desktop retains the table, avoiding hidden-table-header overflow and keeping metrics understandable to assistive technology. Key numbers precede optional assistant and methodology detail.

## Connected workflow evidence

| Boundary | Evidence |
| --- | --- |
| Public browser → request | Photographic pages, complete trailer framing, three selected cleanout/door/lock jobs, Step 2 continuation, deliberate Edit jobs and arrange-time path passed at 390/1366 widths with zero submissions. Existing two-engine public checks also cover four widths, both themes and enlarged text. |
| Owner browser → task command | Actual report/timer components passed start → pause → review with isolated sample API responses at phone/desktop widths, no external calls and no console errors. |
| Command/recovery boundary | Executable schemas and API tests bind company/job/task/key/action/revision. Lost-response replay survives reload and permission denial. Independent review drafts retain their own original revisions; saving one cannot reset another or silently rebase stale edits. Native minute-only input normalization preserves original subsecond evidence. |
| API → canonical database | Offline SQL and native PostgreSQL cover approved scope, current authority, task switches, exact replay, stale revisions, overlapping corrections, month clipping, raw evidence retention, and bounded issued-labor allocation. No timer automatically changes an invoice. |
| Database → response | Bound receipts/read contracts are verified before UI confirmation. Connected YNSG rollout is recorded as migration history 20261030191815; private-table RLS/no client grants, guarded invoker wrappers, denied anonymous execution and timer trigger were inspected read-only. Security findings are unchanged. |
| Surrounding financial/customer flows | Required CI retains complete request-to-receipt, invoice/PDF, split cash/Zelle, corrections, privacy/recovery, customer account, permission, browser navigation and native-foundation checks. No existing test or audit is suppressed. |

The live production health check passed after the additive database rollout. Final exact-head CI, merge/deployment SHAs and read-only live smoke remain release requirements. Tests use synthetic data; real customer communications, bookings, work, invoices, receipts, provider delivery and physical-device acceptance are not fabricated. This audit is engineering evidence, not a full-product acceptance or accessibility certification claim.
