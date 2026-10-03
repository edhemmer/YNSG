import Link from "next/link";
import { callbackUri, GOOGLE_SCOPES } from "../../lib/google-core";
import { missingGoogleConfiguration } from "../../lib/google-server";
export const dynamic = "force-dynamic";
export default function GoogleSetup() {
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
        <h2>Google Cloud settings</h2>
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
          requested. Calendar editing is limited to calendars you own.
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
          Sign in to the CRM as an owner or administrator and open More →
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
          <Link href="/">Back to CRM sign-in</Link>
        </p>
      </article>
    </main>
  );
}
