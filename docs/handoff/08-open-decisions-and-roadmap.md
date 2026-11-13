# 08. Open decisions, roadmap and known gaps

Last updated: November 13, 2026. Update this page whenever one of these changes.

## Decisions only the owner can make

| Decision | State | Why it matters |
| --- | --- | --- |
| Card processor and fee disclosure (PNC merchant quote) | Waiting on the owner's quote | `STRIPE_MERCHANTS_JSON` is how merchants are configured; do not change payment behavior until this is settled. |
| Rename `/handyman-dekalb-il` and `/accessibility-home-safety-dekalb-il` | Undecided | Slugs affect SEO. Needs redirects if changed. |
| Publish the home care plan page | Off (`PUBLISH_HOME_CARE_PLAN`) | Turn on only after the owner confirms plan pricing. |
| Backup schedule for the database (Free plan has no automatic backups) | Not scheduled | Recovery bundle exists; a routine does not. |
| Vercel plan and commercial eligibility | Unconfirmed | Hobby is for non-commercial use. See the cost register. |
| Test-record purge | Waiting for the word "purge" | Never purge without it. |

## Owner to-do list (not code)

DMARC record and SPF/DKIM verification in Resend ([06](06-email-and-invoices.md)); Search Console indexing requests and Bing verification ([07](07-seo-and-growth.md)); Apple review and signing for the iOS app; merge open pull requests.

## Roadmap, in rough priority order

1. **Credit-aware card check.** Subtract applied credits when deciding whether a card payment is allowed (see known gaps).
2. **Automatic review requests and invoice reminders** (today they are manual one-tap texts and emails).
3. **First-load speed of the owner app.** The first open can be slow; investigate bundle size, server data fetching and cold starts (`docs/production/workspace-loading-optimization.md` has earlier work).
4. **Regenerate the Spanish ad images** (see gaps) and add a checked image-generation path in `marketing/tools/ad-generator`.
5. **iOS gates.** Apple signing, APNs, privacy declarations, account-deletion behavior, device testing and TestFlight, each separately evidenced. See `contracts/production-completion.json` (gate IOS) and `apps/mobile/AGENTS.md`.
6. **Scale gate.** Evidence for load, restore drills and operational limits (gate SCALE).

## Known gaps

- Card-payment balance check ignores credits (invoice with an unapplied credit could accept the pre-credit amount).
- Existing Spanish ad images still contain the removed "no trip charge" wording. The source and README are fixed; the images need regenerating.
- Supabase Free has no automatic backups and pauses on inactivity.
- Independent human security review of authentication, database permissions, financial transitions and push privacy is required before native distribution; AI review is not evidence.
- The owner-day card component `apps/web/app/owner-day.tsx` is no longer used by the Today screen; remove it when convenient.

## Recently changed (November 2026)

Today screen now has Today, Tomorrow and This week tabs and shows only today's visits plus items needing action. Home page gallery shows a variety of real jobs. Field guide has about 95 step-by-step DIY guides with browse by room, trade and topic, and as-you-type search. Email layout and 48-template library redesigned. Card payments decline when no balance remains.
