"use client";
import {RetentionControls} from './privacy-controls';
import type {InvoiceCredit} from '../lib/invoice-credit-contract';
import {creditTotal} from '../lib/invoice-credit-contract';

import {invoiceNumber} from "../lib/invoice-number";
import {ownerRequestContext} from '../lib/email-links';
import { publicError } from "../lib/public-errors";
import {companyTheme} from "../lib/company-brand";
import Icon from './crm-icons';
import CommandCenter from './command-center';
import RequestInbox from './request-inbox';
import ThemeToggle from './theme-toggle';
import MobileNotifications from './mobile-notifications';
import RequestDetail from './request-detail';
import NotificationAttention from "./notification-attention";
import OwnerSecurity from './owner-security';
import BusinessSnapshot from './business-snapshot';
import FinanceActivity from './finance-activity';
import MileageActivity from './mileage-activity';
import GoogleControls from './google-controls';
import CalendarConnections from './calendar-connections';
import OwnerSetup from './owner-setup';
import ServiceWorkflow from './service-workflow';
import OwnerWork from './owner-work';
import {EntrySafety,useEntrySafety,useBlockedEntry} from './entry-safety';
import ScheduledInvoice from './scheduled-invoice';
import InvoicePayments from './invoice-payments';
import RelatedCustomerFiles from './related-customer-files';
import InvoiceDelivery from './invoice-delivery';
import CalendarBlocks from './calendar-blocks';
import RecurringVisits from './recurring-visits';
import MonthCalendar from './month-calendar';
import SchedulingReadiness from './scheduling-readiness';
import CompanySettingsPanel from './company-settings';
import OwnerLearningToolkit from './owner-learning-toolkit';
import DailyCallSheet from './day-plan';
import AvailabilityPanel from './availability-panel';
import SchedulingReviewPanel from './scheduling-review-panel';
import CustomerRecords from './customer-records';
import {sessionFetch,SessionApiError} from '../lib/session-fetch';
import { useEffect, useRef, useState, type FormEvent } from "react";
type Membership = { organization_id: string; role: string };
const loginBrand = process.env.NEXT_PUBLIC_LOGIN_BRAND || "Your Neighborhood Service Guy";
type RequestRecord = {
  id: string;
  customer_id?: string | null;
  status: string;
  revision: number;
  created_at: string;
  original_submission: {name:string;phone:string;email:string;street:string;city:string;service?:string;task?:string;description?:string;preferredTime?:string;communityRate?:string;services?:{service:string;task:string}[]};
};
type Quote = {
  id: string;
  customer_id: string;
  request_id: string;
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
  approved_version: number;
  status: string;
  revision: number;
};
type Invoice = {
  id: string;
  customer_id?: string;
  job_id: string;
  number: number;
  total_cents: number;
  issued_at: string;
  snapshot:{recipient?:{name?:string;street?:string;city?:string};scope?:string;taxCents?:number;recordedWork?:{description:string;chargedCents:number}[]};
  credits?: InvoiceCredit[];
  payments: { cents: number }[];
};
type Appointment = {
  id: string;
  job_id: string | null;
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
  invoiceAdmin:Record<string,{dueDate:string|null;archived:boolean;cardPending:boolean}>;
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
type WorkspaceProps={configured:boolean;initialEmail?:string;ownerGoogle?:{enabled:boolean}};
export default function Workspace(props:WorkspaceProps){return <EntrySafety><WorkspaceContent {...props}/></EntrySafety>;}
function WorkspaceContent({ configured, initialEmail = "", ownerGoogle }: WorkspaceProps) {
  const {canLeave}=useEntrySafety();
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const reloadSequence = useRef(0);
  const sessionSequence = useRef(0);
  const handledRequestLink=useRef(false),initialWorkspaceChosen=useRef(false);
  const [sessionUnavailable,setSessionUnavailable]=useState(false);
  const retryKeys = useRef(new Map<string, string>());
  const ownerCommandFlight = useRef(false);
  const unresolvedOwnerCommand = useRef<string|null>(null);
  const [session, setSession] = useState<{
      email: string;
      memberships: Membership[];
    } | null>(null),
    [checking, setChecking] = useState(configured),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [email, setEmail] = useState(initialEmail),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [authMode, setAuthMode] = useState<"password" | "recover">("password"),
    [sent, setSent] = useState(false),
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
  const [customerFocus,setCustomerFocus]=useState<string|null>(null);
  // A new workspace destination starts at its heading, never the previous screen's scroll.
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});document.querySelector<HTMLElement>('#main h1')?.focus({preventScroll:true});},[org,section,workRequest,customerFocus]);
  useBlockedEntry('workspace',pending||invoiceBusy);
  const sections=[{key:'Dashboard',label:'Today',icon:'dashboard'},{key:'Requests',label:'Requests',icon:'inbox'},{key:'Calendar',label:'Calendar',icon:'calendar'},{key:'Today',label:'Day routes',icon:'pin'},{key:'Customers',label:'Customers',icon:'users'},{key:'Work',label:'Jobs',icon:'work'},{key:'Money',label:'Invoices & money',icon:'money'},{key:'Snapshot',label:'Reports',icon:'chart'},{key:'Learning',label:'Field guide',icon:'book'},{key:'Activity',label:'Activity & messages',icon:'bell'},{key:'Settings',label:'Settings',icon:'settings'}];
  const primarySections=sections.filter(s=>['Dashboard','Requests','Calendar','Today','Work','Money'].includes(s.key));
  const secondarySections=sections.filter(s=>['Customers','Snapshot','Learning','Activity','Settings'].includes(s.key));
  const canSeeSection=(s:{key:string})=>['owner','admin'].includes(role||'')||(role==='dispatcher'?['Requests','Customers','Work','Today'].includes(s.key):role==='bookkeeper'?['Customers','Money'].includes(s.key):['Today','Work'].includes(s.key));
  function navigate(next:string){if(pending||invoiceBusy||!canLeave())return;setPage(0);setMessage('');setError('');setSection(next);setCustomerFocus(null);setMobileNav(false);const url=new URL(window.location.href);url.searchParams.set('section',next);url.searchParams.delete('customer');if(next!=='Work'){setWorkRequest(null);url.searchParams.delete('request');}window.history.replaceState(null,'',url);void refresh();}
  function openWork(id:string){if(pending||invoiceBusy||!canLeave())return;setActiveRequest(null);setCustomerFocus(null);setWorkRequest(id);const url=new URL(window.location.href);url.searchParams.delete('customer');url.searchParams.set('request',id);url.searchParams.set('section','Work');window.history.replaceState(null,'',url);setSection('Work');setPage(0);void refresh();}

  function openCustomer(id:string){if(pending||invoiceBusy||!canLeave())return;setCustomerFocus(id);setSection('Customers');setActiveRequest(null);setWorkRequest(null);const url=new URL(window.location.href);url.searchParams.delete('request');url.searchParams.set('section','Customers');url.searchParams.set('customer',id);window.history.replaceState(null,'',url);}

  async function loadSession() {
    const sequence=++sessionSequence.current;
    try {
      const s = await api("/api/session");
      if(sequence!==sessionSequence.current)return;
      setSessionUnavailable(false);
      setError(previous=>previous.startsWith('We could not check your saved sign-in.')?'':previous);
      if(!initialWorkspaceChosen.current){initialWorkspaceChosen.current=true;const initial=s.memberships.find((m:Membership)=>m.organization_id===org)||s.memberships[0];if(initial?.role==='technician')setSection('Today');else if(initial?.role==='bookkeeper')setSection('Money');else if(initial?.role==='dispatcher')setSection('Requests');}
      setSession(s);
      setMessage("");setSent(false);setPassword("");setShowPassword(false);
      const locationParams = new URLSearchParams(window.location.search);
      const googleOrg = locationParams.get('googleOrganization') || locationParams.get('organization');
      setOrg((o: string) => o || s.memberships.find((m: Membership)=>m.organization_id===googleOrg)?.organization_id || s.memberships[0]?.organization_id || "");
      if(new URLSearchParams(window.location.search).has('google'))setSection('Settings');
      const requestedSection=locationParams.get('section');if(requestedSection&&sections.some(x=>x.key===requestedSection))setSection(requestedSection);const linkedCustomer=locationParams.get('customer');if(requestedSection==='Customers'&&linkedCustomer&&/^[a-f0-9-]{36}$/i.test(linkedCustomer))setCustomerFocus(linkedCustomer);const linkedRequest=locationParams.get('request');if(linkedRequest&&!handledRequestLink.current){handledRequestLink.current=true;if(requestedSection==='Work'){setSection('Work');setWorkRequest(linkedRequest);}else{setSection('Requests');setActiveRequest(linkedRequest);}}
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
        if(e instanceof SessionApiError&&[401,403].includes(e.status))setData(null);
        setError('Saved records could not be refreshed. Your open entries are kept unless company access has ended. '+publicError(e));
      }
    }
  }
  useEffect(() => {
    setData(null);
    if (org) void refresh(org);
  }, [org,page]);
  async function login(event: FormEvent) {
    event.preventDefault();
    if(pending)return;
    if (authMode === "recover") {
      if (sent) return;
      setPending(true); setError("");
      try {
        const r = await api("/api/session", { action: "recover", email });
        setSent(true);
        setMessage(r.message || "Check your email for a password reset link.");
      } catch (e) { setError(publicError(e)); }
      finally { setPending(false); }
      return;
    }
    if (authMode === "password") {
      if (!password) { setError("Enter your workspace password."); return; }
      setPending(true); setError("");
      try {
        await api("/api/session", { action: "password", email, password });
        setPassword("");
        await loadSession();
      } catch (e) { setError(publicError(e)); }
      finally { setPending(false); }
      return;
    }
  }

  async function act(value: Record<string, unknown>) {
    if (ownerCommandFlight.current) return;
    const fingerprint = JSON.stringify([org, value]);
    if (unresolvedOwnerCommand.current && unresolvedOwnerCommand.current !== fingerprint) {
      setError("An earlier action is not confirmed. Check the saved request or job and retry only the exact original action before making another change.");
      return;
    }
    ownerCommandFlight.current=true;
    setPending(true);
    setError("");
    setMessage("");
    if (!retryKeys.current.has(fingerprint))
      retryKeys.current.set(fingerprint, crypto.randomUUID());
    try {
      const r = await api("/api/commands", {
        organizationId: org,
        key: retryKeys.current.get(fingerprint),
        ...value,
      });
      unresolvedOwnerCommand.current=null;
      retryKeys.current.delete(fingerprint);
      setMessage("Saved. The current record is shown below.");
      await refresh();
      return r;
    } catch (e) {
      if (e instanceof SessionApiError && [400,401,403,404,409,422].includes(e.status)) {
        unresolvedOwnerCommand.current=null;
        retryKeys.current.delete(fingerprint);
        setError(publicError(e));
      } else {
        unresolvedOwnerCommand.current=fingerprint;
        setError("The result of that action is unconfirmed. Your original retry is protected. Check the saved request or job, then retry the same unchanged action; do not submit a different one.");
      }
    } finally {
      ownerCommandFlight.current=false;
      setPending(false);
    }
  }
  async function decideTime(input: Record<string, unknown>) {
    if(ownerCommandFlight.current)return;
    const fingerprint=JSON.stringify(['schedule',org,input]);
    if(unresolvedOwnerCommand.current && unresolvedOwnerCommand.current!==fingerprint){
      setError("A prior change could not be confirmed. Check its saved result and retry only the same action first.");return;
    }
    ownerCommandFlight.current=true;setPending(true);setError("");
    if(!retryKeys.current.has(fingerprint))retryKeys.current.set(fingerprint,crypto.randomUUID());
    try{
      await api("/api/scheduling",{schemaVersion:1,organizationId:org,key:retryKeys.current.get(fingerprint),input});
      retryKeys.current.delete(fingerprint);unresolvedOwnerCommand.current=null;
      setMessage("Decision saved. Customer delivery is shown separately in the communication queue.");
      await refresh();
    }catch(e){
      if(e instanceof SessionApiError&&[400,401,403,404,409,422].includes(e.status)){
        retryKeys.current.delete(fingerprint);unresolvedOwnerCommand.current=null;setError(publicError(e));
      }else{
        unresolvedOwnerCommand.current=fingerprint;
        setError("The scheduling result is unconfirmed. Check the calendar, then retry only this unchanged decision.");
      }
    }finally{ownerCommandFlight.current=false;setPending(false);}
  }
  async function fieldAction(j:Pick<Job,'id'|'revision'>,action:'start'|'pause'|'resume') {
    if(ownerCommandFlight.current)return;
    const value={organizationId:org,id:j.id,revision:j.revision,action,note:''};
    const fingerprint=JSON.stringify(['job',value]);
    if(unresolvedOwnerCommand.current&&unresolvedOwnerCommand.current!==fingerprint){
      setError("A prior change could not be confirmed. Check its saved result and retry only the same action first.");return;
    }
    ownerCommandFlight.current=true;setPending(true);setError('');
    if(!retryKeys.current.has(fingerprint))retryKeys.current.set(fingerprint,crypto.randomUUID());
    try{
      await api('/api/jobs',{...value,key:retryKeys.current.get(fingerprint)});
      retryKeys.current.delete(fingerprint);unresolvedOwnerCommand.current=null;
      setMessage('Job and time record saved.');await refresh();
    }catch(e){
      if(e instanceof SessionApiError&&[400,401,403,404,409,422].includes(e.status)){
        retryKeys.current.delete(fingerprint);unresolvedOwnerCommand.current=null;setError(publicError(e));
      }else{
        unresolvedOwnerCommand.current=fingerprint;
        setError("The job time result is unconfirmed. Review the saved job before retrying only this unchanged action.");
      }
    }finally{ownerCommandFlight.current=false;setPending(false);}
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
        <nav aria-label="Workspace"><p className="nav-group-label">Workflow</p>{primarySections.filter(canSeeSection).map(s=><button key={s.key} aria-label={s.label} aria-current={section===s.key?'page':undefined} onClick={()=>navigate(s.key)}><Icon name={s.icon}/><span>{s.label}</span>{s.key==='Requests'&&data.requests.some(r=>r.status==='submitted')&&<i className="nav-attention" aria-label="New requests"/>}</button>)}<details className="sidebar-more" open={secondarySections.some(s=>s.key===section)}><summary><Icon name="settings"/><span>More workspace</span></summary>{secondarySections.filter(canSeeSection).map(s=><button key={s.key} aria-label={s.label} aria-current={section===s.key?'page':undefined} onClick={()=>navigate(s.key)}><Icon name={s.icon}/><span>{s.label}</span></button>)}</details></nav>
        <div className="sidebar-footer"><span className="sidebar-profile">{session.email.slice(0,2).toUpperCase()}</span><div><strong>{role==='owner'?'Business owner':'Team workspace'}</strong><small>{session.email}</small></div></div>
      </aside>}
      {session&&<header className="crm-topbar"><div className="topbar-context"><button className="icon-button secondary mobile-menu" aria-expanded={mobileNav} aria-label="Toggle workspace menu" onClick={()=>setMobileNav(v=>!v)}><Icon name={mobileNav?'close':'menu'}/></button><span className="context-dot"/><strong>{data?.company.display_name||'Service workspace'}</strong></div><div className="topbar-actions"><ThemeToggle/>{operational&&<button className="secondary" onClick={()=>navigate('Requests')}><Icon name="inbox"/><span>Requests</span></button>}{['owner','admin'].includes(role||'')&&<button className="icon-button secondary" aria-label="Activity and messages" onClick={()=>navigate('Activity')}><Icon name="bell"/></button>}<button className="icon-button secondary" aria-label="Sign out" onClick={async()=>{if(pending||invoiceBusy||!canLeave())return;if(!window.confirm('Sign out of your workspace?'))return;try{sessionSequence.current++;await api('/api/session',{action:'logout'});sessionSequence.current++;initialWorkspaceChosen.current=false;handledRequestLink.current=false;setSession(null);setSessionUnavailable(false);reloadSequence.current++;retryKeys.current.clear();setData(null);setOrg('');setEmail('');setPassword('');setShowPassword(false);setSent(false);setActiveRequest(null);}catch(e){setError(publicError(e));}}}><Icon name="logout"/></button></div></header>}
      {session&&data&&<nav className="crm-mobile-dock" aria-label="Quick workspace navigation">{primarySections.filter(canSeeSection).map(s=><button key={s.key} aria-label={s.label} type="button" aria-current={section===s.key?'page':undefined} onClick={()=>navigate(s.key)}><Icon name={s.icon}/><span>{s.label}</span>{s.key==='Requests'&&data.requests.some(r=>r.status==='submitted')&&<i className="dock-attention" aria-label="New requests"/>}</button>)}</nav>}
      <main className={`shell${session?' workspace-main':''}`} id="main">

        <div className="workspace-feedback">
          {error && <div role="alert" className="error card workspace-error"><p>{error}</p><button type="button" className="secondary" aria-label="Dismiss message" onClick={()=>setError("")}>Dismiss</button></div>}
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
          <form className="auth card" onSubmit={login}><ThemeToggle/>
            <p className="eyebrow">{loginBrand}</p>
            <h1>Sign in to your workspace</h1>
            
            <p>{authMode === "recover" ? "Enter your email to reset your password." : "Sign in with your email and password."}</p>
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
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={pending || sent}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {authMode === "password" && <>
              <label htmlFor="workspace-password">Password</label>
              <input id="workspace-password" type={showPassword ? "text" : "password"} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} required disabled={pending} value={password} onChange={(e)=>setPassword(e.target.value)} />
              <button type="button" className="secondary" aria-pressed={showPassword} disabled={pending} onClick={()=>setShowPassword(v=>!v)}>{showPassword ? "Hide password" : "Show password"}</button>
            </>}
            {authMode === "recover" && sent && <div><h2>Check your email</h2><p>Open the newest password reset link in this browser. The link will take you to a screen where you can choose a new password.</p></div>}
            <div className="actions">
              <button disabled={pending || (authMode === "recover" && sent)}>
                {pending
                  ? "Please wait…"
                  : authMode === "recover"
                    ? sent ? "Reset email sent" : "Send password reset"
                  : "Sign In"}
              </button>
              {authMode !== "password" && <button type="button" className="secondary" disabled={pending} onClick={()=>{setAuthMode("password");setSent(false);setMessage("");setError("");}}>Back to sign in</button>}
              {authMode === "password" && !sent && <button type="button" className="secondary" disabled={pending} onClick={()=>{setAuthMode("recover");setPassword("");setError("");}}>Forgot password</button>}
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
                    if(pending||invoiceBusy||!canLeave())return;
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
                      <h1 tabIndex={-1}>
                        {section==='Dashboard'?'Your day, in focus.':sections.find(s=>s.key===section)?.label||section}
                      </h1>
                      <div className="heading-actions"><span className="tiny">{new Intl.DateTimeFormat('en-US',{timeZone:data.company.timezone,dateStyle:'full'}).format(new Date())}</span><button className="secondary" onClick={()=>void refresh()}><Icon name="refresh"/>Refresh</button></div>
                    </div>
                    {(section==='Money'||(section==='Customers'&&!['owner','admin'].includes(role||''))||(section==='Work'&&role==='technician')) && <div className="actions" aria-label="Record pages"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous records</button><span>Page {page+1} · 50 records per page</span><button disabled={!data.pagination.hasMore} onClick={()=>setPage(p=>p+1)}>Next records</button></div>}
                    {section==='Dashboard'&&['owner','admin'].includes(role||'')&&<div className="calendar-inbox-link"><div><strong>Your appointment calendar</strong><span>See the month, open a visit or block unavailable time.</span></div><button onClick={()=>navigate('Calendar')}><Icon name="calendar"/>Open month calendar</button></div>}
                    {section==='Dashboard'&&['owner','admin'].includes(role||'')&&<CommandCenter key={org} organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onOpen={['owner','admin'].includes(role||'')?openWork:setActiveRequest} onNavigate={navigate}/>}
                    {section==='Requests'&&operational&&<RequestInbox key={org} organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onOpen={['owner','admin'].includes(role||'')?openWork:setActiveRequest} canManage={['owner','admin'].includes(role||'')}/>}
                    {section==='Activity'&&['owner','admin'].includes(role||'')&&<NotificationAttention organization={org}/>}
                    {section === "Snapshot" && ["owner","admin"].includes(role||"") && <BusinessSnapshot key={org} organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onOpen={navigate}/>}
                    {section === "Calendar" && ['owner','admin'].includes(role||'') && <>
                      <div className="calendar-inbox-link"><div><strong>New requests start in your inbox.</strong><span>Review proposed times here; schedule requests without a time from Requests.</span></div><button className="secondary" onClick={()=>navigate('Requests')}><Icon name="inbox"/>Open requests</button></div><MonthCalendar key={org} organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onOpen={['owner','admin'].includes(role||'')?openWork:setActiveRequest}/>
                    </>}
                    {section === "Learning" && ['owner','admin'].includes(role||'') && <OwnerLearningToolkit />}
                    {section === "Settings" && ['owner','admin'].includes(role||'') && <>
                      <CalendarConnections key={"calendar-"+org} organization={org}/><details><summary>Optional Google calendar export</summary><GoogleControls key={org} organization={org} view="settings"/></details>
                      <OwnerSecurity key={org} organization={org}/>
                    </>}
                    {section === "Settings" && ['owner','admin'].includes(role||'') && <MobileNotifications organization={org} timezone={data.company.timezone} onBusy={setInvoiceBusy}/>}
                    {section === "Settings" && ['owner','admin'].includes(role||'') && <SchedulingReadiness organization={org}/>}
                    {section === "Settings" && ['owner','admin'].includes(role||'') && <><CompanySettingsPanel organization={org} name={data.company.display_name}/><RetentionControls key={org} organization={org}/></>}
                    {['Today','Calendar'].includes(section)&&data.schedulingPreferences.length>0&&<section className="card" aria-labelledby="reschedule-heading"><h2 id="reschedule-heading">Customers requesting another time</h2>{data.schedulingPreferences.map(p=><article key={p.id} className="card"><p><strong>{data.requests.find(r=>r.id===p.request_id)?.original_submission.name||'Service request'}</strong></p><p>{p.preferred_local_start?.replace('T',' at ')} {p.preferred_local_start&&`(${p.timezone})`}</p><p>{p.note}</p><p className="note">Review this on the same request. A confirmed original stays booked until you approve its replacement.</p><button type="button" className="secondary" onClick={()=>{setActiveRequest(p.request_id);}}>Open service request</button></article>)}</section>}
                    {section === "Today" && ['owner','admin'].includes(role||'') && <DailyCallSheet key={org} organization={org} timezone={data.company.timezone}/>}
                    {section === 'Calendar'&&['owner','admin'].includes(role||'')&&<RecurringVisits organization={org} revision={reloadSequence.current} onOpen={['owner','admin'].includes(role||'')?openWork:setActiveRequest} onChanged={()=>void refresh()}/>}
                    {section === "Calendar" && ["owner","admin"].includes(role||"") && <details className="card calendar-block-tools"><summary>Block personal or unavailable time</summary><CalendarBlocks key={org} organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onChanged={()=>void refresh()}/></details>}
                    {section === "Customers" && (["owner","admin"].includes(role||"")?<CustomerRecords key={org+':'+(customerFocus||'directory')} initialCustomer={customerFocus} organization={org} timezone={data.company.timezone} onOpenRequest={openWork} onChanged={()=>void refresh()}/>:<section className="card"><h2>Customers</h2>{data.customers.map(c=><p key={c.id}>{c.display_name}</p>)}<p>Current records are managed by the owner.</p></section>)}
                    {section === "Work" && <>
                      {!workRequest&&['owner','admin'].includes(role||'')&&<OwnerWork key={org} organization={org} revision={reloadSequence.current} onOpen={openWork}/>}
                      <div className="work-context-bar" hidden={Boolean(workRequest)}><div><p className="eyebrow">Service workflow</p><p>{workRequest?'Appointment, agreed price, work, invoice and payment for this request.':'Choose a customer request to continue its complete workflow.'}</p></div><button className="secondary" onClick={()=>navigate('Requests')}>Open request inbox</button></div>
                      {workRequest&&<button type="button" className="secondary" onClick={()=>{if(pending||invoiceBusy||!canLeave())return;const url=new URL(window.location.href);url.searchParams.delete('request');window.history.replaceState(null,'',url);setWorkRequest(null);setPage(0);void refresh();}}>Back to all service workflows</button>}
                      {role==='technician'?<section className="card"><h2>Work assigned to your company</h2>{data.jobs.map(j=><article className="card" key={j.id}><h3>{data.customers.find(c=>c.id===j.customer_id)?.display_name||'Service call'}</h3><p>{j.status.replaceAll('_',' ')}</p>{data.features?.productionWorkflows&&<div className="actions">{['approved','scheduled','en_route','arrived'].includes(j.status)&&<button disabled={pending} onClick={()=>void fieldAction(j,'start')}>Start work</button>}{j.status==='working'&&<button disabled={pending} onClick={()=>void fieldAction(j,'pause')}>Pause work</button>}{j.status==='paused'&&<button disabled={pending} onClick={()=>void fieldAction(j,'resume')}>Resume work</button>}</div>}<p>The owner reviews completion, invoices and payments.</p></article>)}{!data.jobs.length&&<p>No work on this records page.</p>}</section>:workRequest?data.requests.filter(r=>r.id===workRequest).map(r=><ServiceWorkflow key={r.id} onCustomer={openCustomer} organization={org} request={{...r,appointments:data.appointments.filter(a=>a.request_id===r.id)}} quotes={data.quotes.filter(q=>q.request_id===r.id)} jobs={data.jobs.filter(j=>data.quotes.some(q=>q.id===j.quote_id&&q.request_id===r.id))} invoices={data.invoices.filter(i=>data.jobs.some(j=>j.id===i.job_id&&data.quotes.some(q=>q.id===j.quote_id&&q.request_id===r.id)))} timezone={data.company.timezone} canManage={['owner','admin'].includes(role||'')} canQuote={operational} canWork={Boolean(data.features?.productionWorkflows)&&['owner','admin','technician'].includes(role||'')} busy={pending||invoiceBusy} onBusy={setInvoiceBusy} onReview={()=>setActiveRequest(r.id)} act={act} fieldAction={fieldAction} onChanged={()=>void refresh()}/>):<RequestInbox key={org} organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onOpen={openWork} initialFilter="all" reviewLabel="Continue workflow"/>}
                      {role!=='technician'&&workRequest&&!data.requests.some(r=>r.id===workRequest)&&<div className="card" role="alert"><h2>This job could not be opened</h2><p>It may no longer be available to this account. Refresh to check its saved status, or return to Requests.</p><button className="secondary" disabled={pending||invoiceBusy} onClick={()=>void refresh()}>Check saved job</button></div>}
                      {role!=='technician'&&!workRequest&&!data.requests.length&&<div className="card"><h2>No service workflows in this view</h2><p>Open a request from the inbox to begin. Check another records page for older work.</p><button className="secondary" onClick={()=>navigate('Requests')}>Open requests</button></div>}
                    </>}
                    {section === "Money" && (
                      <>
                        {["owner","admin"].includes(role||"")&&<p><a href={"/owner/production-check?"+new URLSearchParams({organization:org})}>View sample invoice and email checks</a></p>}
                        {finance && <p><a href={"/owner/taxes?"+new URLSearchParams({organization:org})}>Taxes · rules, due dates, payments and exports</a></p>}
                        {finance && <FinanceActivity key={org} organization={org} companyName={data.company.display_name} timezone={data.company.timezone}/>}
                        {finance && <MileageActivity key={'mileage:'+org} organization={org} timezone={data.company.timezone}/> }
                        <p>
                          Issued amounts remain fixed. Payment status comes from
                          confirmed receipts.
                        </p>
                        <section className="card"><h2>Scheduled work · pending invoices</h2><p>See the appointment and agreed labor estimate while work is waiting. Issued invoices appear below.</p>{data.requests.filter(r=>data.appointments.some(a=>a.request_id===r.id&&a.status==='reserved'&&!data.invoices.some(i=>i.job_id===a.job_id))).map(r=><ScheduledInvoice key={r.id} request={{...r,appointments:data.appointments.filter(a=>a.request_id===r.id)}} quotes={data.quotes.filter(q=>q.request_id===r.id)} jobs={data.jobs} timezone={data.company.timezone} busy={pending} onOpen={()=>openWork(r.id)}/>)}{!data.requests.some(r=>data.appointments.some(a=>a.request_id===r.id&&a.status==='reserved'&&!data.invoices.some(i=>i.job_id===a.job_id)))&&<p>No pending invoices on this records page. Open Calendar to review other scheduled visits.</p>}</section>
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
                            i.total_cents - creditTotal(i.credits) -
                            i.payments.reduce((n, p) => n + p.cents, 0);
                          return (
                            <article className="card" key={i.id}>
                              <span className="badge">
                                {i.total_cents === 0
                                  ? "No charge"
                                  : balance === 0
                                  ? creditTotal(i.credits)>0?"Settled with credit":"Paid"
                                  : balance < i.total_cents
                                    ? creditTotal(i.credits)>0?"Balance due after credits":"Partially paid"
                                    : "Unpaid"}
                              </span>
                              {data.invoiceAdmin?.[i.id]?.archived&&<span className="badge">Archived</span>}{data.invoiceAdmin?.[i.id]?.cardPending&&<span className="badge">Card payment pending</span>}
                              <h2>Invoice {invoiceNumber(i.number)} · {i.snapshot?.recipient?.name||"Customer on issued invoice"}</h2>
                              <p>{[i.snapshot?.recipient?.street,i.snapshot?.recipient?.city].filter(Boolean).join(", ")}</p><p>{i.snapshot?.scope}</p>
                              <a href={"/invoice?"+new URLSearchParams({organization:org,invoice:i.id})}>View / print invoice</a>
                              <p>Payment due: {data.invoiceAdmin?.[i.id]?.dueDate||"See invoice terms"}</p>
                              <p className="amount">
                                {usd(balance)} outstanding
                              </p>
                              <p>Subtotal {usd(i.total_cents-(i.snapshot?.taxCents||0))} · sales tax {usd(i.snapshot?.taxCents||0)} · issued total {usd(i.total_cents)}</p><p>Confirmed paid {usd(i.payments.reduce((n,p)=>n+p.cents,0))} · net credits {usd(creditTotal(i.credits))}. Record each cash or Zelle amount when received. Open the invoice for its PDF, due date and history.</p>
                              {["owner","admin"].includes(role||"")&&<InvoiceDelivery organization={org} invoice={i.id}/>}
                              {['owner','admin'].includes(role||'')&&(i.customer_id||data.jobs.find(j=>j.id===i.job_id)?.customer_id)&&<RelatedCustomerFiles organization={org} customer={i.customer_id||data.jobs.find(j=>j.id===i.job_id)!.customer_id} targets={[{kind:'invoice',id:i.id},{kind:'job',id:i.job_id}]} disabled={pending||invoiceBusy} onManage={()=>openCustomer(i.customer_id||data.jobs.find(j=>j.id===i.job_id)!.customer_id)}/>}
                              {finance&&<InvoicePayments organization={org} invoice={i.id} totalCents={i.total_cents} timezone={data.company.timezone} onChanged={()=>void refresh()}/>}
                            </article>
                          );
                        })}
                      </>
                    )}
                    {section === "Settings" && (
                      <>
                      <div className="card">
                        <h2>Business preferences</h2>
                        <p><a href="/account?password=change">Change my password</a></p>
                        <p><a href="/owner/practice">Practice with sample requests, jobs and payments</a></p>
                        <p><a href={"/owner/production-check?"+new URLSearchParams({organization:org})}>Sample invoices and email checks</a></p>
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
      {session&&data&&activeRequest&&<RequestDetail key={org+activeRequest} organization={org} requestId={activeRequest} timezone={data.company.timezone} canManage={['owner','admin'].includes(role||'')} onClose={()=>{if(pending||invoiceBusy||!canLeave())return;setActiveRequest(null);const url=new URL(window.location.href);if(section==='Work'&&workRequest)url.searchParams.set('request',workRequest);else url.searchParams.delete('request');window.history.replaceState(null,'',url);}} onChanged={()=>void refresh()} onWork={openWork}/>}
    </div>
  );
}
