"use client";
import GoogleControls from './google-controls';
import OwnerSetup from './owner-setup';
import InvoiceDraft from './invoice-draft';
import CustomerInvite from './customer-invite';
import RelationshipNotes from './relationship-notes';
import CalendarBlocks from './calendar-blocks';
import CompanySettingsPanel from './company-settings';
import AvailabilityPanel from './availability-panel';
import SchedulingReviewPanel from './scheduling-review-panel';
import {sessionFetch,SessionApiError} from '../lib/session-fetch';
import { useEffect, useRef, useState, type FormEvent } from "react";
type Membership = { organization_id: string; role: string };
type RequestRecord = {
  id: string;
  status: string;
  revision: number;
  created_at: string;
  original_submission: {name:string;phone:string;email:string;street:string;city:string;service?:string;task?:string;description?:string;services?:{service:string;task:string}[]};
};
type Quote = {
  id: string;
  customer_id: string;
  current_version: number;
  status: string;
  quote_versions: {
    version: number;
    scope: string;
    labor_cents: number;
    duration_minutes: number;
  }[];
};
type Job = {
  id: string;
  customer_id: string;
  quote_id: string;
  status: string;
  revision: number;
};
type Invoice = {
  id: string;
  number: number;
  total_cents: number;
  issued_at: string;
  payments: { cents: number }[];
};
type Appointment = {
  id: string;
  request_id: string;
  status: string;
  revision: number;
  start_at: string;
  end_at: string;
  arrival_at: string;
  expires_at: string | null;
  replaces_id: string | null;
  customer_response: string;
};
type Data = {
  company: {
    id: string;
    display_name: string;
    timezone: string;
    status: string;
  };
  requests: RequestRecord[];
  customers: { id: string; display_name: string }[];
  quotes: Quote[];
  jobs: Job[];
  invoices: Invoice[];
  outbox: { id: string; kind: string; status: string; created_at: string }[];
  appointments: Appointment[];
  schedulingPreferences: {id:string;request_id:string;appointment_id:string;preferred_local_start:string|null;timezone:string;note:string;created_at:string}[];
  pagination:{page:number;hasMore:boolean;appointmentFrom:string};
  features?:{productionWorkflows:boolean};
};
const requestServices = (request: RequestRecord) => request.original_submission.services?.length
  ? request.original_submission.services.map(item => `${item.service}: ${item.task || 'Not sure yet'}`)
  : [`${request.original_submission.service || 'Service'}: ${request.original_submission.task || 'Not sure yet'}`];
const usd = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    v / 100,
  );
