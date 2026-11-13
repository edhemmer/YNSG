# 06. Email and invoices

Last updated: November 13, 2026.

## Where the code is

| File | Job |
| --- | --- |
| `lib/email-layout.js` (+ `.d.ts`) | The shared branded layout: `emailLayout`, `emailCallout`, `emailButton`, `emailSignedText`, `YNSG_EMAIL_IDENTITY`. HTML email layout built with tables for broad mail-client support. |
| `lib/transactional-email.js` | Sends through Resend as HTML plus plain text with `reply_to`. |
| `apps/web/lib/email-templates.ts` | The owner's template library (`emailTemplateGroups`, `emailTemplates`, `templateDraft`, `brandedEmailHtml`). |
| `apps/web/lib/invoice-message.ts` | The invoice email body: status pill, totals, pay button. |
| `apps/web/lib/invoice-pdf.ts` | The invoice PDF (pdf-lib with DejaVu fonts): green and gold top bar, thank-you footer. |
| `apps/web/app/api/stripe/checkout/route.ts` | Card checkout. Declines when no balance remains (see below). |

## Template library

48 templates in 8 groups: Personal follow-up, Visit planning, Quotes and payments, Thank you and feedback, Reviews and referrals, Seasonal services, Stay in touch, Holidays. The owner picks one in the app, edits the text, and sends from his own address. Nothing is sent until he taps send.

Test constraints (`tests/email-templates.test.ts`): bodies longer than 120 characters and no "guaranteed", "limited availability" or similar pressure language.

## Deliverability (reducing spam placement)

Done in code: a plain-text part alongside the HTML, a `reply_to` address, one clear call-to-action per message, and no pressure language (enforced by tests).

Owner actions in DNS and Resend (cannot be done in code):

1. Verify the sending domain in Resend so it publishes **SPF** and **DKIM** records. Confirm both show "Verified".
2. Publish a **DMARC** record at `_dmarc.<domain>`. Start with `p=none` and a reporting address, review reports for a few weeks, then tighten to `quarantine`.
3. Send from the same domain that is verified. Mismatched From and Return-Path domains hurt placement.
4. Keep a real person monitoring the reply address.
5. Do not send to purchased or stale lists. Customers asked for the service; keep it that way.

## Invoice behavior

- Invoice math (subtotal, tax, credits, balance) is database and deterministic code. Issued snapshots are retained evidence; corrections need an explicit audited command.
- **Cash logged, then customer clicks the emailed pay button:** the checkout route calls `private.prepare_card_payment`. If the payment would exceed the remaining balance it raises `OVERPAYMENT_REQUIRES_REVIEW`; the route returns HTTP 409 `NO_BALANCE` and the button shows "This invoice has no remaining balance" and reloads. Logging a payment (`record_payment`) is also blocked while a card order is prepared or open.
- **Known gap:** credits are not subtracted in the card-payment balance check. An invoice with an unapplied credit could still let a customer pay the pre-credit amount. Listed in [08](08-open-decisions-and-roadmap.md).
- The emailed pay link is the same page as the app's invoice page, so a stale email cannot overcharge; it just shows the current state.

## Changing email design safely

Edit `lib/email-layout.js` and render a sample to a file, then open it in a browser and at 390 px width. Check dark mode: do not rely on background colors alone for contrast. Run the email tests in `tests/` before pushing.
