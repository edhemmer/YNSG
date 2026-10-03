# Paid invoice follow-up acceptance — October 3, 2026

Read the active conversation, governance amendments, canonical audit, payment transaction, mail authorization/leases, invoice document filtering and company configuration before editing.

- Confirmed payments only; exact integer cents; partial payments never trigger a paid message.
- One logical event per invoice and retry-safe payment commands; no historical automatic sends.
- Use immutable invoice recipient and approved business identity. Never infer an account from matching email.
- Keep Google consent, tested sender, explicit company activation and ambiguous-send reconciliation intact.
- Recheck full settlement and recipient at lease/send boundaries; invalid events are suppressed.
- Thank the customer without an invented promise. Optional review request only with an owner-enabled HTTPS URL; no incentive or positive-review filtering.
- No customer private notes, waiver reasons, payment references, recorded minutes or card/bank details in mail.
- Company review controls must be editable, clear and disabled during publishing.
- Prove partial/full/repeated payment, legacy exclusion, stale/invalid notices, tenant permission and template escaping in synthetic tests; run TypeScript and production build.
- Google later today remains owner-controlled. Real delivery and scheduled execution remain open until verified.

Checked: unit templates, synthetic payment and dispatch boundaries, legacy exclusion, repeat commands, cross-company denial, unknown sends, TypeScript and optimized build. Reviewed all changed sources and existing transaction/dispatcher context. Hosted verification and real Google delivery remain separate; no real emails sent.

Hosted YNSG migration applied; lease/send guards and denied anonymous/client helper execution verified. Enabled mail companies remain zero. Security advisor reports only the existing leaked-password protection warning; no new database findings.