async function api(path: string, value?: unknown) {
  const res = await sessionFetch(path, {
    ...(value
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        }
      : {}),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new SessionApiError(data.error || "Unable to complete this action.",res.status);
  return data;
}
export default function Workspace({ configured, initialEmail = "" }: { configured: boolean; initialEmail?: string }) {
  const reloadSequence = useRef(0);
  const sessionSequence = useRef(0);
  const [sessionUnavailable,setSessionUnavailable]=useState(false);
  const retryKeys = useRef(new Map<string, string>());
  const [session, setSession] = useState<{
      email: string;
      memberships: Membership[];
    } | null>(null),
    [checking, setChecking] = useState(configured),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [email, setEmail] = useState(initialEmail),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [pending, setPending] = useState(false);
  const [org, setOrg] = useState(""),
    [data, setData] = useState<Data | null>(null),
    [section, setSection] = useState("Today");
  const [page,setPage]=useState(0);
  async function loadSession() {
    const sequence=++sessionSequence.current;
    try {
      const s = await api("/api/session");
      if(sequence!==sessionSequence.current)return;
      setSessionUnavailable(false);
      setError(previous=>previous.startsWith('We could not check your saved sign-in.')?'':previous);
      setSession(s);
      const googleOrg = new URLSearchParams(window.location.search).get('googleOrganization');
      setOrg((o: string) => o || s.memberships.find((m: Membership)=>m.organization_id===googleOrg)?.organization_id || s.memberships[0]?.organization_id || "");
      if(new URLSearchParams(window.location.search).has('google'))setSection('More');
      if(new URLSearchParams(window.location.search).has('request'))setSection('Work');
    } catch (e) {
      if(sequence!==sessionSequence.current)return;
      if(e instanceof SessionApiError&&e.status===401){
        setSession(null);setOrg('');setData(null);setSessionUnavailable(false);
      }else{
        setSessionUnavailable(true);setError('We could not check your saved sign-in. Try again when your connection is available; you do not need another email.');
      }
    } finally {
      if(sequence===sessionSequence.current)setChecking(false);
    }
  }
  useEffect(() => {
    if(new URLSearchParams(window.location.search).get('auth')==='failed')setError('This sign-in link is expired, already used, or was opened in a different browser. Request a new email here and open its newest link in this browser.');
    if (configured) void loadSession();
  }, [configured]);
  useEffect(()=>{
    if(!configured)return;
    const resume=()=>{if(document.visibilityState==='visible')void loadSession();};
    window.addEventListener('focus',resume);
    return()=>window.removeEventListener('focus',resume);
  },[configured]);
  async function refresh(selected = org) {
    if (!selected) return;
    const sequence = ++reloadSequence.current;
    setError("");
    try {
      const next = await api(
        `/api/workspace?organization=${encodeURIComponent(selected)}&page=${page}&request=${encodeURIComponent(new URLSearchParams(window.location.search).get('request')||'')}`,
      );
      if (sequence === reloadSequence.current) setData(next);
    } catch (e) {
      if (sequence === reloadSequence.current) {
        setData(null);
        setError((e as Error).message);
      }
    }
  }
  useEffect(() => {
    setData(null);
    if (org) void refresh(org);
  }, [org,page]);
  async function login(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (sent) {
        await api("/api/session", { action: "verify", email, code });
        await loadSession();
      } else {
        const r = await api("/api/session", { action: "send", email });
        setSent(true);
        setMessage(r.message);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function act(value: Record<string, unknown>) {
    setPending(true);
    setError("");
    setMessage("");
    const fingerprint = JSON.stringify([org, value]);
    if (!retryKeys.current.has(fingerprint))
      retryKeys.current.set(fingerprint, crypto.randomUUID());
    try {
      const r = await api("/api/commands", {
        organizationId: org,
        key: retryKeys.current.get(fingerprint),
        ...value,
      });
      setMessage("Saved. The current record is shown below.");
      await refresh();
      return r;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function decideTime(input: Record<string, unknown>) {
    setPending(true);
    setError("");
    const fingerprint = JSON.stringify([org, input]);
    if (!retryKeys.current.has(fingerprint))
      retryKeys.current.set(fingerprint, crypto.randomUUID());
    try {
      await api("/api/scheduling", {
        schemaVersion: 1,
        organizationId: org,
        key: retryKeys.current.get(fingerprint),
        input,
      });
      setMessage(
        "Decision saved. Customer delivery is shown separately in the communication queue.",
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function fieldAction(j:Job,action:'start'|'pause'|'resume') {
    setPending(true);setError('');const value={organizationId:org,id:j.id,revision:j.revision,action,note:''};const fingerprint=JSON.stringify(value);
    if(!retryKeys.current.has(fingerprint))retryKeys.current.set(fingerprint,crypto.randomUUID());
    try{await api('/api/jobs',{...value,key:retryKeys.current.get(fingerprint)});setMessage('Job and time record saved.');await refresh();}catch(e){setError((e as Error).message);}finally{setPending(false);}
  }
  const role = session?.memberships.find(
    (m) => m.organization_id === org,
  )?.role;
  const operational = ["owner", "admin", "dispatcher"].includes(role || "");
  const finance = ["owner", "admin", "bookkeeper"].includes(role || "");
  const customerName = (id: string) =>
    data?.customers.find((c) => c.id === id)?.display_name || "Customer record";
  return (
    <>
      <header className="top">
        <div className="brand">
          {data?.company.display_name || "Service workspace"}
          <small>Requests, work and the next step.</small>
        </div>
        <a href="/google-setup">Google setup guide</a>
        {session && (
          <button
            className="secondary"
            onClick={async () => {
              try {
                sessionSequence.current++;
                await api("/api/session", { action: "logout" });
                sessionSequence.current++;
                setSession(null);
                setSessionUnavailable(false);
                reloadSequence.current++;
                retryKeys.current.clear();
                setData(null);
                setOrg("");
                setEmail("");
                setCode("");
                setSent(false);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Sign out
          </button>
        )}
      </header>
      <main className="shell" id="main">
        {!configured ? (
          <div className="auth card">
            <p className="eyebrow">Workspace setup</p>
            <h1>A careful start.</h1>
            <p>
              The CRM database connection is not configured for this deployment
              yet. Your public website remains available.
            </p>
            <p className="note">
              This build is not ready for live customer operations.
            </p>
            <a href="https://www.yourneighborhoodserviceguy.com/">
              Visit the public website
            </a>
          </div>
        ) : checking ? (
          <p className="loading" role="status">
            Checking your session…
          </p>
        ) : sessionUnavailable && !session ? (
          <div className="auth card"><h1>Reconnect to your workspace</h1><p>Your saved sign-in could not be checked. You do not need to request another email.</p><button onClick={()=>{setChecking(true);void loadSession();}}>Try saved sign-in again</button></div>
        ) : !session ? (
          <form className="auth card" onSubmit={login}>
            <p className="eyebrow">Welcome back</p>
            <h1>One place for your work.</h1>
            <p>
              No password is needed. We’ll email you a sign-in link. Open it in this browser. Your verified email opens the companies you have permission to manage.
            </p>
            <p>On this device, your sign-in renews automatically as you use the workspace. Sign out when using a shared device.</p>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {sent && (
              <>
                <p>Open the newest email link in this browser. If the email contains a code instead, enter it below.</p>
                <label htmlFor="code">Email code (if provided)</label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </>
            )}
            <div className="actions">
              <button disabled={pending}>
                {pending
                  ? "Please wait…"
                  : sent
                    ? "Sign in"
                    : "Email me a sign-in link"}
              </button>
              {sent && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setSent(false);
                    setCode("");
                  }}
                >
                  Request another email
                </button>
              )}
            </div>
          </form>
        ) : (
          <>
            <p className="eyebrow">{session.email}</p>
            {!session.memberships.length ? (
              <OwnerSetup onComplete={loadSession}/>
            ) : (
              <>
                <label htmlFor="company">Company</label>
                <select
                  id="company"
                  value={org}
                  onChange={(e) => {
                    setOrg(e.target.value);
                    reloadSequence.current++;
                    retryKeys.current.clear();
                    setData(null);
                    setMessage("");
                  }}
                >
                  {session.memberships.map((m) => (
                    <option key={m.organization_id} value={m.organization_id}>
                      {data?.company.id === m.organization_id
                        ? data.company.display_name
                        : m.organization_id}{" "}
                      · {m.role}
                    </option>
                  ))}
                </select>
                {!data && (
                  <div className="card">
                    <h2>Open your workspace</h2>
                    <p>Your email sign-in is complete. If your workspace has not loaded, try again.</p>
                    <button disabled={pending} onClick={() => void refresh()}>Reload workspace</button>
                  </div>
                )}
                {data && (
                  <>
                    <nav className="nav" aria-label="Workspace">
                      {["Today", "Customers", "Work", "Money", "More"].map(
                        (s) => (
                          <button
                            key={s}
                            aria-current={section === s ? "page" : undefined}
                            onClick={() => setSection(s)}
                          >
                            {s}
                          </button>
                        ),
                      )}
                    </nav>
                    <div className="list-heading">
                      <h1>
                        {section === "Today" ? "A clear next step." : section}
                      </h1>
                      <button
                        className="secondary"
                        onClick={() => void refresh()}
                      >
                        Refresh
                      </button>
                    </div>
                    <div className="actions" aria-label="Record pages"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous records</button><span>Page {page+1}. Agenda shows appointments from the last day onward.</span><button disabled={!data.pagination.hasMore} onClick={()=>setPage(p=>p+1)}>Next records</button></div>
                    {section === "More" && ['owner','admin'].includes(role||'') && <CalendarBlocks organization={org} timezone={data.company.timezone}/> }
                    {section === "More" && ['owner','admin'].includes(role||'') && <CompanySettingsPanel organization={org} name={data.company.display_name}/>}
                    {['Today','Work'].includes(section)&&data.schedulingPreferences.length>0&&<section className="card" aria-labelledby="reschedule-heading"><h2 id="reschedule-heading">Customers requesting another time</h2>{data.schedulingPreferences.map(p=><article key={p.id} className="card"><p><strong>{data.requests.find(r=>r.id===p.request_id)?.original_submission.name||'Service request'}</strong></p><p>{p.preferred_local_start?.replace('T',' at ')} {p.preferred_local_start&&`(${p.timezone})`}</p><p>{p.note}</p><p className="note">Review this on the same request. A confirmed original stays booked until you approve its replacement.</p><button type="button" className="secondary" onClick={()=>{window.location.assign('/?request='+encodeURIComponent(p.request_id));}}>Open service request</button></article>)}</section>}
                    {section === "Today" && (
                      <>
                        <p className="muted">
                          {new Intl.DateTimeFormat("en-US", {
                            dateStyle: "full",
                            timeZone: data.company.timezone,
                          }).format(new Date())}
                        </p>
                        <div className="grid">
                          <div className="card">
                            <p className="eyebrow">Requests to review</p>
                            <div className="amount">
                              {
                                data.requests.filter((r) =>
                                  ["submitted", "reviewing"].includes(r.status),
                                ).length
                              }
                            </div>
                            <p>
                              Open each request, check scope and reply with the
                              next step.
                            </p>
                            <button onClick={() => setSection("Work")}>
                              Review requests
                            </button>
                          </div>
                          <div className="card">
                            <p className="eyebrow">Outstanding in this view</p>
                            <div className="amount">
                              {usd(
                                data.invoices.reduce(
                                  (n, i) =>
                                    n +
                                    i.total_cents -
                                    i.payments.reduce((s, p) => s + p.cents, 0),
                                  0,
                                ),
                              )}
                            </div>
                            <p>
                              Calculated from issued invoices and confirmed
                              receipts shown here.
                            </p>
                            <button onClick={() => setSection("Money")}>
                              View invoices
                            </button>
                          </div>
                        </div>
                        <div className="card">
                          <h2>Delivery needs attention</h2>
                          {data.outbox.length ? (
                            data.outbox.map((o) => (
                              <div className="row" key={o.id}>
                                <strong>{o.kind.replaceAll(".", " · ")}</strong>{" "}
                                <span className="badge">
                                  {o.status.replaceAll("_", " ")}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p>No queued communications are visible.</p>
                          )}
                          <p className="note">
                            Notification delivery remains inactive until the
                            Gmail connection and worker are tested.
                          </p>
                        </div>
                      </>
                    )}
                    {(section === "Today" || section === "Work") && (
                      <section aria-labelledby="appointment-heading">
                        <h2 id="appointment-heading">Appointments and proposed times</h2>
                        {["owner","admin"].includes(role || "") && <AvailabilityPanel organization={org}/>}
                        {!data.appointments.length && <div className="card"><p>No appointments are available in this view. Customer booking will open after scheduling setup and calendar checks are verified.</p></div>}
                        {data.appointments.map(a => {
                          const request = data.requests.find(r => r.id === a.request_id);
                          const date = (value:string) => new Intl.DateTimeFormat("en-US", {timeZone:data.company.timezone, dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
                          return <article className="card" key={a.id}>
                            <span className="badge">{a.status === "proposal" ? "Awaiting owner approval" : a.status === "reserved" ? "Confirmed appointment" : a.status.replaceAll("_"," ")}</span>
                            <h3>{request?.original_submission.name || "Service appointment"}</h3>
                            <p>{request ? requestServices(request).join(', ') : 'Service'}<br/>{request?.original_submission.street}, {request?.original_submission.city}</p>
                            <p><strong>Customer arrival:</strong> {date(a.arrival_at)}<br/><strong>Reserved work time:</strong> {date(a.start_at)} – {date(a.end_at)}<br/>{data.company.timezone}</p>
                            {a.expires_at && ["held","proposal"].includes(a.status) && <p>Decision deadline: {date(a.expires_at)}</p>}
                            {a.replaces_id && <p className="note">This is a proposed replacement. The original appointment remains booked until this replacement is approved.</p>}
                            {a.status === "reserved" && <p>Customer response: {a.customer_response === "awaiting" ? "Not yet reconfirmed. Appointment remains booked." : a.customer_response.replaceAll("_"," ")}</p>}
                            {a.status === "proposal" && ["owner","admin"].includes(role || "") && <>
                              <SchedulingReviewPanel organization={org} requestId={a.request_id} appointmentId={a.id} completed={()=>void refresh()}/>
                              <form onSubmit={e => {e.preventDefault();const fields = new FormData(e.currentTarget);void decideTime({action:fields.get("decision"),id:a.id,revision:a.revision,reason:fields.get("reason")});}}>
                                <label>Decision<select name="decision"><option value="decline_time">Decline this time — keep the request</option><option value="decline_service">Decline the service — do not invite another time</option></select></label>
                                <label>Reason<textarea name="reason" required minLength={2} maxLength={1000}/></label>
                                <div className="actions"><button disabled={pending}>Save decline decision</button></div>
                              </form>
                            </>}
                          </article>;
                        })}
                      </section>
                    )}
                    {section === "Customers" && (
                      <div className="card">
                        <h2>Customer relationships</h2>
                        {data.customers.length ? (
                          data.customers.map((c) => (
                            <div className="row" key={c.id}>
                              <strong>{c.display_name}</strong>{["owner","admin"].includes(role||"")&&<CustomerInvite organization={org} customer={c.id}/>}
                              <p className="tiny muted">{c.id}</p>{["owner","admin"].includes(role||"")&&<RelationshipNotes organization={org} type="customer" target={c.id} timezone={data.company.timezone}/>}
                            </div>
                          ))
                        ) : (
                          <p>
                            No customer records yet. Reviewing and publishing a
                            quote can create an explicitly linked customer
                            record.
                          </p>
                        )}
                        <p className="muted">
                          Showing up to 50 authorized records.
                        </p>
                      </div>
                    )}
                    {section === "Work" && (
                      <>
                        <h2>Service requests</h2>
                        {!data.requests.length && (
                          <div className="card">
                            <p>
                              No requests in this workspace yet. Public requests
                              continue through the existing website until the
                              CRM intake switch is enabled.
                            </p>
                          </div>
                        )}
                        {data.requests.map((r) => (
                          <article className="card" key={r.id} id={"request-"+r.id}>
                            <span className="badge">{r.status}</span>
                            <h2>{r.original_submission.name}</h2>
                            <p>
                              <strong>Requested work</strong><br/>
                              {requestServices(r).map((item, index) => <span key={index}>{item}<br/></span>)}
                            </p>
                            <p>{r.original_submission.description}</p>
                            <p>
                              {r.original_submission.street},{" "}
                              {r.original_submission.city}
                            </p>
                            <div className="actions">
                              <a href={`tel:${r.original_submission.phone}`}>
                                Call {r.original_submission.phone}
                              </a>
                              <a href={`mailto:${r.original_submission.email}`}>
                                Email customer
                              </a>
                            </div>
                            {["owner","admin"].includes(role||"")&&<RelationshipNotes organization={org} type="request" target={r.id} timezone={data.company.timezone}/>}
                            {operational && r.status === "submitted" && (
                              <div className="actions">
                                <button
                                  disabled={pending}
                                  onClick={() =>
                                    void act({
                                      command: "ReviewRequest",
                                      id: r.id,
                                      revision: r.revision,
                                      status: "reviewing",
                                    })
                                  }
                                >
                                  Start review
                                </button>
                              </div>
                            )}
                            {operational &&
                              ["reviewing", "quoted"].includes(r.status) && (
                                <QuoteForm
                                  request={r}
                                  pending={pending}
                                  submit={act}
                                />
                              )}
                            {["owner","admin"].includes(role || "") && ["reviewing","quoted"].includes(r.status) && <SchedulingReviewPanel organization={org} requestId={r.id} completed={()=>void refresh()}/>}
                          </article>
                        ))}
                        <h2>Quotes and approvals</h2>
                        {data.quotes.length ? (
                          data.quotes.map((q) => {
                            const v = q.quote_versions.find(
                              (v) => v.version === q.current_version,
                            );
                            return (
                              <article className="card" key={q.id}>
                                <span className="badge">
                                  {q.status} · Version {q.current_version}
                                </span>
                                <h3>{customerName(q.customer_id)}</h3>
                                <p>{v?.scope}</p>
                                <p className="amount">
                                  {usd(v?.labor_cents || 0)}
                                </p>
                                <p>
                                  Approved hourly labor · {v?.duration_minutes}{" "}
                                  minutes. Separate costs require separate
                                  approval.
                                </p>
                                {["owner", "admin"].includes(role || "") &&
                                  q.status === "sent" && (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        const f = new FormData(e.currentTarget);
                                        void act({
                                          command: "ApproveQuote",
                                          id: q.id,
                                          version: q.current_version,
                                          evidence: f.get("evidence"),
                                        });
                                      }}
                                    >
                                      <label>
                                        Record the customer's actual approval
                                        <input
                                          name="evidence"
                                          minLength={10}
                                          maxLength={2000}
                                          required
                                          placeholder="Who approved, when and how"
                                        />
                                      </label>
                                      <div className="actions">
                                        <button disabled={pending}>
                                          Record approval
                                        </button>
                                      </div>
                                    </form>
                                  )}
                              </article>
                            );
                          })
                        ) : (
                          <p>No quotes yet.</p>
                        )}
                        <h2>Jobs</h2>
                        {data.jobs.map((j) => (
                          <article className="card" key={j.id}>
                            <span className="badge">
                              {j.status.replaceAll("_", " ")}
                            </span>
                            <h3>{customerName(j.customer_id)}</h3>
                            {data.features?.productionWorkflows&&['owner','admin','technician'].includes(role||'') && <div className="actions">
                              {['approved','scheduled','en_route','arrived'].includes(j.status)&&<button disabled={pending} onClick={()=>void fieldAction(j,'start')}>Start work</button>}
                              {j.status==='working'&&<button disabled={pending} onClick={()=>void fieldAction(j,'pause')}>Pause work</button>}
                              {j.status==='paused'&&<button disabled={pending} onClick={()=>void fieldAction(j,'resume')}>Resume work</button>}
                            </div>}
                            {["working","paused"].includes(j.status)&&["owner","admin"].includes(role||"")&&<InvoiceDraft organization={org} job={j.id} revision={j.revision} saved={()=>void refresh()}/>}
                            {["working", "paused"].includes(j.status) &&
                            ["owner", "admin"].includes(role || "") ? (
                              <button
                                disabled={pending}
                                onClick={() =>
                                  void act({
                                    command: "CompleteAndInvoice",
                                    id: j.id,
                                    revision: j.revision,
                                  })
                                }
                              >
                                Complete &amp; Invoice
                              </button>
                            ) : (
                              <p>
                                Scheduling and field actions are being
                                integrated. This record has not been marked as
                                completed.
                              </p>
                            )}
                          </article>
                        ))}
                      </>
                    )}
                    {section === "Money" && (
                      <>
                        <p>
                          Issued amounts remain fixed. Payment status comes from
                          confirmed receipts.
                        </p>
                        {!data.invoices.length && (
                          <div className="card">
                            <h2>No issued invoices</h2>
                            <p>
                              Complete approved work to create an invoice after
                              seller identity, payment terms and tax treatment
                              are configured.
                            </p>
                          </div>
                        )}
                        {data.invoices.map((i) => {
                          const balance =
                            i.total_cents -
                            i.payments.reduce((n, p) => n + p.cents, 0);
                          return (
                            <article className="card" key={i.id}>
                              <span className="badge">
                                {i.total_cents === 0
                                  ? "No charge"
                                  : balance === 0
                                  ? "Paid"
                                  : balance < i.total_cents
                                    ? "Partially paid"
                                    : "Unpaid"}
                              </span>
                              <h2>Invoice {i.number}</h2>
                              <p className="amount">
                                {usd(balance)} outstanding
                              </p>
                              <p>Issued total {usd(i.total_cents)}</p>
                              {finance && balance > 0 && (
                                <PaymentForm
                                  invoice={i}
                                  pending={pending}
                                  submit={act}
                                />
                              )}
                            </article>
                          );
                        })}
                      </>
                    )}
                    {section === "More" && (
                      <>
                      {["owner","admin"].includes(role||"")&&<GoogleControls key={org} organization={org}/>}
                      <div className="card">
                        <h2>Company readiness</h2>
                        <p className="badge">{data.company.status}</p>
                        <p>Timezone: {data.company.timezone}</p>
                        <p>
                          This staged build has database request, quote, invoice
                          and confirmed-payment commands. It has not passed the
                          full operating release gates.
                        </p>
                        <ul>
                          <li>
                            Verify seller identity, compliance, tax treatment
                            and invoice terms.
                          </li>
                          <li>Set travel buffer, holidays and territory.</li>
                          <li>
                            Connect and test Gmail, auth email and Google
                            Calendar.
                          </li>
                          <li>
                            Verify backup restoration, native devices and
                            operator usability.
                          </li>
                        </ul>
                        <p>
                          No review destination has been activated. No customer
                          emails are sent by this screen.
                        </p>
                      </div></>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="error card">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="note">
            {message}
          </p>
        )}
      </main>
    </>
  );
}
function QuoteForm({
  request,
  pending,
  submit,
}: {
  request: RequestRecord;
  pending: boolean;
  submit: (v: Record<string, unknown>) => Promise<unknown>;
}) {
  return (
    <details>
      <summary>Prepare an hourly quote</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void submit({
            command: "PublishQuote",
            id: request.id,
            revision: request.revision,
            scope: f.get("scope"),
            minutes: Number(f.get("minutes")),
            community: f.get("community") === "on",
            eligibilityReviewed: f.get("reviewed") === "on",
            customerId: null,
          });
        }}
      >
        <label>
          Exact scope
          <textarea
            name="scope"
            required
            minLength={10}
            maxLength={5000}
            defaultValue={[...requestServices(request), request.original_submission.description || ''].filter(Boolean).join('\n')}
          />
        </label>
        <label>
          Approved duration
          <select name="minutes">
            <option value="120">2 hours</option>
            <option value="150">2½ hours</option>
            <option value="180">3 hours</option>
            <option value="210">3½ hours</option>
            <option value="240">4 hours</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" name="community" />
          Community Rate
        </label>
        <label className="check">
          <input type="checkbox" name="reviewed" />
          Customer eligibility reviewed
        </label>
        <p>
          Publishing creates a new immutable quote version. It does not send an
          email or schedule the job.
        </p>
        <button disabled={pending}>Publish quote version</button>
      </form>
    </details>
  );
}
function PaymentForm({
  invoice,
  pending,
  submit,
}: {
  invoice: Invoice;
  pending: boolean;
  submit: (v: Record<string, unknown>) => Promise<unknown>;
}) {
  const [key] = useState(() => crypto.randomUUID());
  return (
    <details>
      <summary>Record a received payment</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            amount = String(f.get("amount"));
          if (!/^\d+(\.\d{1,2})?$/.test(amount)) return;
          const [whole, fraction = ""] = amount.split(".");
          const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
          void submit({
            command: "RecordPayment",
            key,
            id: invoice.id,
            cents,
            method: f.get("method"),
            reference: f.get("reference"),
            receivedAt: new Date(String(f.get("receivedAt"))).toISOString(),
            confirmed: true,
          });
        }}
      >
        <label>
          Amount received (USD)
          <input
            name="amount"
            inputMode="decimal"
            pattern="[0-9]+(\.[0-9]{1,2})?"
            required
          />
        </label>
        <label>
          Method
          <select name="method">
            <option value="cash">Cash</option>
            <option value="zelle">Zelle</option>
          </select>
        </label>
        <label>
          Received at
          <input name="receivedAt" type="datetime-local" required />
        </label>
        <label>
          Receipt reference
          <input name="reference" maxLength={300} required />
        </label>
        <label className="check">
          <input type="checkbox" required />I confirmed the money was received.
        </label>
        <button disabled={pending}>Record confirmed payment</button>
      </form>
    </details>
  );
}
