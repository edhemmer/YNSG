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

**To export for an email campaign:** Supabase → Table Editor → `marketing_mailing_list` → Export → CSV.

Service Saturday entries (stories, nominee details) are in `campaign_entries`.

## Opt-out rules (CAN-SPAM). These apply to every marketing email

1. **Always export a fresh list right before each send.** The export only contains people who haven't opted out.
2. **Every marketing email needs:**
   - an unsubscribe link, either `https://www.yourneighborhoodserviceguy.com/unsubscribe/` or the personal one-click link `https://www.yourneighborhoodserviceguy.com/unsubscribe/?t=` followed by that person's `unsubscribe_token` from the export
   - **a physical mailing address** for the business (a street address, a USPS PO box, or a private mailbox; required by law)
   - an honest "From" name and subject line, and clear identification that the email is an ad or offer
3. **Honor opt-outs right away** (the law allows up to 10 business days). If someone replies "unsubscribe" or asks by phone, enter their email on the Unsubscribe page yourself.
4. Never sell or share the list, and never re-add someone who opted out. The database blocks this: only a brand-new, explicit sign-up re-subscribes an address.
5. Job emails (confirmations, invoices) aren't marketing and keep going to people who opted out.

**Suggested email footer**

> Your Neighborhood Service Guy LLC · [mailing address] · DeKalb, IL
> You're receiving this because you requested service from us or signed up on our website.
> [Unsubscribe](https://www.yourneighborhoodserviceguy.com/unsubscribe/)

## Turning Service Saturday on and off

Edit `site/data/service-saturday.js` (works from the GitHub app):

- **Off:** `open: false`, then commit. The page, home banner and footer link disappear, the page leaves Google's sitemap, and old links show a friendly "not running right now" page.
- **On / next one:** set new dates, a new `campaign` name (for example `service-saturday-2027-03`), and `open: true`.
- Entries close automatically at 11:59 PM Central on `entryDeadline`, even if you forget to switch it off. The home banner hides itself the next morning.

## One-time setup (database)

1. **Apply the database change:** in Supabase → SQL Editor, paste and run `supabase/migrations/20261117120000_marketing_list_and_campaign_entries.sql`. (Or ask Claude to apply it.)
2. **Switch the website to save entries:** in Vercel → the website project → Settings → Environment Variables, add `MARKETING_LIST_ENABLED` = `true`, then redeploy. Until this is on, every entry and unsubscribe request is emailed to info@ instead, so nothing is lost.
3. **Turn on the automatic CRM feed** (leads and clients) once the new Privacy Notice is live on the website:

   ```sql
   insert into private.marketing_settings(organization_id, crm_feed_starts_at)
   select id, now() from public.organizations
   on conflict (organization_id) do update set crm_feed_starts_at = excluded.crm_feed_starts_at;
   ```

   Only customers created **after** this moment are added, because people who wrote in earlier were told they wouldn't be added without permission. (All current CRM records are test data anyway.)

## Before purging test data

Test entries can end up in `marketing_contacts` and `campaign_entries` once the feed is on. When you purge the test CRM data, also clear those test rows.
