# YNSG local SEO performance — nine-town scorecard

**Primary markets:** DeKalb, Sycamore, Cortland, Maple Park, Elburn, Lily Lake, Campton Hills, Geneva, St. Charles. Smaller neighboring towns remain welcome but are not separate campaign targets.

## Measurement rules

Measure **organic search** separately from Google Maps/Business Profile. Search Console query data is anonymized and incomplete: absence of a town query is *not* evidence of zero demand or ranking. Do not add made-up rankings, impressions, reviews or conversions. Never claim a town listing, separate office or established clients without evidence.

Once every 28 days, compare the trailing 28-day period against the preceding 28 days. Use Google Search Console → Performance → Search results → Web → Queries, then export CSV. Use the accompanying `scripts/target-market-scorecard.mjs` to group *visible query rows* by target town; separately review page impressions and clicks for /services and individual service URLs. Confirm the domain property and canonical URL are correct.

For each town review: impressions, clicks, average CTR, approximate average position (only when the export has that field), landing pages, and actual customer inquiries attributed to organic search when consented attribution exists. **Do not** imply Google Search Console query data identifies a customer's precise location. Segment by location words present in queries only.

## Action thresholds and next steps

- Low impressions: inspect indexing, content relevance, competing search intent and the geographic reach of the business profile. Don't promise ranking.
- Impressions but few clicks: improve truthful title/description wording based on the page's actual services; avoid keyword stuffing.
- Clicks but poor inquiries: test service-to-request links, mobile layout, phone links, request completion and response handling.
- Favor original job photos, useful seasonal guidance, genuine reviews and local citations; avoid near-duplicate town doorway pages.
- Review Google Business Profile service areas to reflect the priority towns, while using one legitimate business profile and no fabricated addresses.

## Data protection and release

Keep raw GSC exports private; do not commit them. Monitor the nine towns as marketing priorities, not route restrictions. SEO changes require passing the canonical, schema, sitemap, service-link and unrestricted-intake checks before release.
