"use client";
import { publicError } from "../../lib/public-errors";
import { useEffect, useState } from "react";
import { sessionFetch } from "../../lib/session-fetch";
import RepeatRequest from "./repeat-request";
type RecordRow = { id: string; status: string; created_at?: string };
type Portal = {
  company: { display_name: string };
  customers: { id: string; display_name: string }[];
  properties: { id: string; street: string; city: string; region: string }[];
  requests: RecordRow[];
  appointments: {
    id: string;
    arrival_at: string;
    start_at: string;
    status: string;
    timezone: string;
  }[];
  invoices: {
    id: string;
    number: string;
    total_cents: number;
    payments: { cents: number }[];
  }[];
  page: number;
  hasMore: boolean;
};
export default function Account() {
  const [invitation, setInvitation] = useState("");
  const [mode, setMode] = useState<
    "password" | "signup" | "recover" | "set-password"
  >("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [workspaceAccess, setWorkspaceAccess] = useState(false);
  const [signed, setSigned] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const [companies, setCompanies] = useState<
    { id: string; display_name: string }[]
  >([]);
  const [org, setOrg] = useState("");
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [data, setData] = useState<Portal | null>(null);
  async function load() {
    setChecking(true);
    setSessionUnavailable(false);
    try {
      const r = await sessionFetch("/api/portal");
      if (r.status === 401) { setMode(m => m === "set-password" ? "recover" : m); setSigned(false); setData(null); setOrg(""); setCompanies([]); return; }
      if (!r.ok) throw Error('Account unavailable');
      const d = await r.json();
      const pending = await sessionFetch("/api/account-link");
      if (pending.ok && (await pending.json()).pending)
        setInvitation((i) => i || "pending");
      const session = await sessionFetch("/api/session");
      if (session.ok) { const details = await session.json(); setWorkspaceAccess((details.memberships || []).some((m: {role: string}) => ["owner", "admin", "staff"].includes(m.role))); }
      setSigned(true);
      setEmail(d.email || "");
      const allowed = new Set(
        d.access.map((a: { organization_id: string }) => a.organization_id),
      );
      const c = d.companies.filter((a: { id: string }) => allowed.has(a.id));
      setCompanies(c);
      if (c.length === 1) setOrg(c[0].id);
    } catch (error) {
      setSessionUnavailable(true);
      throw error;
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    if (new URLSearchParams(location.search).get('auth') === 'failed')
      setMessage('This sign-in link is expired, already used, or was opened in a different browser. Request a new email and open its newest link in the browser where you requested it.');
    const token = new URLSearchParams(location.hash.slice(1)).get("invite");
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
      setInvitation(token);
      history.replaceState(null, "", location.pathname + location.search);
      setMode("signup");
    }
    if (new URLSearchParams(location.search).has("password"))
      setMode("set-password");
    void load().catch(() =>
      setMessage("Could not load your account. Please try again."),
    );
  }, []);
  useEffect(() => {
    if (!org) return;
    let current = true;
    setData(null);
    setHistoryLoading(true);
    setHistoryFailed(false);
    sessionFetch("/api/portal?organization=" + org + "&page=" + page)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (current) setData(d);
      })
      .catch((e) => {
        if (current) {setHistoryFailed(true);setMessage(publicError(e));}
      })
      .finally(() => {if (current) setHistoryLoading(false);});
    return () => {
      current = false;
    };
  }, [org, page, refresh]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || (mode === "recover" && recoverySent)) return;
    if (mode === "set-password" && password !== confirmation) { setMessage("Passwords do not match."); return; }
    setBusy(true);
    setMessage("");
    try {
      const r = await sessionFetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          ...(mode === "signup" && invitation && invitation !== "pending"
            ? { invitation }
            : {}),
          ...(mode !== "set-password" ? { email } : {}),
          ...(mode !== "recover" ? { password } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setPassword("");
      setConfirmation("");
      setVisible(false);
      if (mode === "recover") setRecoverySent(true);
      setMessage(
        d.message ||
          (mode === "set-password" ? "Password saved." : "You are signed in."),
      );
      if (mode === "password" || mode === "set-password") {
        setMode("password");
        await load();
      }
    } catch (e) {
      setMessage(publicError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="account-shell">
      <header className="account-header">
        <a href="/account">My account</a>
        {signed && <a href="/account?password=change">Change password</a>}
        {signed && workspaceAccess && <a href="/owner">Workspace</a>}
        {signed && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await sessionFetch("/api/session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "logout" }),
                });
                if (!r.ok) throw Error("Could not sign out. Try again.");
                setSigned(false);
                setMode("password");
                setRecoverySent(false);
                setMessage("");
                setConfirmation("");
                setPassword("");
                setVisible(false);
                setWorkspaceAccess(false);
                setData(null);
                setOrg("");
                setCompanies([]);
              } catch (e) {
                setMessage(publicError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Sign out
          </button>
        )}
      </header>
      <h1>
        {checking
          ? "Checking your account"
          : mode === "set-password"
          ? "Set your password"
          : signed
          ? "Your appointments and service history"
          : mode === "signup"
            ? "Create your account"
            : mode === "recover"
              ? "Reset your password"
              : "Sign in"}
      </h1>
      <p>{mode === "set-password" ? "Choose a new password for your account." : "Keep your requests, appointments and invoices together."}</p>
      {message && (
        <p role="status" className="account-message">
          {message}
        </p>
      )}
      {checking && <p role="status">Checking your saved sign-in…</p>}
      {!checking && sessionUnavailable && <button type="button" onClick={() => void load().catch(() => setMessage('Could not check your saved sign-in. Please try again.'))}>Try again</button>}
      {!checking && !sessionUnavailable && (!signed || mode === "set-password") && (
        <form onSubmit={submit} className="account-card">
          {mode !== "set-password" && (
            <label>
              Email
              <input
                required
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {mode !== "recover" && (
            <label>
              Password
              <input
                required
                minLength={mode === "password" ? 1 : 10}
                maxLength={128}
                type={visible ? "text" : "password"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete={
                  mode === "password" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? "Hide" : "Show"} password
              </button>
              {mode !== "password" && (
                <small>
                  Use at least 10 characters. A short phrase is easy to
                  remember.
                </small>
              )}
            </label>
          )}
          {mode === "set-password" && <label>Confirm new password<input required type={visible ? "text" : "password"} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} minLength={10} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>}
          <button disabled={busy || (mode === "recover" && recoverySent)} type="submit">
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : mode === "recover"
                  ? "Send reset email"
                  : mode === "set-password"
                    ? "Save password"
                    : "Sign in"}
          </button>
          <div className="actions">
            <button
              type="button"
              disabled={busy}
              hidden={mode === "password"}
              onClick={() => {
                setMode("password");
                setRecoverySent(false);
                setMessage("");
                setConfirmation("");
                setPassword("");
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              disabled={busy}
              hidden={mode === "signup" || mode === "set-password"}
              onClick={() => {
                setMode("signup");
                setPassword("");
              }}
            >
              Create account
            </button>
            <button
              type="button"
              disabled={busy}
              hidden={mode === "recover" || mode === "set-password"}
              onClick={() => {
                setMode("recover");
                setRecoverySent(false);
                setMessage("");
                setPassword("");
              }}
            >
              Forgot password
            </button>
          </div>
        </form>
      )}
      {signed && mode !== "set-password" && invitation && (
        <section className="account-card">
          <h2>Connect your service history</h2>
          <p>Use the email the business invited.</p>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await sessionFetch("/api/account-link", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "claim",
                    ...(invitation !== "pending" ? { token: invitation } : {}),
                  }),
                });
                const d = await r.json();
                if (!r.ok) throw Error(d.error);
                setInvitation("");
                setMessage("Your service history is connected.");
                await load();
              } catch (e) {
                setMessage(publicError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Connect my records
          </button>
        </section>
      )}
      {signed && mode !== "set-password" && companies.length === 0 && (
        <section className="account-card">
          <h2>No connected service records yet</h2>
          <p>
            Your account is ready. Service history appears after your requests
            are securely connected. Please contact the business if earlier work
            is missing.
          </p>
        </section>
      )}
      {signed && mode !== "set-password" && companies.length > 1 && (
        <label>
          Choose your business
          <select
            value={org}
            onChange={(e) => {
              setOrg(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Choose a business</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
      )}
      {signed && mode !== "set-password" && org && <RepeatRequest organization={org} onSaved={()=>{setPage(0);setRefresh(n=>n+1);}}/>}
      {signed && mode !== "set-password" && org && historyLoading && <p role="status">Loading your service history…</p>}
      {signed && mode !== "set-password" && org && historyFailed && <button type="button" onClick={()=>setRefresh(n=>n+1)}>Try loading service history again</button>}
      {signed && mode !== "set-password" && data && (
        <>
          <h2>{data.company.display_name}</h2>
          <section className="account-card">
            <h2>Your details</h2>
            {data.customers.map((c) => (
              <p key={c.id}>{c.display_name}</p>
            ))}
            {data.properties.map((p) => (
              <p key={p.id}>
                {p.street}, {p.city}, {p.region}
              </p>
            ))}
          </section>
          <section className="account-card">
            <h2>Appointments</h2>
            {data.appointments.length === 0 ? (
              <p>No appointments on this page.</p>
            ) : (
              data.appointments.map((a) => (
                <p key={a.id}>
                  {new Date(a.arrival_at || a.start_at).toLocaleString(
                    undefined,
                    { timeZone: a.timezone },
                  )}{" "}
                  — {a.status === "reserved" ? "Confirmed" : a.status === "proposal" ? "Awaiting approval" : a.status === "held" ? "Time temporarily held" : a.status.replaceAll("_", " ")}
                </p>
              ))
            )}
          </section>
          <section className="account-card">
            <h2>Requests</h2>
            {data.requests.length === 0 ? (
              <p>No requests on this page.</p>
            ) : (
              data.requests.map((r) => (
                <p key={r.id}>
                  {new Date(r.created_at!).toLocaleDateString()} —{" "}
                  {r.status.replaceAll("_", " ")}
                </p>
              ))
            )}
          </section>
          <section className="account-card">
            <h2>Invoices</h2>
            {data.invoices.length === 0 ? (
              <p>No invoices available on this page.</p>
            ) : (
              data.invoices.map((i) => (
                <div key={i.id}>
                  <strong>Invoice {i.number}</strong>
                  <p><a href={"/invoice?"+new URLSearchParams({organization:org,invoice:i.id,return:"account"})}>Open invoice and download PDF</a></p>
                  <p>
                    Total{" "}
                    {(i.total_cents / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}{" "}
                    · Balance{" "}
                    {(
                      (i.total_cents -
                        i.payments.reduce((sum, p) => sum + p.cents, 0)) /
                      100
                    ).toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                  </p>
                </div>
              ))
            )}
          </section>
          <div className="actions">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous records
            </button>
            <span>Page {page + 1}</span>
            <button
              disabled={!data.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next records
            </button>
          </div>
        </>
      )}
    </main>
  );
}
