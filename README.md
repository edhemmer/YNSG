# YNSG website

Next.js / TypeScript website for Your Neighborhood Service Guy.

## Run and verify

Use Node 20.9+ and pnpm. Run `pnpm install`, `pnpm dev`, `pnpm lint`, and `pnpm build`.

## Current preview

Home, service pages, pricing, About, progressive request review, and policy pages are available. Call and text use the approved business number. The form supports five service groups, conditional job details, optional private Community Rate choices, and review/edit without losing data during navigation.

Request delivery is not connected. No request is saved or emailed, and no photos are collected. The API returns 503 rather than reporting false success. Drafts exist only in page memory and are lost on reload. Google email integration awaits account configuration and delivery verification.

Preview indexing is disabled. Canonical metadata targets the intended domain; domain ownership, redirects, and email DNS still need verification before launch. No credentials, private plans, or environment files belong in this repository.

## Launch gates

Configure an authorized sender, server validation and abuse controls, durable request IDs and duplicate prevention, delivery tracking, and honest retry behavior. Verify actual inbox receipt and failure paths. Finalize privacy retention and provider disclosures, real-device accessibility, domain/HTTPS, and business policy review before promoting the website for public intake.
