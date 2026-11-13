# 07. SEO and growth

Last updated: November 13, 2026.

The detailed owner playbook is [`docs/production/local-seo-playbook.md`](../production/local-seo-playbook.md). This page is the map.

## What ships from the repo

- 24 public pages built from `site/pages/*.html` by `scripts/build.mjs`, with unique titles and descriptions, canonical URLs, a dated sitemap, LocalBusiness and service structured data, social previews, and a mobile call and request bar.
- `npm run verify:seo` (`scripts/check-seo.mjs`, `check-target-markets.mjs`, `check-local-seo.mjs`) fails the build if metadata, links, sitemap or schema break. Page URLs for services end in `-dekalb-il`. Two slugs (`/handyman-dekalb-il`, `/accessibility-home-safety-dekalb-il`) are candidates for renaming; that is an open decision ([08](08-open-decisions-and-roadmap.md)). If renamed, add redirects so existing links and rankings carry over.
- Real job photos on the home page ("On the job…") and service pages. Photo rules are in [05](05-design-brand-and-copy.md).
- The owner app has a **Marketing playbook** (12 months of seasonal posts, evergreen posts, review scripts, weekly routine) and a **Help center**. Content lives in `apps/web/lib/marketing-playbook.ts` and `help-articles.ts`, with tests that enforce the wording rules.

## What only the owner can do (cannot be coded)

1. Google Business Profile: claim, verify, service-area business, true hours, real photos weekly, ask every happy customer for a review the same day, reply to every review.
2. Google Search Console: verify the property, submit the sitemap, then use **URL Inspection, Request Indexing** for the home page and each service page. Indexing takes days to weeks; "Discovered, not indexed" is normal early on.
3. Bing Webmaster Tools and the Bing Places postcard verification.
4. Local listings with the exact same name, address-or-service-area and phone everywhere.

## How to judge progress

New reviews, calls and direction requests. Not profile views (your own searches inflate them early on). Use the tagged website link from the profile (`utm_source=google&utm_medium=organic&utm_campaign=gbp`) so analytics can separate profile visits.

## Growth levers already in the product

- Community Rate for seniors, veterans, single parents and neighbors with disabilities, with accessibility help as a distinct service.
- Seasonal services rotate on the home page (`site/seasonal-services.js`).
- Repeat-customer nudges and review requests are manual one-tap texts from the owner's own phone today. Automating them is on the roadmap ([08](08-open-decisions-and-roadmap.md)).
- Careers pages (`site/pages/careers*`) exist for recruiting help in season.
