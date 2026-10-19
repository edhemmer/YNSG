# Screen review — responsive layouts and failure states

Scope: current YNSG source on `fix/mobile-routes-money`, continuing local commit de80310. Production baseline inspected read-only: c1d0c5501d9eee08e040f7596d53cdcafb42cbc0. No production records, settings, messages or payments were changed. Publication remains blocked by the preceding automatic approval review; this is engineering evidence, not a deployed or whole-product acceptance claim.

## Review checklist

- Preserve pricing, service scope, approved brand/copy, customer records and existing payment recovery behavior.
- Inventory public pages, all App Router entry routes, owner navigation sections and shared customer/workflow components.
- Check page overflow and control containment at 320, 393, 768 and 1366 CSS pixels, light/dark workspace appearance and a 200% body-font stress case.
- Exercise six populated synthetic workflow states and customer/mileage screens; distinguish unavailable data from a successful empty read.
- Retain keyboard focus indicators and touch controls; preserve deliberate financial and scheduling actions.
- Review surrounding screens after shared CSS changes; run the complete release command and optimized build.
- Keep actual Maps configuration, physical Safari/VoiceOver, full customer/provider lifecycle and release/CI checks separate from synthetic browser measurements.

## Findings repaired

| Area | Confirmed defect | Resulting behavior |
| --- | --- | --- |
| Shared forms | Native fieldset/input sizing could extend beyond narrow owner, account and practice cards. Previous date repair applied only within the company workspace. | Shared containment and native date/time sizing protect these screen families and public request forms. |
| Platform owner accounts | No explicit loading/empty state, no failed-read retry, and old paging availability during a new read. | Explicit loading, successful empty result, retry and disabled paging during loading/errors. |
| Route calendar | Failed counts retained “loading visits” in day labels. Selected style lost specificity to workspace/theme button rules. | Failed counts are described as unavailable; day selection remains usable and its selected contrast is explicit. |
| Maps | Live browser console reported RefererNotAllowedMapError for the `.app` owner route. Owner page metadata still declared no-referrer, overriding the previous global header repair. | Owner metadata now permits origin-only HTTPS cross-site referrers, with no private path/query. Existing pending map failure/timeout repair remains included. Actual allowed-site configuration and live successful rendering still require verification. |
| Workflow steps | Four narrow columns made Confirm/Complete/Invoice/Close out labels wrap vertically. | Two columns on small screens retain readable controls. |
| Working status | A no-wrap status badge widened the 320px workflow to approximately 363px. | Work status wraps within its card. |
| Tablet owner header | Long company name plus header actions widened a 768px viewport to 974px. | Context shrinks, ancillary text/actions collapse at tablet widths and icon controls remain accessible. |
| Public header | The unbroken full appointment CTA widened all public pages to 370px at 320px viewport. | The CTA wraps, header flex items shrink and the logo scales within its mobile range. Approved CTA wording remains intact. |
| Home hero | No-wrap hero buttons exceeded the narrow content column. | Hero buttons wrap naturally. |
| Franchise page | Intrinsic grid columns and long CTA widened 393px viewport to approximately 407px. | Shrinkable grid tracks and children keep text/buttons inside the page. |

## Coverage and evidence boundaries

Live read-only desktop inspection covered Today, Requests, connected job workflow, Calendar, Day routes, Jobs, Invoices & money, Customers, Reports, Field guide, Activity & messages, Settings/integration sections and customer-account empty state. No new uncaught application error was observed in those inspected states; the Maps provider error was positively identified. This does not certify every record, state, permission, provider or mutation.

Local browser entry checks covered `/owner/practice`, `/account`, `/owner`, `/platform`, `/invoice`, `/request/manage`, `/sample/request`, `/owner/taxes`, `/owner/production-check` at four widths and two workspace themes: 72 cases. Root workspace sections and the Google setup redirect were also inspected in source; authenticated owner sections are exercised separately with isolated synthetic session/workspace responses and child-provider failures.

Expanded browser cases cover all eleven owner sections, six populated practice workflow states, practice customer/mileage entry screens and eleven built public pages (home, services, service area, pricing, about, request, franchise, privacy, terms, accessibility and service agreement). Tests block API access with synthetic responses; they never copy live customer records. Public pages do not have a separate dark theme, so those repeated public runs are layout repetitions, not a claim of public dark-mode support. Body-font stress is not full browser zoom or physical dynamic-text acceptance.

The platform recovery and failed calendar-label cases have behavioral interaction regressions. Metadata regression checks cover both the global header and owner-page override. Existing application tests remain required for all canonical state transitions.

## Remaining checks

- Publish approved changes, obtain exact-head CI including native PostgreSQL, merge and verify deployed SHA and read-only live smoke.
- Recheck Google Maps after deployment. If RefererNotAllowedMapError persists, review the browser key allowed sites for `https://yourneighborhoodserviceguy.app/*` and any actually served www origin in Google Cloud. Do not remove key restrictions or enable paid services. Vercel environment metadata access returned 403 in the preceding turn.
- Physical iPhone/Safari date controls, rotation/keyboard, 200% browser zoom/dynamic text and VoiceOver acceptance.
- Actual provider delivery, permission and complete owner/customer transaction acceptance stay under the existing production gates. No gate is closed by a CSS audit.

## Recorded verification

The final [synthetic browser results](../evidence/screen-review-2026-10-19.json) retain 72 entry cases and 262 expanded cases (334 total), with zero measured page/control overflow or uncaught JavaScript failures in the tested states. Eight franchise cases were rerun after the final franchise-only font repair; other expanded results were carried forward because that stylesheet is loaded only on the franchise page. The earlier 48 repeated failures reduced to four franchise cases, then zero; they represented shared causes rather than 48 independent bugs.

`npm run verify:release` passed with 703 application tests, root/web typechecks, generated API contracts, completion-register integrity, database assertions in PGlite and production dependency audit. The optimized Next.js build and public build passed. Native PostgreSQL CI and production deployment have not been run for this local candidate. No full-product, all-state or physical-device pass is asserted.

After the final workflow icon/text spacing adjustment, all 48 populated workflow cases were rerun and the 320px step-bar capture was visually reviewed. No measured overflow remained. The optimized Next.js build passed after this stylesheet-only adjustment; the preceding 703-test suite result carries forward because executable behavior was unchanged.
