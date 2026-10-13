# Stripe Production activation — private platform administration

Do not publish this setup guide on the customer site or place its environment-variable instructions in normal owner workflows. The authenticated Production Checks page reports configuration categories without returning credential values or account IDs.

## Current evidence

On October 12, the live owner payment check reported an unconfigured card connection. No charge, refund, bank transfer or invoice payment was created. A configured key is not proof of an enabled merchant, signed webhook, successful payment or bank settlement. Tax review remains a separate issuance requirement.

## One-time platform setup

1. Activate the intended US/USD Stripe business account. For Ed, map his organization to the account receiving his payments. For franchise owners, use separately onboarded Stripe connected accounts; never assign two organizations to the same settlement account.
2. Create a live restricted key for this CRM, using only the permissions required by the existing calls below. The adapter accepts `rk_live_` and existing `sk_live_` keys, but rejects sandbox and publishable keys. Keep keys server-side; enter values directly in Vercel, never chat. Use Stripe's request logs and permission errors to validate the exact resource permissions, including connected-account permissions if used.

| Existing operation | Access required |
| --- | --- |
| Retrieve the platform and assigned business account | Account read |
| Create, retrieve and expire Checkout Sessions | Checkout Session write (includes read) |
| Retrieve PaymentIntents and Charges | PaymentIntent and Charge read |
| Read actual BalanceTransactions | BalanceTransaction read |
| Read successful refunds for ledger reconciliation | Refund read |

The CRM does not require permission to create payouts or create refunds for these existing flows. Refunds made separately in Stripe are reconciled after their signed events.

3. Vercel → `ynsg-repo` → Settings → Environment Variables → **Production**:
   - `STRIPE_SECRET_KEY`: the live restricted key, or existing live secret key.
   - `STRIPE_WEBHOOK_SECRET`: the signing secret for the actual live webhook endpoint.
   - `STRIPE_MERCHANTS_JSON`: an organization-to-account mapping, for example `{"a933d657-14d3-46b6-85e6-21d973e4ed97":"acct_REPLACE_WITH_ED_ACCOUNT_ID"}`. Replace the example account ID with the actual Stripe account ID. It is not an API key.
   Existing `APP_ORIGIN`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required. Do not expose these secrets with client/public prefixes. Do not copy live payment credentials into Preview.
4. Stripe's live Webhooks/Workbench → add the snapshot-event destination `https://yourneighborhoodserviceguy.app/api/stripe/webhook`. Match the adapter's pinned version `2026-09-30.endive`. Subscribe to `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `refund.updated`, `charge.dispute.created` and `charge.dispute.closed`. Enable connected-account event delivery when using Connect. Copy this destination's signing secret into the Production variable above; a Stripe CLI testing secret is not this destination's secret.
5. Redeploy and run Production Checks → Check card connection. Syntax/presence checks identify missing or invalid categories. Only a successful live provider account response marks the merchant verified. This still does not verify webhook delivery or a customer payment.
6. Review actual tax treatment and customer-agreed invoice charges. Complete an expressly authorized payment acceptance run, then verify the signed webhook, exact gross/fee/net ledger, customer invoice and receipt, owner balance, and bank settlement. A redirect, sample email or manually marked test is not proof of collected card funds.

## Code and verification

The setup detector returns only allowlisted state labels: configured, missing, invalid or unassigned. It does not return secrets or mapped account IDs. Duplicate account assignments, malformed JSON, absent tenant mapping, sandbox keys, credential whitespace and invalid workspace origins keep card checkout blocked. Cross-tenant settlement isolation and the existing signed-webhook/payment reconciliation rules remain intact. The running-late email subject now reads `Your Neighborhood Service Guy — Arrival time update`; previously accepted sample messages are not silently resent.

Sources reviewed October 12: https://docs.stripe.com/keys ; https://docs.stripe.com/keys/restricted-api-keys ; https://docs.stripe.com/webhooks . Provider permissions must be checked against actual Stripe requests; this guide does not certify an untested key.
