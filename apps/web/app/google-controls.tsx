"use client";
import { useEffect, useRef, useState } from "react";
type Connection = {
  connected: boolean;
  email: string | null;
  calendarId: string | null;
  health: string;
  checkedAt: string | null;
  gmailTest: string;
};
type Calendar = { id: string; summary: string; timeZone?: string };
const messages: Record<string, string> = {
  GOOGLE_REFRESH_UNAVAILABLE: 'Google could not refresh access right now. The connection is retained; try again later.',
  GOOGLE_CLIENT_CONFIGURATION_REQUIRED: 'Check the Google OAuth client ID and secret in this deployment environment.',
  OWNER_MFA_REQUIRED:
    "Owner or administrator access with two-step verification is required.",
  GOOGLE_SETUP_REQUIRED:
    "Google configuration is missing. Enter the listed values directly in Vercel.",
  RECONNECT_REQUIRED:
    "Google access expired or was revoked. Disconnect, then connect again.",
  MISSING_GOOGLE_SCOPES:
    "Google did not grant every required permission. Reconnect and review the requested access.",
  STALE_CONNECTION: "The connection changed. Refresh before trying again.",
  DELIVERY_REVIEW_REQUIRED:
    "The previous test may have sent. Check your Gmail Sent folder before any further test.",
  CALENDAR_MIGRATION_REQUIRED:
    "Existing appointments use the current calendar. Calendar migration needs review before changing it.",
  PERMISSION_OR_API_REQUIRED:
    "Check the enabled Google APIs and granted permissions.",
  DISCONNECT_BEFORE_RECONNECT:
    "Disconnect the current Google account before connecting another.",
};
export default function GoogleControls({
  organization,
}: {
  organization: string;
}) {
  const [connection, setConnection] = useState<Connection | null>(null),
    [missing, setMissing] = useState<string[]>([]),
    [calendars, setCalendars] = useState<Calendar[]>([]),
    [calendar, setCalendar] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [redirect, setRedirect] = useState<string | null>(null);
  const generation = useRef(0),
    testKey = useRef<string | null>(null);
  async function load() {
    const gen = ++generation.current;
    try {
      const r = await fetch(
          "/api/google?organization=" + encodeURIComponent(organization),
          { cache: "no-store" },
        ),
        v = await r.json();
      if (gen !== generation.current) return;
      if (!r.ok) throw new Error(v.error);
      setMissing(v.missing);
      setConnection(v.connection);
      setRedirect(v.redirectUri);
      setCalendar(v.connection?.calendarId || "");
    } catch (e) {
      if (gen === generation.current)
        setMessage(
          messages[(e as Error).message] ||
            "Unable to read Google connection status.",
        );
    }
  }
  useEffect(() => {
    setConnection(null);
    setCalendars([]);
    testKey.current = null;
    void load();
    const outcome = new URLSearchParams(window.location.search).get("google");
    if (outcome)
      setMessage(
        outcome === "connected"
          ? "Google connected. Select a calendar and run the Gmail test."
          : "Google connection was not completed. Check configuration and try Connect Google again.",
      );
    return () => {
      generation.current++;
    };
  }, [organization]);
  async function act(action: string, extra: Record<string, string> = {}) {
    setBusy(true);
    setMessage("");
    const gen = generation.current;
    try {
      const r = await fetch("/api/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, organization, ...extra }),
        }),
        v = await r.json();
      if (gen !== generation.current) return;
      if (!r.ok) throw new Error(v.error);
      if (v.url) {
        window.location.assign(v.url);
        return;
      }
      if (action === "sync")
        setMessage(
          "Calendar sync: " +
            v.results.join(", ") +
            ". " +
            (v.status || []).filter(
              (s: { state: string }) => s.state === "needs_review",
            ).length +
            " event(s) need owner review.",
        );
      if (v.calendars) setCalendars(v.calendars);
      if (v.connection) setConnection(v.connection);
      if (action === "disconnect") {
        setCalendars([]);
        setCalendar("");
        testKey.current = null;
        setMessage(
          v.revoked
            ? "Google disconnected. Existing calendar events were retained."
            : v.message,
        );
        await load();
      }
      if (action === "test_email" && ['accepted','failed'].includes(v.connection.gmailTest)) testKey.current=null;
      if (action === "test_email")
        setMessage(
          v.connection.gmailTest === "accepted"
            ? "Google accepted the test message. Confirm it arrived in your Gmail account. Website email is unchanged."
            : v.connection.gmailTest === "failed"
              ? "Google rejected the test. Check configuration before retrying."
              : "Delivery is uncertain. Check Gmail Sent; this test will not be resent automatically.",
        );
      if (action === "health")
        setMessage(
          "Connection checked. Gmail delivery requires the separate test below.",
        );
    } catch (e) {
      setMessage(
        messages[(e as Error).message] ||
          "Google could not complete this action. Your existing website email is unchanged.",
      );
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  }
  return (
    <section className="card" aria-labelledby="google-heading">
      <p className="eyebrow">Connections</p>
      <h2 id="google-heading">Google Calendar & Gmail</h2>
      <p>
        Your website’s current email service stays active. Connecting Google
        does not switch customer email delivery.
      </p>
      {missing.length > 0 ? (
        <>
          <h3>Missing configuration</h3>
          <ul>
            {missing.map((k) => (
              <li key={k}>
                <code>{k}</code>
              </li>
            ))}
          </ul>
          <p>
            Enter secrets directly in Vercel’s project environment settings.
          </p>
        </>
      ) : null}
      {redirect && (
        <p>
          Authorized redirect URI:{" "}
          <code style={{ overflowWrap: "anywhere" }}>{redirect}</code>
        </p>
      )}
      {!connection?.connected ? (
        <button
          type="button"
          disabled={busy || missing.length > 0}
          onClick={() => void act("connect")}
        >
          Connect Google
        </button>
      ) : (
        <>
          <dl>
            <dt>Google account</dt>
            <dd>{connection.email}</dd>
            <dt>Connection health</dt>
            <dd>{connection.health.replaceAll("_", " ")}</dd>
            <dt>Last checked</dt>
            <dd>
              {connection.checkedAt
                ? new Date(connection.checkedAt).toLocaleString()
                : "Not checked"}
            </dd>
            <dt>Gmail test</dt>
            <dd>{connection.gmailTest.replaceAll("_", " ")}</dd>
            <dt>Selected calendar</dt>
            <dd style={{ overflowWrap: "anywhere" }}>
              {connection.calendarId || "Not selected"}
            </dd>
          </dl>
          <div className="actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("health")}
            >
              Check connection
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("calendars")}
            >
              Load my calendars
            </button>
          </div>
          {calendars.length > 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act("calendar", { calendarId: calendar });
              }}
            >
              <label>
                Calendar you own
                <select
                  value={calendar}
                  required
                  onChange={(e) => setCalendar(e.target.value)}
                >
                  <option value="">Choose a calendar</option>
                  {calendars.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.summary}
                      {c.timeZone ? " · " + c.timeZone : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={busy || !calendar}>Save calendar</button>
            </form>
          )}
          <button
            type="button"
            disabled={busy || !connection.calendarId}
            onClick={() => void act("sync")}
          >
            Sync calendar now
          </button>
          <p>
            Processes up to ten queued changes and checks mapped upcoming
            events. Google edits require review; they do not approve or move CRM
            appointments.
          </p>
          <p>
            The test sends one message to the connected Google account, not to a
            customer. No inbox-reading permission is requested.
          </p>
          <button
            type="button"
            disabled={
              busy || ["sending", "unknown"].includes(connection.gmailTest)
            }
            onClick={() => {
              testKey.current ??= crypto.randomUUID();
              void act("test_email", { key: testKey.current });
            }}
          >
            Send Gmail test to myself
          </button>
          <details>
            <summary>Disconnect Google</summary>
            <p>
              Stops new CRM Google operations and revokes the stored grant.
              Existing events and your website email remain in place.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("disconnect")}
            >
              Disconnect this account
            </button>
          </details>
        </>
      )}
      <button type="button" disabled={busy} onClick={() => void load()}>
        Refresh status
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
