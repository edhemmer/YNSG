# Recovery and navigation review — 19 October 2026

Baseline: production merge c8541b67546b46d374f5005224d176424a6079a9, PRs #137–138. Scope advances WEB-06/10/11 and #32/#33. This is an engineering correction, not milestone certification.

## Pass/fail checklist before edits

- Late privacy reads must never replace a newer command result, receipt result, error or policy baseline. Only the latest eligible read may update the screen.
- Starting any command invalidates reads already in flight. Reload during a command must not start a competing read. Unknown attempts retain their exact body/key and navigation protection.
- Shared entry protection covers same-tab HTTPS navigation across origins and links that reload the current document. Hash navigation, explicit new tabs, downloads, modified clicks and phone/email links retain their existing behavior.
- Preserve drafts, deliberate confirmation, company permissions, receipt/session isolation and original financial evidence. No new provider, dependency, schema, rates, services, required MFA, Stripe or paid activation.
- Use synthetic delayed responses and navigation tests; review the complete affected components and their callers. Run full release checks, both optimized builds and exact-head PostgreSQL CI before merge, then verify deployment identities and read-only smoke.
- Keep native security findings, native authentication/sharing engineering and owner/provider/device/independent acceptance open. No completion percentage or certification inferred from passing tests.

Rejected choices: serializing reads behind stale results, clearing uncertain commands on reload, weakening navigation safety to allow reauthentication in the same tab, suppressing audits or marking unobserved acceptance as passed. No production records, messages or deletion actions for QA.

## Whole-flow review and local evidence

Reviewed the complete account/retention controls, shared entry provider, account/invoice/tax entry points, authenticated privacy route and session retry helper. Reads use monotonically increasing versions; command and receipt actions invalidate older reads before sending. Old successes and failures are ignored, including after effect cleanup. Refresh preserves an unresolved attempt's message and exact retry body. Policy drafts, original revision, current-owner denial, deliberate confirmation and cross-account cookie isolation remain intact.

The entry guard applies to same-window document navigation, including the current URL without a fragment. In-page fragments (including the empty fragment), explicit new tabs, downloads, modifier-key clicks and telephone/email links remain available. Browser refresh/close retains the existing native before-unload warning; this does not claim to prevent an explicit browser-level discard.

Local verification passed: 784 application tests, root/web typechecks, generated contract check, completion register integrity, synthetic PGlite lifecycle assertions, browser production dependency audit, all 11 public pages built and optimized CRM build. Four new behavioral regressions exercise delayed request/policy responses, out-of-order errors, and draft/uncertain navigation boundaries. Existing receipt, reauthentication, permissions, financial and draft tests also passed. No gate status changed; exact-head PostgreSQL CI and live release proof are recorded in the PR after execution.

Remaining work stays in the controlling register: native authentication handoff/sharing, unresolved native dependency advisories, Google Maps site authorization, real owner/legal retention publication, provider/device/independent acceptance and operational handover. No new acceptance claim is made for these items.
