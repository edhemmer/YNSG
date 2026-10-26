"use client";
import {useEntrySafety} from '../entry-safety';
import {AccountPrivacy} from '../privacy-controls';
import {creditTotal} from '../../lib/invoice-credit-contract';

import {invoiceNumber} from "../../lib/invoice-number";
import { publicError } from "../../lib/public-errors";
import { useEffect, useState } from "react";
import { sessionFetch } from "../../lib/session-fetch";
import RepeatRequest from "./repeat-request";
import CustomerProfile from "./profile";
import {portalAccess,portalPage,verifiedPortalPage} from '../../lib/customer-portal-contract';
import type {z} from 'zod';
type Portal=z.infer<typeof portalPage>;
export default function Account({initialMode="password"}:{initialMode?:"password"|"signup"}) {
  const {canLeave}=useEntrySafety();
  const [invitation, setInvitation] = useState("");
  const [mode, setMode] = useState<
    "password" | "signup" | "recover" | "set-password"
  >(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);
  const [signupSent,setSignupSent]=useState(false);
  const [requestOpen,setRequestOpen]=useState(false);
  const [privacyOpen,setPrivacyOpen]=useState(false);
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
      const d = portalAccess.parse(await r.json());
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
        if (!r.ok) {if(current&&r.status===401){setSigned(false);setCompanies([]);setOrg("");setWorkspaceAccess(false);}throw Error(d.error);}
        if (current) setData(verifiedPortalPage(d,org,page));
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
    if (busy || (mode === "recover" && recoverySent) || (mode === "signup" && signupSent)) return;
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
      if (mode === "signup") setSignupSent(true);
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
        <a href="https://www.yourneighborhoodserviceguy.com/">Back to website</a>
        <a href="/account">My account</a>
        {signed && <a href="/auth/password">Change password</a>}
        {signed && workspaceAccess && <a href="/owner">Workspace</a>}
        {signed && (
          <button
            disabled={busy}
            onClick={async () => {
              if(!canLeave())return;
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
      <p className="account-privacy-note">We do not collect or store card numbers, security codes or bank account details.</p>
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
            <div className="account-password-field">
              <label htmlFor="account-password">Password</label>
              <input id="account-password"
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
            </div>
          )}
          {mode === "set-password" && <label>Confirm new password<input required type={visible ? "text" : "password"} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} minLength={10} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>}
          <button disabled={busy || (mode === "recover" && recoverySent) || (mode === "signup" && signupSent)} type="submit">
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? (signupSent?"Check your email":"Create account")
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
                setSignupSent(false);
                setMessage("");
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
              if(!canLeave())return;
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
      {signed && mode !== "set-password" && companies.length === 0 && !invitation && (
        <CustomerProfile key={email} email={email} onSaved={async()=>{setRequestOpen(true);await load();}} />
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
      {signed && mode !== "set-password" && org && <section className="account-request-entry">
        <button type="button" className="service-request-button" aria-expanded={requestOpen} aria-controls="account-new-request" onClick={()=>{if(canLeave())setRequestOpen(!requestOpen);}}>Request service appointment <span aria-hidden="true">↗</span></button>
        <div id="account-new-request" hidden={!requestOpen}><RepeatRequest key={org} organization={org} onSaved={()=>{setPage(0);setRefresh(n=>n+1);setRequestOpen(false);setMessage('Your service request is saved. We’ll contact you to confirm the appointment.');}}/></div>
      </section>}
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
                  {new Date(r.created_at!).toLocaleDateString("en-US",{timeZone:data.company.timezone})} —{" "}
                  Request {r.id.slice(0,8)} · {r.status.replaceAll("_", " ")}
                  {r.services?.length ? <><br/>{r.services.map(s=>s.service+" — "+s.task).join("; ")}</> : null}
                </p>
              ))
            )}
          </section>
          <section className="account-card"><h2>Service history</h2>
            {data.jobs.length===0?<p>No service visits on this page yet.</p>:data.jobs.map(job=><p key={job.id}>Service {job.id.slice(0,8)} · {job.status.replaceAll("_"," ")}</p>)}
          </section>
          <section className="account-card">
            <h2>Invoices</h2>
            {data.invoices.length === 0 ? (
              <p>No invoices available on this page.</p>
            ) : (
              data.invoices.map((i) => (
                <div key={i.id}>
                  <strong>Invoice {invoiceNumber(i.number)}</strong>
                  <p><a href={"/invoice?"+new URLSearchParams({organization:org,invoice:i.id,return:"account"})}>Open invoice and download PDF</a></p>
                  <p>Credits after corrections: {(creditTotal(i.credits)/100).toLocaleString('en-US',{style:'currency',currency:'USD'})}</p>
                  <p>
                    Total{" "}
                    {(i.total_cents / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}{" "}
                    · Balance{" "}
                    {(
                      (i.total_cents - creditTotal(i.credits) -
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
      <details className="account-settings" onToggle={event=>setPrivacyOpen(event.currentTarget.open)}><summary>Privacy and account settings</summary>{privacyOpen && (
      <AccountPrivacy key={signed?'signed':'signed-out'} onDeleted={()=>{setSigned(false);setWorkspaceAccess(false);setData(null);setOrg('');setCompanies([]);setInvitation('');setPassword('');setConfirmation('');setMode('password');setMessage('Your sign-in identity has been deleted. Company records remain subject to the disclosed retention policies.');}}/>
      )}</details>
    </main>
  );
}
