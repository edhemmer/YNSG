import Link from "next/link";
import type { Metadata } from "next";
import { redirect as navigate } from "next/navigation";
import { authenticated } from "../../lib/session";
import { callbackUri, GOOGLE_SCOPES } from "../../lib/google-core";
import { missingGoogleConfiguration } from "../../lib/google-server";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner Google setup",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function GoogleSetup() {
  // Authenticate and recheck live owner permission before reading any setup details.
  let allowed = false;
  try {
    const { db, user } = await authenticated();
    const { data, error } = await db.from("memberships")
      .select("organization_id,role").eq("user_id", user.id);
    if (!error) {
      for (const membership of data || []) {
        if (!["owner", "admin"].includes(membership.role)) continue;
        const access = await db.rpc("google_access", { p_org: membership.organization_id });
        if (!access.error && access.data === true) { allowed = true; break; }
      }
    }
  } catch {
    // Fail closed for expired sessions, revoked membership or unavailable auth.
  }
  if (!allowed) navigate("/owner");
  const missing = missingGoogleConfiguration();
  let redirect: string | null = null;
  try {
    if (process.env.APP_ORIGIN) redirect = callbackUri(process.env.APP_ORIGIN);
  } catch {}
  return (
    <main id="main" className="shell">
      <article className="card">
        <p className="eyebrow">Owner setup</p>
        <h1>Connect your Google account</h1>
        <p>
          The existing website email stays active. Google customer delivery is
          not enabled by connecting an account.
        </p>
        <h2>Owner Google sign-in</h2>
        <p>In Supabase Authentication → Sign In / Providers → Google, enable Google and configure the OAuth client. Add the callback URL shown there to Google Cloud's Authorized redirect URIs. Also allow your app /auth/confirm URL in Supabase Authentication's redirect URL list. This login setup is separate from the Calendar/Gmail callback below. Existing verified owner memberships still control company access.</p>
        <h2>Google Cloud settings for Calendar &amp; Gmail</h2>
        <ol>
          <li>
            Enable Gmail API and Google Calendar API in one Google Cloud
            project.
          </li>
          <li>
            In Google Auth Platform, choose External audience. For initial
            testing, add your Google account as a test user.
          </li>
          <li>
            Create an OAuth client with application type Web application. Leave
            Authorized JavaScript origins empty; this integration uses the
            server.
          </li>
          <li>
            Enter this exact Authorized redirect URI:
            <p>
              <code style={{ overflowWrap: "anywhere" }}>
                {redirect ||
                  "APP_ORIGIN must be configured before a redirect URI can be determined."}
              </code>
            </p>
          </li>
        </ol>
        <h2>Requested scopes</h2>
        <ul>
          {GOOGLE_SCOPES.map((s) => (
            <li key={s}>
              <code style={{ overflowWrap: "anywhere" }}>{s}</code>
            </li>
          ))}
        </ul>
        <p>
          No Gmail inbox, Drive, Sheets, Maps, or service-account access is
          requested. Calendar event editing is limited to calendars you own. The calendar.app.created permission allows the app to create a separate business calendar. Keep personal events on your personal calendar; only the selected business calendar currently affects booking availability.
        </p>
        <h2>Missing deployment configuration</h2>
        {missing.length ? (
          <ul>
            {missing.map((k) => (
              <li key={k}>
                <code>{k}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Required environment variable names are present. Live Google testing
            is still required.
          </p>
        )}
        <p>
          Enter secret values directly in Vercel → ynsg-repo → Settings →
          Environment Variables → Preview → codex/crm-workflow, then redeploy.
          Do not send them in chat.
        </p>
        <h2>After configuration</h2>
        <p>
          Sign in to the app as an owner or administrator and open Settings →
          Google Calendar & Gmail. Connect Google,
          select a calendar you own, check connection health, then send the test
          message to yourself.
        </p>
        <p>
          External apps in Google’s Testing mode receive authorizations that
          expire after seven days. Review publishing and verification
          requirements before unattended use.
        </p>
        <p>
          <Link href="/">Back to owner sign-in</Link>
        </p>
      </article>
    </main>
  );
}
