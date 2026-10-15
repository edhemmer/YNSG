# Completion execution and release protocol

Authority: [charter](README.md). Register: [production-completion.json](../../contracts/production-completion.json). Product owner: Ed Hemmer. Dates in evidence use ISO 8601 with timezone; business appointments remain America/Chicago. Baseline reviewed 15 October 2026: production 56b0a9fec3f7c9e4664c2192c91564b9340b9584, [PR #28](https://github.com/edhemmer/YNSG/pull/28), [release checks](https://github.com/edhemmer/YNSG/actions/runs/38736654555). Both domains READY and read-only health passed at that checkpoint; 363 application tests and native PostgreSQL CI passed. This is engineering evidence, not full gate acceptance.

## Work sequence

1. **Inventory and freeze acceptance (WEB-01).** Read current source and original R01–R21 requirements. Build a feature-by-feature matrix with UI/API/SQL paths, actual implementation state, tests, known defects and acceptance case. Include all promised CRM functions, photos/private documents, delegates, corrections/reversals, route/weather/briefing, exports/deletion and integration settings. Do not replace this with a list of recently fixed components. Open missing work as GitHub issues with gate ID, severity, dependency, owner role and exact acceptance. No invented deadline or completion percentage.
2. **Close connected workflows (WEB-02–09).** Work vertically through customer intake, scheduling, owner visit, invoice/payment/document delivery, records/accounts, mail, reports and assistant. Complete each UI → API → database → response → user-next-action path and failure cases. Independent operations preparation, human-review scheduling and business account checks proceed while code is built.
3. **Accept experience and operations (WEB-10–15).** Measure device usability and performance; fix defects. Prove security, backups, alert receipt, rollback, actual settings/tax and local-search account ownership. Engineering prepares reviewable artifacts before asking Ed to approve or enter a credential. No repeated consent requests for already authorized actions.
4. **Owner acceptance and web decision (WEB-16–17).** Run the finite script with approved recipients and actual service/funds only where appropriate. Record failures as defects, fix and retest them plus affected paths. Close WEB-17 only after all other web gates pass for the candidate.
5. **Native and scale completion.** Continue IOS-01–08 after web acceptance and SCALE-01–03 for multi-company sale. Prepare non-distribution native work while web stabilizes; never call a JavaScript bundle device acceptance. Native and multi-company release claims remain distinct. No original promise is removed because it belongs to a later milestone.

## Per-session working contract

Before editing: reread active conversation, current source/governing docs, register and linked issue; create a pass/fail scope checklist including rejected choices. Select the next unblocked highest-impact gate. Assign a concrete issue to a named engineer when available; role placeholders are not evidence that a person has accepted responsibility.

During work: update gate to working, keep changes isolated, define contracts first, use canonical commands, preserve previous owner edits. Inspect the entire deliverable and connected flow, not only changed lines. Test permission, stale/concurrent save, interrupted response, replay and weak-network paths at consequential boundaries. Fix implementation before inviting owner acceptance. If an external dependency is blocked, record the precise missing action, safe prepared artifact and accountable role; continue independent work. Never silently substitute fake data, weaker acceptance or a new provider.

At handoff: report **gate/issue advanced → concrete shipped behavior → evidence → next unblocked action**. Include the small set of owner actions only when their prepared steps are ready. Do not end each session with the same generic list of caveats. Do not promise autonomous work between sessions or notifications unless an actual approved automation exists.

## Evidence record

For a verified gate, add an evidence object with `candidate`, `checkedAt`, `reviewer`, `url`, `result:"pass"`. Candidate is a full Git SHA. The linked record must include gate/case IDs, environment/device/build, actual result, defects/resolutions and reviewer. Private evidence stays access-restricted; do not publish contacts, messages, private IDs, tokens or financial rows. CI evidence may link GitHub Actions; provider/device/human gates need their own real records. Moving open → verified requires the listed acceptance, all dependencies verified and evidence review. Blocked requires a nonempty `blocker` describing the actual missing dependency; a verified status cannot retain a blocker.

No blanket automatic expiry is invented. Revalidate when affected code, schema, provider config, business rule, device build, security posture or current-year tax source changes. Carry-forward must itself be reviewed and tied to the new candidate. Reopen dependent gates if their relied-on evidence is invalidated.

## Engineering release versus product completion

Ordinary safe fixes remain releasable while completion gates are open: required CI, current checklist, intended target, PR, tested-head merge, migration verification and live SHA/smoke still apply. `completion:check` enforces register integrity in regular release checks; it does **not** assert readiness. `completion:gate` deliberately exits nonzero until the selected milestone's complete required gate set and candidate evidence pass. Do not weaken it to publish a completion claim.

Before a product completion decision:

- Run `npm run completion:check`, `npm run completion:report`, `npm run verify:release` and optimized website/CRM builds. Require both exact-head CI jobs, including native PostgreSQL; native distribution additionally requires `npm run verify:mobile` and the existing native evidence checker.
- Map tested PR head to production merge and deployed SHA. Candidate evidence must refer to the accepted release candidate; attach reviewed merge-tree/deployment mapping, and revalidate any material change. Verify intended team/projects, production branch `codex/crm-workflow`, both .com/.app aliases, migration names and provider configuration. Never deploy `main` by assumption.
- Run the milestone gate command with the candidate SHA. Record Ed's acceptance, engineering reviewer, operations handover and actual release/distribution decision. Machine checks do not confer Apple approval, legal certification or evidence authenticity.
- Monitor after release using the accepted operator/alert process. A new blocker/high defect pauses affected operations or triggers the safe rollback runbook, preserves records and reopens the relevant gate. No destructive down-migration or duplicate delivery path.

## Owner participation packet

Prepare one packet containing only currently actionable steps: sign in/consent where necessary; review actual company/tax settings; approve test recipients; run the phone script; choose backup/operator arrangements; confirm hosting eligibility and actual Apple account inputs when that milestone begins. Each step includes the exact screen/link, decision required and expected proof. Never ask for passwords/tokens in chat. Engineer-controlled implementation/testing should already be ready; a real dependency is the only reason to stop its dependent action.
