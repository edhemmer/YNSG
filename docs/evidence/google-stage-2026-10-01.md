# Google integration evidence — October 1, 2026

Code commit 18d723f pushed to codex/crm-workflow. Vercel deployment dpl_GpRQuEqUCNamVbTNkdQXQpjUvTBy READY. Stable branch origin: https://ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app.

Live browser inspected /google-setup. It renders the implemented callback path /api/google/callback appended to the configured branch origin and lists exactly SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET as missing. Other required settings were installed in the isolated preview project; encryption key generated without displaying it.

Authenticated Vercel deployment probes: callback without state/code returns 303 to the canonical CRM origin with google=failed, no-store/no-referrer and cleared OAuth cookie. Worker GET returns 405; unauthenticated POST returns 401. No Google request or email resulted.

Local Next production build and TypeScript pass. Fifteen domain/Google adapter tests pass. Synthetic mobile browser tests at 390×844 pass for calendar selection, health, Gmail self-test controls, disconnect and no horizontal overflow; no page errors. These used mock API responses and do not verify live Google consent or delivery.

Hosted YNSG rollback tests cover owner/tenant access, private credential denial, state replay, Gmail test retry, disconnect fencing, selected calendar queue claims, projection results and reconciliation. Security advisor returned no lints. Migrations google_connections and google_projection_query_fix applied. Test records rolled back.

Public site/, api/ and scripts/build.mjs are unchanged against original public baseline 4f34df9. Website mail remains on its existing path. Google customer dispatcher and automatic calendar worker remain disabled. See docs/google-integration.md for configuration requirements versus unfinished broader CRM workflows.
