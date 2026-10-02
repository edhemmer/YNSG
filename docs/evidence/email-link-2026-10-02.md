# R03 email sign-in correction — October 2, 2026

Supabase dashboard verified: Site URL is the stable CRM /auth/confirm URL. Custom SMTP is disabled, and built-in email template editing is unavailable without it. The default email contains a verification link. The prior callback-only change did not initiate PKCE or preserve a verifier; it could not finish this flow.

Email requests now initiate PKCE and specify APP_ORIGIN/auth/confirm. Only the latest verifier is preserved in a one-hour Secure/HttpOnly/SameSite=Lax cookie. The callback exchanges its one-use code using that verifier, clears it, and saves the established session using the existing HttpOnly/Strict session cookies. No arbitrary redirect or unbound token_hash fallback is accepted. Missing/invalid links display recovery instructions. Explicit empty redirect fragments prevent old implicit token fragments being carried to the CRM home page. Email codes remain supported where templates provide them.

Verified: real pinned SDK against mocked provider proves the challenge matches the verifier across separate request clients, session tokens do not enter verifier storage, and missing verifier prevents a provider exchange. TypeScript and production build pass. Live emailed-link receipt/claim still needs owner interaction in the same browser as the email request. Old links must be replaced with a fresh request.

Default Supabase mail remains for owner testing; general external customer auth still requires configured SMTP. Google integration OAuth remains a separate /api/google/callback flow. Automated customer notifications remain disabled.
