# Marketing list, Service Saturday and email opt-outs

## What's in the marketing list

Everything lives in one table, `marketing_contacts` (one row per email):

| Who | How they get there | `basis` |
|---|---|---|
| Service Saturday and other promotions | Entry form (they check "Email me…") | `opt_in` |
| Website leads, including declined requests | Automatic from the CRM | `lead` |
| Current clients (have an invoice) | Automatic from the CRM | `customer` |
| Anyone who unsubscribes and wasn't already on the list | Unsubscribe page | `suppressed` |

The **ready-to-email list** is the view `marketing_mailing_list`. It only ever shows people who are currently subscribed.

**To export for an email campaign:** CRM → Marketing → **Download email list (CSV)**.

Service Saturday entries (stories, nominee details) are in `campaign_entries`.

## Opt-out rules (CAN-SPAM). These apply to every marketing email

1. **Always export a fresh list right before each send.** The export only contains people who haven't opted out.
2. **Every marketing email needs:**
   - an unsubscribe link, either `https://www.yourneighborhoodserviceguy.com/unsubscribe/` or the personal one-click link `https://www.yourneighborhoodserviceguy.com/unsubscribe/?t=` followed by that person's `unsubscribe_token` from the export
   - **the business mailing address: 298 Quinlan Ave, DeKalb, IL 60115** (required by law; stored as `businessIdentity.mailingAddress`)
   - an honest "From" name and subject line, and clear identification that the email is an ad or offer
3. **Honor opt-outs right away** (the law allows up to 10 business days). If someone replies "unsubscribe" or asks by phone, enter their email on the Unsubscribe page yourself.
4. Never sell or share the list, and never re-add someone who opted out. The database blocks this: only a brand-new, explicit sign-up re-subscribes an address.
5. Job emails (confirmations, invoices) aren't marketing and keep going to people who opted out.

**Suggested email footer**

> Your Neighborhood Service Guy LLC · 298 Quinlan Ave, DeKalb, IL 60115
> You're receiving this because you requested service from us or signed up on our website.
> [Unsubscribe](https://www.yourneighborhoodserviceguy.com/unsubscribe/)

## Turning Service Saturday on and off

Edit `site/data/service-saturday.js` (works from the GitHub app):

- **Off:** `open: false`, then commit. The page, home banner and footer link disappear, the page leaves Google's sitemap, and old links show a friendly "not running right now" page.
- **On / next one:** set new dates, a new `campaign` name (for example `service-saturday-2027-03`), and `open: true`.
- Entries close automatically at 11:59 PM Central on `entryDeadline`, even if you forget to switch it off. The home banner hides itself the next morning.
- **Minimum entries:** `minimumEntries` (35 for January 2027). The drawing happens only once that many eligible entries are in; the Official Rules say so, and the CRM keeps **Draw winner** locked (the API also refuses) until the minimum is reached.
- **If entries close short:** move `entryDeadline`, `drawingDate` and `serviceDate` forward two weeks (the service date must stay a Saturday) and commit; keep the same `campaign` so entries stay in. Do this until the minimum is reached or `finalEntryDate` (March 28, 2027) passes. After that, switch it off and email entrants that it ended without a drawing.
- **Current event:** `service-saturday-2027-01`: entries close Sunday, January 17, drawing Tuesday, January 19, service Saturday, January 23, 2027.

## Status and setup

- **Database:** applied to production on November 17, 2026 (`marketing_list_and_campaign_entries`).
- **Website saving:** on by default once this code is live. To pause it, set `MARKETING_LIST_ENABLED=false` on the website Vercel project; entries and opt-outs are then emailed to info@ instead.
- **Automatic leads and clients:** switch this on from **CRM → Marketing → Email list → Start adding them** once the new Privacy Notice is live on the website. Only people who contact you after that moment are added.

## Using it day to day (CRM → Marketing)

- **Email list:** see how many people you can email, by source, and how many opted out.
- **Download email list (CSV):** import into your email tool (MailerLite, Mailchimp, Brevo and others accept this format). It contains only subscribed people, split into first and last name, with each person's one-click unsubscribe link. Download a fresh copy before every send.
- **Giveaways:** every entry with the story and work address, and how many of the required entries are in. **Draw winner** (unlocked at the minimum) picks one entry at random and records it (date, who drew, how many were eligible). If the winner can't be reached or declines, **Draw an alternate**; earlier winners are never picked again.

## Before purging test data

Test entries can end up in `marketing_contacts` and `campaign_entries` once the feed is on. When you purge the test CRM data, also clear those test rows.
