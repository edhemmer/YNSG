# 05. Design, brand and copy rules

Last updated: November 13, 2026.

## Brand in one paragraph

Your Neighborhood Service Guy (YNSG), "Home & Yard, We're Here to Help." A locally owned, neighborly, honest service. The feel is calm, premium and trustworthy, never salesy. The logo is a house with a sun and a small tree over green hills, with the wordmark in navy and green. Use the existing logo files; do not redraw it.

## Palette (from `site/main.css` and the owner app)

| Role | Value |
| --- | --- |
| Navy (text, headings) | `#10283c` |
| Forest green (primary action, accents) | `#315842` |
| Gold (highlights, thin rules) | `#edbd6b` on the website; `#c6a35b` in the owner app and emails |
| Cream / paper (backgrounds) | `#f8f6ef` / `#fffefa` |
| Body text / muted | `#283d45` / `#48616b` |

The owner app loads `apps/web/app/premium.css` last; it overrides earlier styles. The website layers `main.css`, then polish and premium layers. Keep tap targets at least 44 px, keep body text readable (the readability script is `scripts/readability.mjs`), and make every layout work at 390 px width.

## Voice

Plain words, warm, specific, short sentences. Say what we do, what it costs and what happens next. Write like a good neighbor who is also dependable. Avoid jargon, hype, exclamation marks and fear. The owner reads in plain words; so do customers.

## Wording rules the tests enforce or the owner requires

- Never promise outcomes or availability: no "guaranteed", no "limited availability", no pressure language.
- Do not call the business a "handyman" in headings or ads. Use "small home jobs".
- Do not advertise or imply licensed trades (plumbing, electrical wiring, gas, refrigerant, structural). The Field guide covers them as know-how only. See [`docs/handoff/02-build-scope.md`](02-build-scope.md) and the licensing guide in the owner app.
- Work stays at ground level or within the five-foot working-height limit. No roofing or gutter work.
- Never mention a "trip charge" or "no trip charges". There is no such line item.
- Pricing facts: $70 per person per hour, $45 per person per hour for the Community Rate (seniors 70+, veterans, single parents, neighbors with disabilities; no paperwork needed), first person has a two-hour minimum ($140 standard, $90 Community Rate). Materials are separate. An estimate and a not-to-exceed cap are approved before work starts. Do not change these without the owner.
- Phone is `815-680-1775` everywhere. The old number `770-630-2094` appears on some older printed signs. Never put it, or an edited version of a sign, on the site.
- Service area: DeKalb, Sycamore, Cortland, Maple Park, Elburn, Lily Lake, Campton Hills, Geneva, St. Charles and nearby.

## Photos

- Use the owner's real photos where possible. AI-generated service images are labeled as illustrations in `site/assets/services/IMAGE-USAGE.md`, which also records every edit made to real photos.
- Strip EXIF and location data. Blur house numbers and anything that identifies a customer. Do not edit text on signs or documents in a photo to make it look current; the owner rejected an edited sign number because it looked fake.
- Do not publish photos of work we do not offer (for example plumbing repair, appliance hookup).
- Interior shots of customers' homes need the customer's okay. Check with the owner.

## Owner app design principles

- Field-first: the Today screen answers "what do I do now?" and shows only today's visits, plus requests that need a decision and unfinished work. Tomorrow and This week are separate tabs.
- One obvious primary action per card. Plain labels ("Open job", "Review and schedule").
- No unexplained jargon. Money screens say what will happen before it happens.
- Every control reachable by keyboard and labeled for screen readers.
