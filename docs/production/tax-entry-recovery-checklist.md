# Tax-entry recovery acceptance — 15 October 2026

Scope: #32 / WEB-08, baseline production 0c477cdd1e93a4a7aedc96e69387338a177518b3. Review active conversation, current governance/execution/specification, tax UI/API/schemas and canonical tax SQL first. Preserve approved brand/services/pricing, optional accounts, required contacts, reviewed rules and immutable invoices. No paid providers, Stripe activation, mandatory MFA, fabricated tax approval/payment or production mutation.

Pass/fail requirements:

- Define strict bounded tax command, saved receipt and read contracts before editing; generate OpenAPI. Preserve canonical `tax_command`, live company permission, exact profile version and actor/input retry.
- Separate known rejection from transport/database/malformed-response uncertainty; unknown saves return 503. One serialized body/key, synchronous duplicate guard, frozen edits/navigation and exact saved-result check.
- Never infer failure of an earlier unknown save from a rejected retry. Keep draft/context and provide safe access recovery.
- Preserve setup values, reviewed-rule draft/list, payment/deadline fields and reversal reason on failed or current-data refresh. Current-version changes cannot silently replace a dirty form; stale draft version must reject publication.
- One active draft family at a time; explicit discard or confirmed save before replacing it/year. New rule is local until reviewed setup is deliberately published. Pending rule edits cannot be silently omitted from publication.
- Known save remains saved if subsequent read fails. Clear only its acknowledged draft, keep separate stale/reconciliation state, and block another mutation/export until a verified fresh read.
- Replace blocking prompts with selected tax-record correction showing authority/period/date/amount and kept reason. Reversal sends/refunds no funds and preserves original history.
- Standalone Taxes has entry protection. Private validated reads hide data on access loss; old requests/unmounts cannot update another organization/year. Stale export is disabled; CSV formulas/exact-cent format retained.
- Estimator copy and Illinois labor aid remain explicit unreviewed draft actions. Do not alter rates/calculations, supported state/year, actual-owner review, URLs or tax-approval semantics. Local estimator input is protected from accidental navigation.
- Verify lost/malformed response, duplicate tap, identical replay, version conflict, dirty refresh, known-save/read-failure, correction identity, competing drafts, explicit discard and permission denial with isolated fixtures. Extend SQL replay/stale/tenant assertions as needed.
- Review entire deliverable and connected workflow; full release tests, native PostgreSQL CI, optimized build, tested-head merge, both deployed SHAs and live read-only smoke. No real tax records used as QA.

This is scoped entry/recovery hardening, not tax advice, filing, account debit or whole-product acceptance. Current owner and accountant review remains explicit.

## Implementation review

All scoped source requirements above are implemented. Review included the full tax screen, canonical SQL and existing estimator-to-publish flow. A legacy `{taxCents:0,components:[]}` invoice snapshot is explicitly accepted alongside pre-snapshot null and complete reviewed tax snapshots. A dirty estimate pins its original state and setup version across refreshed setup; copying it cannot silently adopt a newer revision while carrying older rules. No tax-rate/calculation changes, schema migration, provider activation or production financial mutation.

Isolated executable evidence: `tests/tax-entry-recovery-api.test.mjs`, `tests/tax-entry-recovery-ui.test.mjs`, existing `tests/income-estimator.test.mjs`, and extended `tests/taxes.sql`. Database assertions cover original payment receipt replay after newer setup, original profile receipt replay, changed-input conflicts and one append-only correction. Final exact-head CI, merge mapping, production SHAs and read-only results are recorded in the scoped PR/issue; those release observations must be completed before calling this delivery shipped. Broader WEB/IOS/SCALE acceptance remains governed by the completion register.
