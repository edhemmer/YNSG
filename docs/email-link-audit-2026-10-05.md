# Email link and wording audit — October 5, 2026

Internal engineering document; not a public website page.

## Requirements and acceptance

- PASS (source and tests): owner notifications open `/owner` with validated request and organization navigation hints; no Vercel dashboard destinations or bypass secrets in mail links.
- PASS (source and tests): email-link and Google sign-in preserve owner request context in an HttpOnly, expiring cookie. Arbitrary return destinations are rejected.
- PASS (source and tests): visible Request ID footer removed from HTML and plain text. Record IDs in authenticated navigation are not authorization credentials.
- PASS (source and tests): all seven appointment notification variants carry the intended owner or customer action links. Customer links use a scoped token in the URL fragment; opening a link does not mutate an appointment.
- PASS (source and tests): call, reply and address actions contain the intended phone, email and correctly encoded address.
- PASS (review): request receipts, approval/decline, reminders, invoices, paid thank-you/review requests and connection-test templates reviewed for readable wording, configurable signature and escaped customer content. Invoice references are retained.
- PASS (source and tests): local reschedule preference and appointment time display preserve local date/time. Appointment times include CST/CDT as applicable.
- PASS (local verification): 129 CRM tests, 13 public website tests, web TypeScript checking and Next production build.
- PASS (live before CRM deployment): main branch signed availability client is deployed; public availability still returns times.
- PASS (live, connector): CRM deployment 7e94843 is READY on the existing branch alias. Public website availability returns HTTP 200 after the CRM signature requirement; unsigned CRM availability returns 401. Anonymous owner workspace API returns 401. Customer appointment management page returns 200 without a token and does not disclose a request. Connector HTTP tests use hosting bypass and do not prove recipient hosting access.
- PASS (hosting, October 5 follow-up): after explicit approval, added exactly one Deployment Protection Exception for `ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app`. The dashboard lists that domain only; project Vercel Authentication remains enabled with `all_except_custom_domains`. Project-wide removal was not applied.
- PASS (direct HTTP, no hosting bypass and no application cookies): `/owner` returns 200 with the Owner sign-in page and no Vercel login redirect; `/api/workspace` returns 401 with “Sign in to continue”; unsigned `/api/public-availability` returns 401.
- PENDING (owner acceptance): click a new notification from iPhone Mail, complete business sign-in and confirm the selected request opens. Real customer confirmation/reschedule mutations are not performed during this audit.

## Hosting correction and protection

The CRM project applies Vercel Authentication to branch aliases, with only the email-link app address exempted after owner approval. The application sign-in page is appropriate for recipients; a Vercel account screen is not. Preserve application authentication, organization membership/RLS checks and worker secrets. Deploy signed availability client first, then require the signature in the CRM availability route before changing the outer hosting restriction. The signature is short lived and remains between servers; it is never sent in an email link or browser response.

Existing emails cannot be rewritten after delivery. Their root request links remain supported by the workspace; new messages use the explicit owner route and revised content. No real customer messages are resent during this change.

## SaaS access requirement

Business owners and customers must never require Vercel, GitHub or Supabase accounts. Hosting is operated by Inlight AI. Future SaaS rollout uses a canonical branded app domain, app authentication, tenant membership/RLS and company branding/configuration; owners connect their own Google account through the app. This domain exception addresses current recipient access and does not constitute completion of SaaS onboarding, subscriptions or multi-company production acceptance. Keep preview deployments protected. Do not embed infrastructure bypass credentials in customer or owner links.
