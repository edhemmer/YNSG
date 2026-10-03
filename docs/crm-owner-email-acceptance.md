# CRM owner request notification checklist — October 3, 2026

Before work: reviewed the active owner instructions, governance, full production audit, current Gmail dispatcher, MIME encoder and shared website formatter.

- Preserve authenticated company settings and tenant-bound request lookup.
- Retain every selected cross-category task; support legacy service/task submissions.
- Show customer/contact information before grouped work; include internal CRM request link and small request ID.
- Use company branding name, not a hardcoded tenant identity.
- Encode HTML and plain-text alternatives; escape customer HTML and prevent email-header injection.
- Reply-To is the customer's address only for owner request notifications.
- Preserve deterministic Message-ID, outbox lease, begin/finish delivery and no blind send retries.
- Do not enable Google, tenant mail or public CRM intake without consent and receipt verification.
- Do not send to real customers during development or store screenshot personal details in fixtures.
- Verify both MIME alternatives, header validation, formatter fallback and build all affected applications.

Live Gmail receipt and iPhone/dark-mode visual acceptance remain pending. Automated verification is not evidence of provider acceptance.
