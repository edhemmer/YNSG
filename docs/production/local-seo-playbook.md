# Local SEO and Google Business Profile playbook

Owner actions that cannot be done in code, in priority order. Website technical SEO (titles, descriptions, canonical URLs,
sitemap with dates, structured data, social previews, mobile call/request bar) ships from this repository.
Source for profile rules: Google Business Profile content policy and Google's LocalBusiness structured-data guide.

## 1. Google Business Profile (the biggest lever)

1. **Claim and verify** the profile at business.google.com. An unverified profile is barely shown.
2. **Name** exactly as used on the website, truck, invoices and cards. No taglines, phone numbers or keywords in the name.
   Pick one form ("Your Neighborhood Service Guy") and use it everywhere.
3. **Service-area business.** With no storefront, hide the street address and list the service area: DeKalb, Sycamore,
   Cortland, Maple Park, Elburn, Lily Lake, Campton Hills, Geneva, St. Charles. Keep it within about two hours' driving time.
4. **Categories.** One most-specific primary category for the work that earns the most (for example lawn care or handyman),
   then only a few secondary ones. Google asks: "This business IS a ...", not "HAS a ...". Do not list every service as a category.
5. **Phone and links.** Phone 815-680-1775 exactly as on the site. Website link: `https://www.yourneighborhoodserviceguy.com/?utm_source=google&utm_medium=organic&utm_campaign=gbp`
   (the tag lets analytics separate profile visits from everything else). Appointment link: `https://www.yourneighborhoodserviceguy.com/request/`.
6. **Hours** that are true. **Services** list with a short plain description for each (no promotions, prices or links in the description).
7. **Photos**: real jobs, before/after, the team in uniform, truck, logo. Add a few every week; stock images do not help.
8. **Reviews**: ask every happy customer the same day with your direct review link. Reply to every review. Never pay for
   reviews or filter who may leave one. Reviews are the strongest local ranking signal you control.
9. **Posts**: one a week, seasonal (leaves, snow, mulch, mowing). Offers and updates, not ads in the description.

## 2. Why the profile only shows "us visiting"

Insights are tiny until the profile is verified, complete and has reviews, and your own searches and clicks are a large share of
a small number. Search for the business less from your own devices, rely on the tagged website link (above) and Search Console,
and judge progress by *new reviews, calls and direction requests*, not views.

## 3. Search Console, Bing and measurement (all free)

- Google Search Console: add `www.yourneighborhoodserviceguy.com` (DNS or HTML-tag verification), submit `/sitemap.xml`,
  check Pages and Core Web Vitals monthly.
- Bing Webmaster Tools and Bing Places (feeds Apple Maps and several assistants): import from Google.
- Apple Business Connect: claim the listing. Same name, phone and service area as Google.
- Analytics: choose one free tool, add a privacy notice line, and exclude your own devices or IP. This is an owner decision because it adds a tracker.

## 4. Citations and links (consistency beats volume)

Same name, phone and website on: Facebook business page, Nextdoor business, Yelp, BBB, DeKalb Chamber, Sycamore/Geneva/St. Charles
chambers, local-team sponsorships, supplier "find an installer" pages. Add each confirmed profile URL to `profiles` in
`lib/business-identity.js`; it becomes `sameAs` structured data.

## 5. Content that earns local rankings (needs your facts)

- A page per city we really serve, with real details only you know (neighborhoods, typical jobs, seasonal timing, photos). Thin
  copy-and-swap city pages are doorway pages and can hurt; we only build them with real content.
- A project gallery with captioned, real photos.
- Short answers to the questions customers ask (pricing basis, what is included, how scheduling works).
- Real customer reviews on the site once collected with permission (never invented).

## 6. Decisions only the owner can make

- Publish a locality-level address in structured data (city/state, no street)? Google lists `address` as required for LocalBusiness;
  today none is published by design.
- Opening hours to publish. None are published, none are guessed.
- Which free analytics tool, and the privacy-notice wording.
