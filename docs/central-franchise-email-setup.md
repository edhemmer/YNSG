# Central franchise email — private platform setup

This document is for platform administration. Do not publish it on the customer website or include its technical content in customer email templates or owner-facing error messages.

## Operating model

The CRM owns appointment capacity; Google, Outlook and Apple calendar viewing is optional. Every organization retains its own approved owner notification and customer reply addresses. One platform-managed Resend credential and verified sender can serve all organizations, with tenant-specific outbox permissions, recipients, content, audit events and idempotency keys. No per-owner Hostinger mailbox, Resend account or environment-variable setup is required. Optional corporate correspondence uses a separate mailbox; customer email replies use Reply-To to the local owner’s existing inbox. Replies are not yet ingested into CRM conversation threads.

Central email runs directly from CRM project `ynsg-repo`; it no longer needs each franchise website to relay its messages. Existing approved website-relay transports remain compatible. New verification uses the central transport. Sending requires an accepted owner test and the existing live session and membership checks. Changing approved owner contacts or the central sender invalidates readiness. Pausing notifications disables both independent and previously approved Gmail delivery; pending work remains saved. In-flight provider outcomes can still be recorded. Uncertain sends are retained for reconciliation rather than blindly resent.

## One-time configuration for Ed

1. Resend → Domains → Add domain: `notify.yourneighborhoodserviceguy.app`. Enable sending. Add the exact DNS records Resend supplies in Hostinger’s DNS Zone Editor for `yourneighborhoodserviceguy.app` (if Hostinger is the authoritative DNS provider). Enter full or relative hostnames as that editor requires, without duplicating the domain suffix. Use the supplied values verbatim. Do not replace the root domain’s existing mailbox MX records. Wait until Resend marks the sending domain verified. DNS propagation is not instant and no fixed completion time is promised.
2. Resend → API Keys: use a sending-access key authorized for that domain. Enter it directly into Vercel, never chat. Existing keys can be reused only if they authorize the selected sending domain.
3. Vercel → project `ynsg-repo` → Settings → Environment Variables. Set these on Production, and Preview if preview emails are required:
   - `RESEND_API_KEY`: the sending-access key (secret).
   - `TRANSACTIONAL_EMAIL_FROM`: `Your Neighborhood Service Guy <notifications@notify.yourneighborhoodserviceguy.app>`.
   Neither variable may use a public/client prefix. These belong to the CRM project, not only the website project `ynsg`.
4. Redeploy `ynsg-repo` from `codex/crm-workflow` so the variables apply. Keep its `.app` Production domain assignment.
5. CRM Settings → Your calendar & notifications → Verify business email. This sends one test to the configured owner inbox, with the owner’s customer reply email. Confirm it arrives and check Reply-To. Provider acceptance and actual inbox receipt are different outcomes.
6. Sample invoices and email checks → current sample set → Email the sample set to me. Check all 15 individual acceptance results and actual inbox receipt. Then verify two isolated owner organizations have the correct recipients/reply addresses, app-closed worker delivery, bounce handling, pause behavior and a real preferred-calendar subscription before franchise launch. No real customer mail or financial transaction is created by the local fixtures.

A Hostinger corporate mailbox such as `support@yourneighborhoodserviceguy.app` is optional and separate from automated sending. No mailbox is required at the automated notification address. Direct customer replies route to the owner’s saved reply address. Incoming customer replies are not automatically captured by the CRM in this release.

## Acceptance checklist

- CRM calendar remains independent of email/Google setup; preserve existing appointment and finance rules.
- Central sender is controlled by private platform environment, not owner input or customer payload.
- Different owners share a sender without sharing recipients, permissions or message idempotency identities.
- Customer-facing pages, templates and error messages contain no environment-variable instructions, credentials or deployment details.
- Local unit tests cover shared sender and distinct replies; database tests cover owner/session gating, worker claim/begin/finish, pause, revocation and cross-tenant denial.
- Live sender activation and actual Ed inbox receipt were verified on October 12, 2026. Two-owner live delivery, full franchise onboarding and other acceptance gates remain unverified. Do not claim those gates passed from mocked provider results.

References: https://resend.com/docs/dashboard/domains/introduction ; https://resend.com/docs/api-reference/emails/send-email ; https://vercel.com/docs/environment-variables

Implementation evidence on October 12, 2026: the original 236 unit/template/security tests and local PostgreSQL migration assertions passed. The live central sender was subsequently activated for Ed through an authenticated owner test. Gmail receipt independently confirmed SPF, DKIM and DMARC passes and the correct owner Reply-To. Suite `4fb08034-b18e-4a14-aa1d-03ca54d4ef36` recorded all 15 samples accepted; 14 suite messages were confirmed in Ed's inbox, plus the separate activation test. The running-late sample is provider-accepted but inbox receipt remains unconfirmed; do not blindly resend it.

The live sample test exposed `INVALID_ATTACHMENT`: the MIME validator permitted only legacy numeric invoice filenames. Commit `52cd1d2db59590382cbad80464f74d0bfddff85c` adds narrowly validated monthly invoice and clearly marked sample PDF filenames while preserving path/header injection, PDF magic-byte and size checks. All 238 tests and web TypeScript checks passed, and the CRM Production deployment was READY. The actual received invoice attachment was downloaded and visually reviewed: approved logo, number `202610-0001`, $120 sample total, $0 confirmed payments, clear NOT A BILL marking and one-page rendering. No real invoice or payment was created. Customer sample reschedule links opened without a CRM login. This evidence does not certify real-payment processing, every real customer action, inbound reply ingestion or full franchise readiness.
