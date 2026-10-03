# Website-to-CRM intake acceptance — October 3, 2026

This connection is implemented behind a server-side release switch. It is not active until the owner company, catalog, notification sender and recurring worker have passed live tests.

| Required behavior | Acceptance |
|---|---|
| Name, address, phone, email and selections | Validated before any provider call |
| Multi-category requests | All selections retained in original submission and request item rows |
| Company binding | Server environment only; customer cannot select a tenant |
| Retry after network failure | Same request key and payload; one durable request, audit event and owner notification intent |
| Edited retry | New key; changed payload under an existing key rejected |
| CRM failure | No email-only success fallback; retain form and allow safe retry |
| CRM commit | Return saved request ID; notification delivery proceeds from durable outbox |
| Email-only transition | Existing Resend recipient and exact subject retained; provider retry key added |
| Privacy | Secret keys server-only; HMAC client-IP digest; no contact details in logs or browser storage |
| Scheduling | A request does not promise an appointment or silently reserve unverified capacity |
| Activation | Verify dashboard request, all selected items and owner backup email before public release |

## Exact public website variables

Set these in the public `ynsg` project's Production environment, not merely the CRM project's Preview environment:

- `CRM_INTAKE_ENABLED=true` — release switch; leave unset until connection acceptance passes.
- `CRM_ORGANIZATION_ID` — the company UUID created by the owner's verified invitation claim. It does not exist before that claim.
- `SUPABASE_URL` — the existing YNSG project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — existing YNSG server-only service role key; never a NEXT_PUBLIC value.
- `CRM_INTAKE_HASH_KEY` — independently generated secret of at least 32 characters for the privacy-preserving abuse-control digest.

`RESEND_API_KEY` stays in place for the existing email-only mode. Once CRM mode is active, owner email uses the existing CRM outbox/Gmail dispatcher; that dispatcher must be connected, receipt-authorized and triggered independently of an open browser first.

## Live release test

Create the owner company and publish reviewed catalog/settings. Connect Google and verify Gmail receipt; configure and test the recurring notification trigger. Then test CRM intake on an isolated preview configured for the real owner company using explicitly designated test contact details. Confirm one dashboard record, every selected service, one owner email with subject Your Neighborhood Service Guy New Request, and no duplicate on identical retry. Exercise provider failure and verify the form preserves input, the outbox retains unsent intent, and retry does not create a second request. Only then enable the public Production switch and redeploy.

Resend retry keys expire after 24 hours; they do not replace durable CRM command receipts. No existing submissions are retrospectively imported or automatically matched to an account by email.

## Automated evidence

48 unit tests passed. Bridge tests cover retained multi-category selections, stable private abuse-control digest, server tenant binding, invalid setup, provider outages, validation/rate/conflict statuses, malformed success rejection, unchanged legacy email payload/retry key, and no email-only fallback on CRM failure. Website syntax/type checks and nine-page build passed. Existing database suites already prove one request, all items and one outbox intent after retries. Public activation and actual owner email receipt are still pending.
