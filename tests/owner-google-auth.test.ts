import test from "node:test";
import assert from "node:assert/strict";
import {
  ownerGoogleEnabled,
  ownerAuthorizationUrl,
} from "../apps/web/lib/owner-google-auth.js";
import { createEmailClient } from "../apps/web/lib/email-auth-core.js";
test("Google availability requires explicit enabled provider and fails closed on outages", async () => {
  const mock =
    (d: unknown): typeof fetch =>
    async () =>
      new Response(JSON.stringify(d));
  assert.equal(
    await ownerGoogleEnabled(
      "https://test.supabase.co",
      "synthetic",
      mock({ external: { google: true } }),
    ),
    true,
  );
  assert.equal(
    await ownerGoogleEnabled(
      "https://test.supabase.co",
      "synthetic",
      mock({ external: { google: false } }),
    ),
    false,
  );
  assert.equal(
    await ownerGoogleEnabled(
      "https://test.supabase.co",
      "synthetic",
      async () => {
        throw Error("offline");
      },
    ),
    false,
  );
});
test("Google authorization stays on configured auth service with bound PKCE", async () => {
  const auth = createEmailClient("https://test.supabase.co", "synthetic", null);
  const r = await auth.client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "https://crm.example.invalid/auth/confirm",
      scopes: "openid email profile",
      skipBrowserRedirect: true,
    },
  });
  assert.ok(auth.currentVerifier());
  assert.equal(r.error, null);
  const url = new URL(
    ownerAuthorizationUrl(r.data.url!, "https://test.supabase.co"),
  );
  assert.equal(url.searchParams.get("code_challenge_method"), "s256");
  assert.ok(url.searchParams.get("code_challenge"));
  assert.throws(() =>
    ownerAuthorizationUrl(
      "https://evil.example/auth/v1/authorize?provider=google",
      "https://test.supabase.co",
    ),
  );
});
