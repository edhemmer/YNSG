# Expense and correction recovery acceptance — 15 October 2026

Scope: issue #32, WEB-08 and A11. Baseline production d1641d7425c9b5a0ae84db7220859b4d0f7515f7. Review active conversation, governance, engineering specification, completion register and current finance UI/API/canonical SQL first. Preserve brand/services/pricing, required contacts, optional accounts, private financial data and immutable history. No Stripe activation, paid services, MFA requirement or production financial mutations.

Pass/fail checklist:

- Define strict expense/reversal command and saved-receipt contracts before editing; retain canonical RPC authority and exact actor/input retry.
- Distinguish rejected input/access/business rule from unknown database/transport/malformed result. Unknown expense results return 503 and retain the exact body/key.
- Synchronous submit guard; one pending financial action; freeze editing/navigation while pending or uncertain; never let a new key hide an unresolved save. Rejected retry after uncertainty is not evidence the earlier attempt failed.
- Preserve unsaved paid-expense fields and correction reason during failed/current report refresh. Explicitly discard a draft before changing report range/page or competing financial action.
- Present selected correction with vendor, paid date and exact original amount; reversal preserves original evidence and does not send/refund money.
- Validate confirmed receipt; clear only its saved draft. A subsequent report failure cannot relabel a saved mutation uncertain or resubmit it. Block new financial entries until a fresh report reconciles the known save.
- Private validated read response and date/page bounds; ignore stale/old-company responses. Revoke/deny access without retaining cross-company data.
- Company-local dates; exact-cent arithmetic and CSV formula protection retained. Mark a retained report as stale and disable stale CSV after a failed refresh/save.
- Test lost response, duplicate submit, exact replay, definite rejection, refresh failure/draft retention, correction identity, competing draft, expired access and company switch in isolated fixtures; SQL proves retry/tenant/reversal integrity.
- Review complete workflow, contracts, generated OpenAPI, docs and tests; run full checks, native PostgreSQL CI, optimized build, tested-head merge and both live SHAs/read-only smoke. No live fake expenses/reversals.

This is scoped financial-entry hardening, not a whole-product completion claim. Remaining issue #32 forms stay tracked separately.
