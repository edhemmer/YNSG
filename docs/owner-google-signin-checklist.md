# Owner Google sign-in acceptance — October 3, 2026

Latest owner direction: offer Google sign-in for owners, retain separate customer email/password or guest intake, replace repeated public email text with Email us links. Governing requirements and current session source reviewed.

- Google sign-in uses Supabase PKCE and existing HTTP-only sessions. No role granted from email, Google profile, URL or user metadata.
- Only the owner entry offers the new button. Signed-in owners land in Google connection setup; Calendar/Gmail permissions, selection and receipt remain separate explicit steps.
- Google login provider must be enabled in Supabase. Missing/failed provider checks show a disabled action and setup guidance; no claim that Vercel credentials enable Supabase login.
- OAuth starts by same-origin POST; callback uses bound verifier and a fixed destination. Never accept arbitrary redirect URLs or expose tokens.
- Public Email us links preserve working mailto destinations and honest privacy text; do not claim bot protection.
- Unit checks cover provider status, allowed authorization URL and PKCE challenge. TypeScript and builds must pass. Live owner consent and provider activation remain acceptance checks.

Results: 70 unit tests, root TypeScript, website syntax/nine-page build and optimized CRM build pass. Login provider activation, Google consent, identity linking to the existing owner, callback return on a phone and Calendar/Gmail receipts remain live checks. This adds a sign-in flow; it does not activate integrations or scheduled automation. Public email labels preserve their original destinations.
