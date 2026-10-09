"use client";
import {paymentInput} from '../lib/payment-input';
import {ownerRequestContext} from '../lib/email-links';
import { publicError } from "../lib/public-errors";
import {companyTheme} from "../lib/company-brand";
import Icon from './crm-icons';
import CommandCenter from './command-center';
import RequestInbox from './request-inbox';
import RequestDetail from './request-detail';
import NotificationAttention from "./notification-attention";
import OwnerSecurity from './owner-security';
import BusinessSnapshot from './business-snapshot';
import FinanceActivity from './finance-activity';
import GoogleControls from './google-controls';
import OwnerSetup from './owner-setup';
import InvoiceDraft from './invoice-draft';
import InvoiceDelivery from './invoice-delivery';
import CustomerInvite from './customer-invite';
import RelationshipNotes from './relationship-notes';
import CalendarBlocks from './calendar-blocks';
import MonthCalendar from './month-calendar';
import SchedulingReadiness from './scheduling-readiness';
import CompanySettingsPanel from './company-settings';
import DailyCallSheet from './day-plan';
import AvailabilityPanel from './availability-panel';
import SchedulingReviewPanel from './scheduling-review-panel';
import {sessionFetch,SessionApiError} from '../lib/session-fetch';
import { useEffect, useRef, useState, type FormEvent } from "react";
type Membership = { organization_id: string; role: string };
const loginBrand = process.env.NEXT_PUBLIC_LOGIN_BRAND || "Your Neighborhood Service Guy";
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
  invoices: {id:string;number:number}[];
  customer_id: string;
  quote_id: string;
  status: string;
  revision: number;
};
type Invoice = {
  id: string;
  job_id: string;
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
  brand: {navy:string;forest:string;gold:string;cream:string}|null;
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
export default function Workspace({ configured, initialEmail = "", ownerGoogle }: { configured: boolean; initialEmail?: string; ownerGoogle?: {enabled:boolean} }) {
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const reloadSequence = useRef(0);
  const sessionSequence = useRef(0);
  const handledRequestLink=useRef(false),initialWorkspaceChosen=useRef(false);
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
    [useEmailCode, setUseEmailCode] = useState(false),
    [pending, setPending] = useState(false);
  const [org, setOrg] = useState(""),
    [data, setData] = useState<Data | null>(null),
    [section, setSection] = useState("Dashboard");
  const [page,setPage]=useState(0);
  const [isMobile,setIsMobile]=useState(false);
  useEffect(()=>{const query=window.matchMedia('(max-width:760px)');const change=()=>setIsMobile(query.matches);change();query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
  const [activeRequest,setActiveRequest]=useState<string|null>(null);
  const [mobileNav,setMobileNav]=useState(false);
  const [workRequest,setWorkRequest]=useState<string|null>(null);
  const sections=[{key:'Dashboard',label:'Overview',icon:'dashboard'},{key:'Requests',label:'Requests',icon:'inbox'},{key:'Calendar',label:'Calendar',icon:'calendar'},{key:'Today',label:'Today’s route',icon:'pin'},{key:'Customers',label:'Customers',icon:'users'},{key:'Work',label:'Quotes & jobs',icon:'work'},{key:'Money',label:'Invoices & money',icon:'money'},{key:'Snapshot',label:'Reports',icon:'chart'},{key:'Activity',label:'Activity & messages',icon:'bell'},{key:'Settings',label:'Settings',icon:'settings'}];
  const primarySections=sections.filter(s=>['Dashboard','Requests','Calendar','Work','Money'].includes(s.key));
  const secondarySections=sections.filter(s=>['Today','Customers','Snapshot','Activity','Settings'].includes(s.key));
  const canSeeSection=(s:{key:string})=>['owner','admin'].includes(role||'')||(role==='dispatcher'?['Requests','Customers','Work','Today'].includes(s.key):role==='bookkeeper'?['Customers','Money'].includes(s.key):['Today','Work'].includes(s.key));
  function navigate(next:string){setPage(0);setMessage('');setError('');setSection(next);setMobileNav(false);if(next!=='Work'){setWorkRequest(null);const url=new URL(window.location.href);url.searchParams.delete('request');window.history.replaceState(null,'',url);}}
  function openWork(id:string){setActiveRequest(null);setWorkRequest(id);const url=new URL(window.location.href);url.searchParams.set('request',id);window.history.replaceState(null,'',url);setSection('Work');setPage(0);void refresh();}

  async function loadSession() {
    const sequence=++sessionSequence.current;
    try {
      const s = await api("/api/session");
      if(sequence!==sessionSequence.current)return;
      setSessionUnavailable(false);
      setError(previous=>previous.startsWith('We could not check your saved sign-in.')?'':previous);
      if(!initialWorkspaceChosen.current){initialWorkspaceChosen.current=true;const initial=s.memberships.find((m:Membership)=>m.organization_id===org)||s.memberships[0];if(initial?.role==='technician')setSection('Today');else if(initial?.role==='bookkeeper')setSection('Money');else if(initial?.role==='dispatcher')setSection('Requests');}
      setSession(s);
      setMessage("");setSent(false);setCode("");setUseEmailCode(false);
      const locationParams = new URLSearchParams(window.location.search);
      const googleOrg = locationParams.get('googleOrganization') || locationParams.get('organization');
      setOrg((o: string) => o || s.memberships.find((m: Membership)=>m.organization_id===googleOrg)?.organization_id || s.memberships[0]?.organization_id || "");
      if(new URLSearchParams(window.location.search).has('google'))setSection('Settings');
      const linkedRequest=new URLSearchParams(window.location.search).get('request');if(linkedRequest&&!handledRequestLink.current){handledRequestLink.current=true;setSection('Requests');setActiveRequest(linkedRequest);}
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
    if(new URLSearchParams(window.location.search).get("setup")==="google")setSection("Settings");
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
        setError(publicError(e));
      }
    }
  }
  useEffect(() => {
    setData(null);
    if (org) void refresh(org);
  }, [org,page]);
  async function login(event: FormEvent) {
    event.preventDefault();
    if (sent && useEmailCode && !/^\d{6,10}$/.test(code.trim())) {
      setError("Enter the numeric code from your email. A sign-in link should be opened in this browser.");
      return;
    }
    setPending(true);
    setError("");
    try {
      if (sent && !useEmailCode) {
        await loadSession();
      } else if (sent) {
        await api("/api/session", { action: "verify", email, code: code.trim() });
        await loadSession();
      } else {
        const r = await api("/api/session", { action: "send", email, destination: "owner",requestContext:ownerRequestContext(Object.fromEntries(new URLSearchParams(window.location.search)))||undefined });
        setSent(true);setUseEmailCode(false);setCode("");
        setMessage(r.message);
      }
    } catch (e) {
      setError(publicError(e));
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
      setError(publicError(e));
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
      setError(publicError(e));
    } finally {
      setPending(false);
    }
  }
  async function fieldAction(j:Job,action:'start'|'pause'|'resume') {
    setPending(true);setError('');const value={organizationId:org,id:j.id,revision:j.revision,action,note:''};const fingerprint=JSON.stringify(value);
    if(!retryKeys.current.has(fingerprint))retryKeys.current.set(fingerprint,crypto.randomUUID());
    try{await api('/api/jobs',{...value,key:retryKeys.current.get(fingerprint)});setMessage('Job and time record saved.');await refresh();}catch(e){setError(publicError(e));}finally{setPending(false);}
  }
  const role = session?.memberships.find(
    (m) => m.organization_id === org,
  )?.role;
  const operational = ["owner", "admin", "dispatcher"].includes(role || "");
  const finance = ["owner", "admin", "bookkeeper"].includes(role || "");
  const customerName = (id: string) =>
    data?.customers.find((c) => c.id === id)?.display_name || "Customer record";
  return (
    <div className={`company-workspace${session ? "" : " signed-out"}`} style={companyTheme(data?.brand)}>
      {session&&data&&<aside className={'crm-sidebar'+(mobileNav?' is-open':'')} aria-label="Business navigation" inert={isMobile&&!mobileNav}>
        <a className="sidebar-brand" href="/" onClick={e=>{e.preventDefault();navigate(role==='technician'?'Today':role==='bookkeeper'?'Money':role==='dispatcher'?'Requests':'Dashboard');}}>{/your neighborhood service guy/i.test(data.company.display_name)?<img src="/brand/ynsg-logo.jpg" alt="Your Neighborhood Service Guy — Home & Yard"/>:<span className="company-mark"><Icon name="leaf"/>{data.company.display_name}</span>}</a>
        <p className="sidebar-caption">Your business workspace</p>
        <nav aria-label="Workspace"><p className="nav-group-label">Workflow</p>{primarySections.filter(canSeeSection).map(s=><button key={s.key} aria-current={section===s.key?'page':undefined} onClick={()=>navigate(s.key)}><Icon name={s.icon}/><span>{s.label}</span>{s.key==='Requests'&&data.requests.some(r=>r.status==='submitted')&&<i className="nav-attention" aria-label="New requests"/>}</button>)}<details className="sidebar-more" open={secondarySections.some(s=>s.key===section)}><summary><Icon name="settings"/><span>More workspace</span></summary>{secondarySections.filter(canSeeSection).map(s=><button key={s.key} aria-current={section===s.key?'page':undefined} onClick={()=>navigate(s.key)}><Icon name={s.icon}/><span>{s.label}</span></button>)}</details></nav>
        <div className="sidebar-footer"><span className="sidebar-profile">{session.email.slice(0,2).toUpperCase()}</span><div><strong>{role==='owner'?'Business owner':'Team workspace'}</strong><small>{session.email}</small></div></div>
      </aside>}
      {session&&<header className="crm-topbar"><div className="topbar-context"><button className="icon-button secondary mobile-menu" aria-expanded={mobileNav} aria-label="Toggle workspace menu" onClick={()=>setMobileNav(v=>!v)}><Icon name={mobileNav?'close':'menu'}/></button><span className="context-dot"/><strong>{data?.company.display_name||'Service workspace'}</strong></div><div className="topbar-actions">{operational&&<button className="secondary" onClick={()=>navigate('Requests')}><Icon name="inbox"/><span>Requests</span></button>}{['owner','admin'].includes(role||'')&&<button className="icon-button secondary" aria-label="Activity and messages" onClick={()=>navigate('Activity')}><Icon name="bell"/></button>}<button className="icon-button secondary" aria-label="Sign out" onClick={async()=>{try{sessionSequence.current++;await api('/api/session',{action:'logout'});sessionSequence.current++;initialWorkspaceChosen.current=false;handledRequestLink.current=false;setSession(null);setSessionUnavailable(false);reloadSequence.current++;retryKeys.current.clear();setData(null);setOrg('');setEmail('');setCode('');setSent(false);setActiveRequest(null);}catch(e){setError(publicError(e));}}}><Icon name="logout"/></button></div></header>}
      {session&&data&&<nav className="crm-mobile-dock" aria-label="Quick workspace navigation">{primarySections.filter(canSeeSection).map(s=><button key={s.key} type="button" aria-current={section===s.key?'page':undefined} onClick={()=>navigate(s.key)}><Icon name={s.icon}/><span>{s.label}</span>{s.key==='Requests'&&data.requests.some(r=>r.status==='submitted')&&<i className="dock-attention" aria-label="New requests"/>}</button>)}</nav>}
      <main className={`shell${session?' workspace-main':''}`} id="main">

        <div className="workspace-feedback">
          {error && <p role="alert" className="error card">{error}</p>}
          {message && <p role="status" className="note">{message}</p>}
        </div>
        {!configured ? (
          <div className="auth card">
            <p className="eyebrow">Workspace setup</p>
            <h1>A careful start.</h1>
            <p>
              The business workspace connection has not been set up
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
            <p className="eyebrow">{loginBrand}</p>
            <h1>Sign in to your workspace</h1>
            <p>Enter your email and we’ll send you a secure sign-in link. Open the newest link in this same browser to continue.</p>
            {ownerGoogle?.enabled && <div>
              <button type="button" disabled={pending} onClick={async()=>{
                setPending(true);setError("");
                try{const result=await api("/api/owner-google",{requestContext:ownerRequestContext(Object.fromEntries(new URLSearchParams(window.location.search)))||undefined});window.location.assign(result.url);}
                catch(e){setError(publicError(e));setPending(false);}
              }}>Continue with Google</button>
            </div>}
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={pending || sent}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {sent && <div><h2>Check your email</h2><p>Open the newest sign-in link in the same browser where you requested it. If your mail app opens another browser, use that browser to request a fresh link.</p></div>}
            {sent && useEmailCode && (
              <>
                <label htmlFor="code">Email code (if provided)</label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6,10}"
                  minLength={6}
                  maxLength={10}
                  disabled={pending}
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
                    ? useEmailCode ? "Sign in with code" : "Check sign-in"
                    : "Email me a sign-in link"}
              </button>
              {sent && !useEmailCode && <button type="button" className="secondary" disabled={pending} onClick={()=>setUseEmailCode(true)}>My email includes a code</button>}
              {sent && (
                <button
                  type="button"
                  className="secondary"
                  disabled={pending}
                  onClick={() => {
                    setSent(false);setUseEmailCode(false);setMessage("");setError("");
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

            {!session.memberships.length ? (
              <OwnerSetup onComplete={loadSession}/>
            ) : (
              <>
                <div className="company-switcher" hidden={session.memberships.length===1}><label htmlFor="company">Switch business</label>
                <select
                  id="company"
                  value={org}
                  onChange={(e) => {
                    setOrg(e.target.value);const nextRole=session.memberships.find(m=>m.organization_id===e.target.value)?.role;setSection(nextRole==='technician'?'Today':nextRole==='bookkeeper'?'Money':nextRole==='dispatcher'?'Requests':'Dashboard');setActiveRequest(null);setWorkRequest(null);setMobileNav(false);const url=new URL(window.location.href);url.searchParams.delete('request');window.history.replaceState(null,'',url);
                    setPage(0);
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
                        : `Business ${session.memberships.indexOf(m) + 1}`}{" "}
                      · {m.role}
                    </option>
                  ))}
                </select></div>
                {!data && (
                  <div className="card">
                    <h2>Open your workspace</h2>
                    <p>Your email sign-in is complete. If your workspace has not loaded, try again.</p>
                    <button disabled={pending} onClick={() => void refresh()}>Reload workspace</button>
                  </div>
                )}
                {data && (
                  <>
                    <div className="list-heading">
                      <h1>
                        {section==='Dashboard'?'Your day, in focus.':sections.find(s=>s.key===section)?.label||section}
                      </h1>
                      <div className="heading-actions"><span className="tiny">{new Intl.DateTimeFormat('en-US',{timeZone:data.company.timezone,dateStyle:'full'}).format(new Date())}</span><button className="secondary" onClick={()=>void refresh()}><Icon name="refresh"/>Refresh</button></div>
                    </div>
                    {["Customers","Work","Money"].includes(section) && <div className="actions" aria-label="Record pages"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous records</button><span>Page {page+1} · 50 records per page</span><button disabled={!data.pagination.hasMore} onClick={()=>setPage(p=>p+1)}>Next records</button></div>}
                    {section==='Dashboard'&&['owner','admin'].includes(role||'')&&<section className="workflow-guide card" aria-labelledby="workflow-guide-heading"><div><p className="eyebrow">One clear path</p><h2 id="workflow-guide-heading">Run the business in order</h2><p>Start with a request and move left to right. Each step opens the records needed for the next decision.</p></div><div className="workflow-steps" aria-label="Service workflow"><button onClick={()=>navigate('Requests')}><Icon name="inbox"/><span>Requests</span></button><span aria-hidden="true">→</span><button onClick={()=>navigate('Calendar')}><Icon name="calendar"/><span>Schedule</span></button><span aria-hidden="true">→</span><button onClick={()=>navigate('Work')}><Icon name="work"/><span>Work</span></button><span aria-hidden="true">→</span><button onClick={()=>navigate('Money')}><Icon name="money"/><span>Invoice &amp; paid</span></button></div></section>}
                    {section==='Dashboard'&&['owner','admin'].includes(role||'')&&<CommandCenter organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onOpen={setActiveRequest} onNavigate={navigate}/>}
                    {section==='Requests'&&operational&&<RequestInbox key={org} organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onOpen={setActiveRequest}/>}
                    {section==='Activity'&&['owner','admin'].includes(role||'')&&<NotificationAttention organization={org}/>}
                    {section === "Snapshot" && ["owner","admin"].includes(role||"") && <BusinessSnapshot key={org} organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onOpen={s=>navigate(s==='Work'?'Requests':s)}/>}
                    {section === "Calendar" && ['owner','admin'].includes(role||'') && <>
                      <div className="calendar-inbox-link"><div><strong>New requests start in your inbox.</strong><span>Review proposed times here; schedule requests without a time from Requests.</span></div><button className="secondary" onClick={()=>navigate('Requests')}><Icon name="inbox"/>Open requests</button></div><MonthCalendar key={org} organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onOpen={setActiveRequest}/>
                    </>}
                    {section === "Settings" && ['owner','admin'].includes(role||'') && <>
                      <GoogleControls key={org} organization={org} view="settings"/>
                      <OwnerSecurity key={org} organization={org}/>
                    </>}
                    {section === "Settings" && ['owner','admin'].includes(role||'') && <SchedulingReadiness organization={org}/>}
                    {section === "Settings" && ['owner','admin'].includes(role||'') && <CompanySettingsPanel organization={org} name={data.company.display_name}/>}
                    {['Today','Calendar'].includes(section)&&data.schedulingPreferences.length>0&&<section className="card" aria-labelledby="reschedule-heading"><h2 id="reschedule-heading">Customers requesting another time</h2>{data.schedulingPreferences.map(p=><article key={p.id} className="card"><p><strong>{data.requests.find(r=>r.id===p.request_id)?.original_submission.name||'Service request'}</strong></p><p>{p.preferred_local_start?.replace('T',' at ')} {p.preferred_local_start&&`(${p.timezone})`}</p><p>{p.note}</p><p className="note">Review this on the same request. A confirmed original stays booked until you approve its replacement.</p><button type="button" className="secondary" onClick={()=>{setActiveRequest(p.request_id);}}>Open service request</button></article>)}</section>}
                    {section === "Today" && ['owner','admin'].includes(role||'') && <DailyCallSheet key={org} organization={org} timezone={data.company.timezone}/>}
                    {section === "Calendar" && ["owner","admin"].includes(role||"") && <details className="card calendar-block-tools"><summary>Block personal or unavailable time</summary><CalendarBlocks key={org} organization={org} timezone={data.company.timezone} onChanged={()=>void refresh()}/></details>}
                    {section === "Customers" && (
                      <div className="card">
                        <h2>Customer relationships</h2>
                        {data.customers.length ? (
                          data.customers.map((c) => (
                            <div className="row" key={c.id}>
                              <strong>{c.display_name}</strong>{["owner","admin"].includes(role||"")&&<CustomerInvite organization={org} customer={c.id}/>}
                              {["owner","admin"].includes(role||"")&&<RelationshipNotes organization={org} type="customer" target={c.id} timezone={data.company.timezone}/>}
                            </div>
                          ))
                        ) : (
                          <p>
                            No customers on this page yet. Customer records appear when a service request is linked to a customer.
                          </p>
                        )}
                        <p className="muted">
                          Showing up to 50 customers on this page.
                        </p>
                      </div>
                    )}
                    {section === "Work" && (
                      <>
                        {new URLSearchParams(window.location.search).has('request') && <div className="note"><p>You’re viewing the request opened from your link.</p><button type="button" className="secondary" onClick={()=>{const url=new URL(window.location.href);url.searchParams.delete('request');window.history.replaceState(null,'',url);setWorkRequest(null);setPage(0);void refresh();}}>Show all service requests</button></div>}
                        <div className="work-context-bar"><div><p className="eyebrow">Connected service workflow</p><p>{workRequest?'Quote and job records linked to the selected request.':'Prepare quotes, record customer approvals, work the job and review its invoice.'}</p></div><button className="secondary" onClick={()=>navigate('Requests')}><Icon name="inbox"/>Open request inbox</button></div>
                        {data.requests.filter(r=>!workRequest||r.id===workRequest).map(r=><section className="card work-request" key={r.id}><div className="section-heading"><div><span className="badge">{r.status.replaceAll('_',' ')}</span><h2>{r.original_submission.name}</h2><p>{requestServices(r).join(' · ')}</p></div><button className="secondary" onClick={()=>setActiveRequest(r.id)}>Open request details</button></div>{operational&&r.status==='submitted'&&<button disabled={pending} onClick={()=>void act({command:'ReviewRequest',id:r.id,revision:r.revision,status:'reviewing'})}>Start quote review</button>}{operational&&['reviewing','quoted'].includes(r.status)&&<QuoteForm request={r} pending={pending} submit={act}/>}</section>)}
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
                              {['approved','scheduled','en_route','arrived'].includes(j.status)&&<button disabled={pending || invoiceBusy} onClick={()=>void fieldAction(j,'start')}>Start work</button>}
                              {j.status==='working'&&<button disabled={pending || invoiceBusy} onClick={()=>void fieldAction(j,'pause')}>Pause work</button>}
                              {j.status==='paused'&&<button disabled={pending || invoiceBusy} onClick={()=>void fieldAction(j,'resume')}>Resume work</button>}
                            </div>}
                            {["working","paused","completed"].includes(j.status)&&j.invoices.length === 0&&["owner","admin"].includes(role||"")&&<InvoiceDraft organization={org} job={j.id} revision={j.revision} completed={j.status==="completed"} blocked={pending || invoiceBusy} onBusy={setInvoiceBusy} saved={()=>void refresh()}/>}
                            {["working", "paused"].includes(j.status) &&
                            ["owner", "admin"].includes(role || "") ? (
                              <button
                                disabled={pending || invoiceBusy}
                                onClick={() =>
                                  void act({
                                    command: "CompleteServiceCall",
                                    id: j.id,
                                    revision: j.revision,
                                  })
                                }
                              >
                                Complete service call
                              </button>
                            ) : (
                              <p>
                                {j.status === "completed" ? (j.invoices.length > 0 ? "Service call completed. The approved invoice is in Money." : "Service call completed. Review and approve the invoice draft when ready. Nothing has been emailed.") : j.status === "canceled" ? "This service call was canceled." : "Start work when you arrive. Complete the service call before approving its invoice."}
                              </p>
                            )}
                          </article>
                        ))}
                      </>
                    )}
                    {section === "Money" && (
                      <>
                        {finance && <FinanceActivity key={org} organization={org} companyName={data.company.display_name}/>}
                        <p>
                          Issued amounts remain fixed. Payment status comes from
                          confirmed receipts.
                        </p>
                        {!data.invoices.length && (
                          <div className="card">
                            <h2>No issued invoices</h2>
                            <p>
                              Complete approved work to create an invoice after
                              business name, payment terms and tax treatment
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
                              <a href={"/invoice?"+new URLSearchParams({organization:org,invoice:i.id})}>View / print invoice</a>
                              <p className="amount">
                                {usd(balance)} outstanding
                              </p>
                              <p>Issued total {usd(i.total_cents)}</p>
                              {["owner","admin"].includes(role||"")&&<InvoiceDelivery organization={org} invoice={i.id}/>}
                              {finance && balance > 0 && (
                                <PaymentForm
                                  invoice={i}
                                  timezone={data.company.timezone}
                                  pending={pending}
                                  submit={act}
                                />
                              )}
                            </article>
                          );
                        })}
                      </>
                    )}
                    {section === "Settings" && (
                      <>
                      <div className="card">
                        <h2>Business preferences</h2>
                        <p className="badge">{data.company.status}</p>
                        <p>Timezone: {data.company.timezone}</p>
                        <p>
                          Manage your business rules and connections here. The request inbox and calendar use these settings for the next saved decision.
                        </p>

                        <p>
                          Set your review link in the business settings below.
                          Customer messages follow your current email approval and delivery settings.
                        </p>
                      </div></>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </main>
      {session&&data&&activeRequest&&<RequestDetail key={org+activeRequest} organization={org} requestId={activeRequest} timezone={data.company.timezone} canManage={['owner','admin'].includes(role||'')} onClose={()=>{setActiveRequest(null);const url=new URL(window.location.href);url.searchParams.delete('request');window.history.replaceState(null,'',url);}} onChanged={()=>void refresh()} onWork={openWork}/>}
    </div>
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
          Publishing saves this quote as a new version. It does not send an
          email or schedule the job.
        </p>
        <button disabled={pending}>Save quote version</button>
      </form>
    </details>
  );
}
function PaymentForm({
  invoice,
  timezone,
  pending,
  submit,
}: {
  invoice: Invoice;
  timezone: string;
  pending: boolean;
  submit: (v: Record<string, unknown>) => Promise<unknown>;
}) {
  const [key,setKey] = useState(() => crypto.randomUUID());
  const [inputError,setInputError] = useState("");
  return (
    <details>
      <summary>Record a received payment</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if(pending)return;
          const form=e.currentTarget;
          setInputError("");
          try {
            const value=paymentInput(new FormData(form),timezone);
            void submit({command:"RecordPayment",key,id:invoice.id,...value,confirmed:true}).then(result=>{
              if(result){form.reset();setKey(crypto.randomUUID());}
            });
          }catch(error){setInputError(publicError(error));}
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
          Received at ({timezone})
          <input name="receivedAt" type="datetime-local" required />
        </label>
        <label>
          Receipt reference
          <input name="reference" maxLength={300} required />
        </label>
        <label className="check">
          <input type="checkbox" required />I confirmed the money was received.
        </label>
        {inputError&&<p role="alert">{inputError}</p>}
        <button disabled={pending}>Record confirmed payment</button>
      </form>
    </details>
  );
}
