"use client";
import dynamic from 'next/dynamic';
import DeferredTool from './deferred-tool';

import type {InvoiceCredit} from '../lib/invoice-credit-contract';
import {creditTotal} from '../lib/invoice-credit-contract';

import {createWorkspaceHistory,readWorkspaceRoute,workspaceRouteUrl,workspaceSectionAllowed,workspaceHome,type WorkspaceRoute} from "../lib/workspace-navigation";
import {readJobRecovery,saveJobRecovery,clearJobRecovery,verifyJobActionResult,jobActionResponse,type PendingJobAction} from "../lib/job-action-recovery";
import {invoiceNumber} from "../lib/invoice-number";
import { publicError } from "../lib/public-errors";
import {companyTheme} from "../lib/company-brand";
import Icon from './crm-icons';
import CommandCenter from './command-center';
import RequestInbox from './request-inbox';
import OwnerLogin from './owner-login';
import ThemeToggle from './theme-toggle';
import MobileNotifications from './mobile-notifications';
import RequestDetail from './request-detail';
import NotificationAttention from "./notification-attention";
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
import DailyCallSheet from './day-plan';
import {sessionFetch,SessionApiError} from '../lib/session-fetch';
import {useCallback, useEffect, useRef, useState } from "react";

function PanelLoading(){return <p role="status">Opening workspace tools…</p>;}
const RetentionControls=dynamic(()=>import('./privacy-controls').then(module=>module.RetentionControls),{loading:PanelLoading});
const OwnerSecurity=dynamic(()=>import('./owner-security'),{loading:PanelLoading});
const BusinessSnapshot=dynamic(()=>import('./business-snapshot'),{loading:PanelLoading});
const FinanceActivity=dynamic(()=>import('./finance-activity'),{loading:PanelLoading});
const MileageActivity=dynamic(()=>import('./mileage-activity'),{loading:PanelLoading});
const GoogleControls=dynamic(()=>import('./google-controls'),{loading:PanelLoading});
const CalendarConnections=dynamic(()=>import('./calendar-connections'),{loading:PanelLoading});
const SchedulingReadiness=dynamic(()=>import('./scheduling-readiness'),{loading:PanelLoading});
const CompanySettingsPanel=dynamic(()=>import('./company-settings'),{loading:PanelLoading});
const CustomerServiceInsights=dynamic(()=>import('./customer-service-insights'),{loading:PanelLoading});
const MarketingDrafts=dynamic(()=>import('./marketing-drafts'),{loading:PanelLoading});
const OwnerLearningToolkit=dynamic(()=>import('./owner-learning-toolkit'),{loading:PanelLoading});
const CustomerRecords=dynamic(()=>import('./customer-records'),{loading:PanelLoading});

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
function WorkspaceContent({ configured, initialEmail = "" }: WorkspaceProps) {
  const {canLeave}=useEntrySafety();
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [pendingJobAction,setPendingJobAction]=useState<PendingJobAction|null>(null);
  const [timerRecoveryUnavailable,setTimerRecoveryUnavailable]=useState(false);
  const reloadSequence = useRef(0);
  const sessionSequence = useRef(0);
  const initialWorkspaceChosen=useRef(false);
  const historyController=useRef<ReturnType<typeof createWorkspaceHistory>|null>(null);
  const currentWorkspace=useRef({org:'',section:'Dashboard',workRequest:null as string|null,customerFocus:null as string|null,session:null as {email:string;memberships:Membership[]}|null});
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
  const [pending, setPending] = useState(false);
  const [org, setOrg] = useState(""),
    [data, setData] = useState<Data | null>(null),
    [section, setSection] = useState("Dashboard");
  const [page,setPage]=useState(0);
  const [accessRevision,setAccessRevision]=useState(0);
  const [isMobile,setIsMobile]=useState(false);
  useEffect(()=>{const query=window.matchMedia('(max-width:760px)');const change=()=>setIsMobile(query.matches);change();query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
  const [activeRequest,setActiveRequest]=useState<string|null>(null);
  const [mobileNav,setMobileNav]=useState(false);
  const [workRequest,setWorkRequest]=useState<string|null>(null);
  const [customerFocus,setCustomerFocus]=useState<string|null>(null);
  currentWorkspace.current={org,section,workRequest,customerFocus,session};
  // A new workspace destination starts at its heading, never the previous screen's scroll.
  const hasData=Boolean(data);
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});document.querySelector<HTMLElement>('#main h1')?.focus({preventScroll:true});},[org,section,workRequest,customerFocus,hasData]);
  useBlockedEntry('workspace',pending||invoiceBusy);
  const sections=[{key:'Dashboard',label:'Today',icon:'dashboard'},{key:'Requests',label:'Requests',icon:'inbox'},{key:'Calendar',label:'Calendar',icon:'calendar'},{key:'Today',label:'Day routes',icon:'pin'},{key:'Customers',label:'Customers',icon:'users'},{key:'Work',label:'Jobs',icon:'work'},{key:'Money',label:'Invoices & money',icon:'money'},{key:'Snapshot',label:'Reports',icon:'chart'},{key:'Marketing',label:'Marketing',icon:'chart'},{key:'Learning',label:'Field guide',icon:'book'},{key:'Activity',label:'Activity & messages',icon:'bell'},{key:'Settings',label:'Settings',icon:'settings'}];
  const primarySections=sections.filter(s=>['Dashboard','Requests','Calendar','Work','Money'].includes(s.key));
  const secondarySections=sections.filter(s=>['Today','Customers','Snapshot','Marketing','Learning','Activity','Settings'].includes(s.key));
  const canSeeSection=(s:{key:string})=>workspaceSectionAllowed(s.key,role);
  function applyDestination(route:WorkspaceRoute){
    // Invalidate outgoing reads synchronously, before the next render/effect.
    reloadSequence.current++;
    setOrg(route.organization);setPage(0);setSection(route.section);
    setWorkRequest(route.section==='Work'?route.request:null);
    setActiveRequest(route.section==='Requests'?route.request:null);
    setCustomerFocus(route.customer);setMobileNav(false);setMessage('');
  }
  function saveDestination(route:WorkspaceRoute,replace=false){
    const url=workspaceRouteUrl(new URL(window.location.href),route);
    if(replace)historyController.current?.replace(url);
    else historyController.current?.push(url);
    applyDestination(route);
  }
  function navigate(next:string){
    if(!sections.some(item=>item.key===next&&canSeeSection(item))){setError('That workspace destination is not available to your account.');return;}
    if(pending||invoiceBusy){setError('Finish the current action before changing screens.');return;}
    if(!canLeave())return;
    setError('');saveDestination({organization:org,section:next,request:null,customer:null});
  }
  function openWork(id:string){
    if(!canSeeSection({key:'Work'})){setError('Jobs are not available to your account.');return;}
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)){setError('That job link is invalid.');return;}
    if(pending||invoiceBusy){setError('Please finish the current action before opening another request.');return;}
    if(!canLeave())return;
    setError('');saveDestination({organization:org,section:'Work',request:id,customer:null});
  }
  function openCustomer(id:string){
    if(!canSeeSection({key:'Customers'})){setError('Customers are not available to your account.');return;}
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)){setError('That customer link is invalid.');return;}
    if(pending||invoiceBusy){setError('Finish the current action before opening a customer.');return;}
    if(!canLeave())return;
    setError('');saveDestination({organization:org,section:'Customers',request:null,customer:id});
  }
  const historyHandler=useRef<(url:URL)=>boolean>(()=>false);
  historyHandler.current=url=>{
    if(pending||invoiceBusy||!canLeave()){
      setError('Finish or discard your current changes before using browser navigation.');return false;
    }
    if(!session)return false;
    const route=readWorkspaceRoute(url,session.memberships,org);
    url.search=workspaceRouteUrl(url,route).search;
    setError('');applyDestination(route);return true;
  };
  useEffect(()=>{
    const controller=createWorkspaceHistory(window,url=>historyHandler.current(url));
    historyController.current=controller;
    return()=>{controller.dispose();if(historyController.current===controller)historyController.current=null;};
  },[]);
  async function loadSession() {
    const sequence=++sessionSequence.current;
    try {
      const s = await api("/api/session");
      if(sequence!==sessionSequence.current)return;
      setSessionUnavailable(false);
      setError(previous=>previous.startsWith('We could not check your saved sign-in.')?'':previous);
      const current=currentWorkspace.current;
      const first=!initialWorkspaceChosen.current;
      const sameIdentity=!current.session||current.session.email===s.email;
      const member=s.memberships.find((m:Membership)=>m.organization_id===current.org);
      const priorRole=current.session?.memberships.find(m=>m.organization_id===current.org)?.role;
      if(!sameIdentity||priorRole!==member?.role){
        reloadSequence.current++;setData(null);setAccessRevision(v=>v+1);
      }
      setSession(s);
      if(first||!sameIdentity||!member||!workspaceSectionAllowed(current.section,member.role)){
        // Only consume entry links on initial load. A focus-driven session check
        // preserves the live screen; revoked companies/roles immediately lose data.
        const url=first?new URL(window.location.href):new URL(window.location.pathname,window.location.origin);
        if(first&&(url.searchParams.has('google')||url.searchParams.get('setup')==='google'))url.searchParams.set('section','Settings');
        const route=readWorkspaceRoute(url,s.memberships,sameIdentity?current.org:'');
        if(!sameIdentity||!member){reloadSequence.current++;setData(null);}
        initialWorkspaceChosen.current=true;
        saveDestination(route,true);
      }

    } catch (e) {
      if(sequence!==sessionSequence.current)return;
      if(e instanceof SessionApiError&&e.status===401){
        reloadSequence.current++;initialWorkspaceChosen.current=false;setSession(null);setOrg('');setData(null);setActiveRequest(null);setWorkRequest(null);setCustomerFocus(null);setSessionUnavailable(false);
      }else{
        setSessionUnavailable(true);setError('We could not check your saved sign-in. Try again when your connection is available; you do not need another email.');
      }
    } finally {
      if(sequence===sessionSequence.current)setChecking(false);
    }
  }
  useEffect(() => {
    if(new URLSearchParams(window.location.search).get('auth')==='failed')setError('That sign-in link could not be verified. Sign in with your password or choose Forgot password.');
    if (configured) void loadSession();
  }, [configured]);
  useEffect(()=>{
    if(!configured)return;
    const resume=()=>{if(document.visibilityState==='visible')void loadSession();};
    window.addEventListener('focus',resume);
    return()=>window.removeEventListener('focus',resume);
  },[configured]);
  const refresh=useCallback(async (selected = org)=>{
    if (!selected) return;
    const sequence = ++reloadSequence.current;
    setError("");
    try {
      const next = await api(
        `/api/workspace?organization=${encodeURIComponent(selected)}&page=${page}&request=${encodeURIComponent(workRequest||'')}`,
      );
      if(next?.company?.id!==selected)throw new Error('Workspace company could not be confirmed.');
      if (sequence === reloadSequence.current && currentWorkspace.current.org===selected) setData(next);
    } catch (e) {
      if (sequence === reloadSequence.current) {
        if(e instanceof SessionApiError&&[401,403].includes(e.status))setData(null);
        setError('Saved records could not be refreshed. Your open entries are kept unless company access has ended. '+publicError(e));
      }
    }
  },[org,page,workRequest]);
  useEffect(() => {
    setData(null);
    if (org) void refresh(org);
  }, [org,refresh,accessRevision]);
  async function act(value: Record<string, unknown>) {
    if (ownerCommandFlight.current) return;
    const fingerprint = JSON.stringify([org, value]);
    if (unresolvedOwnerCommand.current && unresolvedOwnerCommand.current !== fingerprint) {
      setError("An earlier action is not confirmed. Check the saved request or job and retry only the exact original action before making another change.");
      return;
    }
    const wasUnknown=unresolvedOwnerCommand.current===fingerprint;
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
      if (!wasUnknown && e instanceof SessionApiError && [400,401,403,404,409,422].includes(e.status)) {
        unresolvedOwnerCommand.current=null;
        retryKeys.current.delete(fingerprint);
        setError(publicError(e));
        return {ok:false,uncertain:false};
      } else {
        unresolvedOwnerCommand.current=fingerprint;
        setError("The result of that action is unconfirmed. Your original retry is protected. Check the saved request or job, then retry the same unchanged action; do not submit a different one.");
        return {ok:false,uncertain:true};
      }
    } finally {
      ownerCommandFlight.current=false;
      setPending(false);
    }
  }
  useEffect(()=>{
    setPendingJobAction(null);setTimerRecoveryUnavailable(false);
    if(!session?.email)return;
    try{setPendingJobAction(readJobRecovery(window.sessionStorage,session.email));}
    catch{setTimerRecoveryUnavailable(true);}
  },[session?.email]);
  async function sendFieldAction(entry:PendingJobAction,recovery:boolean){
    if(ownerCommandFlight.current)return;
    const current=currentWorkspace.current.session;
    if(current?.email!==entry.actor||!current.memberships.some(m=>m.organization_id===entry.body.organizationId&&['owner','admin','technician'].includes(m.role))){
      setError('Current company access is required to check this timer action. The saved retry is kept.');return;
    }
    ownerCommandFlight.current=true;setPending(true);setError('');setMessage('');
    try{
      // A durable, verified frozen retry must exist before any timer write.
      entry=saveJobRecovery(window.sessionStorage,entry);
    }catch{
      setTimerRecoveryUnavailable(true);setError('This device could not protect the timer retry. No new timer action was sent.');ownerCommandFlight.current=false;setPending(false);return;
    }
    setPendingJobAction(entry);
    let resultConfirmed=false;
    try{
      const response=jobActionResponse.parse(await api('/api/jobs',entry.body));
      verifyJobActionResult(response.result,entry.body);
      resultConfirmed=true;
      clearJobRecovery(window.sessionStorage,entry);
      if(currentWorkspace.current.session?.email!==entry.actor)return;
      setPendingJobAction(null);setTimerRecoveryUnavailable(false);
      setMessage('Job and time record saved.');await refresh();
    }catch(e){
      if(resultConfirmed){
        if(currentWorkspace.current.session?.email===entry.actor){setTimerRecoveryUnavailable(true);setMessage('Job and time record saved.');setError('This device could not clear its protected retry. Check the saved timer action again; the same action will not create another timer.');}
        return;
      }
      const rejected=e instanceof SessionApiError&&[400,401,403,404,409,422].includes(e.status)&&!(recovery&&[401,403].includes(e.status));
      if(rejected){
        let cleared=false;try{clearJobRecovery(window.sessionStorage,entry);cleared=true;}catch{setTimerRecoveryUnavailable(true);}
        if(currentWorkspace.current.session?.email!==entry.actor)return;
        setPendingJobAction(cleared?null:entry);setError(publicError(e));
      }else if(currentWorkspace.current.session?.email===entry.actor){
        setError('The timer result is unconfirmed. Use Check saved timer action to replay the original action safely.');
      }
    }finally{ownerCommandFlight.current=false;setPending(false);}
  }
  async function fieldAction(j:Pick<Job,'id'|'revision'>,action:'start'|'pause'|'resume') {
    if(ownerCommandFlight.current)return;
    if(unresolvedOwnerCommand.current){setError('Check the earlier saved request or job action before starting another timer action.');return;}
    if(!session?.email)return;
    let saved:PendingJobAction|null;
    try{saved=readJobRecovery(window.sessionStorage,session.email);}
    catch{setTimerRecoveryUnavailable(true);setError('This device’s saved timer retry could not be read. No timer action was sent.');return;}
    if(saved){setPendingJobAction(saved);setError('Check the saved timer action before starting a different timer action.');return;}
    const entry:PendingJobAction={version:1,actor:session.email,body:{organizationId:org,id:j.id,revision:j.revision,action,note:'',key:crypto.randomUUID()}};
    await sendFieldAction(entry,false);
  }
  const role = session?.memberships.find(
    (m) => m.organization_id === org,
  )?.role;
  const operational = ["owner", "admin", "dispatcher"].includes(role || "");
  const finance = ["owner", "admin", "bookkeeper"].includes(role || "");
  return (
    <div className={`company-workspace${session ? "" : " signed-out"}`} style={companyTheme(data?.brand)}>
      {session&&data&&<aside className={'crm-sidebar'+(mobileNav?' is-open':'')} aria-label="Business navigation" inert={isMobile&&!mobileNav}>
        <a className="sidebar-brand" href="/" onClick={e=>{e.preventDefault();navigate(role==='technician'?'Today':role==='bookkeeper'?'Money':role==='dispatcher'?'Requests':'Dashboard');}}>{/your neighborhood service guy/i.test(data.company.display_name)?<img src="/brand/ynsg-logo.jpg" alt="Your Neighborhood Service Guy — Home & Yard"/>:<span className="company-mark"><Icon name="leaf"/>{data.company.display_name}</span>}</a>
        <p className="sidebar-caption">Field operations</p>
        <nav aria-label="Workspace"><p className="nav-group-label">Workflow</p>{primarySections.filter(canSeeSection).map(s=><button key={s.key} aria-label={s.label} aria-current={section===s.key?'page':undefined} onClick={()=>navigate(s.key)}><Icon name={s.icon}/><span>{s.label}</span>{s.key==='Requests'&&data.requests.some(r=>r.status==='submitted')&&<i className="nav-attention" aria-label="New requests"/>}</button>)}<details className="sidebar-more" open={secondarySections.some(s=>s.key===section)}><summary><Icon name="settings"/><span>Office & tools</span></summary>{secondarySections.filter(canSeeSection).map(s=><button key={s.key} aria-label={s.label} aria-current={section===s.key?'page':undefined} onClick={()=>navigate(s.key)}><Icon name={s.icon}/><span>{s.label}</span></button>)}</details></nav>
        <div className="sidebar-footer"><span className="sidebar-profile">{session.email.slice(0,2).toUpperCase()}</span><div><strong>{role==='owner'?'Business owner':'Team workspace'}</strong><small>{session.email}</small></div></div>
      </aside>}
      {session&&<header className="crm-topbar"><div className="topbar-context"><span className="context-dot"/><strong>{data?.company.display_name||'Service workspace'}</strong></div><div className="topbar-actions"><ThemeToggle/>{['owner','admin'].includes(role||'')&&<button className="icon-button secondary" aria-label="Activity and messages" onClick={()=>navigate('Activity')}><Icon name="bell"/></button>}<button className="icon-button secondary" aria-label="Sign out" onClick={async()=>{if(pending||invoiceBusy||!canLeave())return;if(!window.confirm('Sign out of your workspace?'))return;try{sessionSequence.current++;await api('/api/session',{action:'logout'});sessionSequence.current++;initialWorkspaceChosen.current=false;setSession(null);setSessionUnavailable(false);reloadSequence.current++;retryKeys.current.clear();setData(null);setOrg('');setActiveRequest(null);setWorkRequest(null);setCustomerFocus(null);}catch(e){setError(publicError(e));}}}><Icon name="logout"/></button></div></header>}
      {session&&data&&<nav className="crm-mobile-dock" aria-label="Quick workspace navigation">{primarySections.filter(s=>['Dashboard','Requests','Work'].includes(s.key)&&canSeeSection(s)).map(s=><button key={s.key} aria-label={s.label} type="button" aria-current={section===s.key?'page':undefined} onClick={()=>navigate(s.key)}><Icon name={s.icon}/><span>{s.label}</span>{s.key==='Requests'&&data.requests.some(r=>r.status==='submitted')&&<i className="dock-attention" aria-label="New requests"/>}</button>)}<button type="button" aria-label="More workspace tools" aria-expanded={mobileNav} aria-current={!['Dashboard','Requests','Work'].includes(section)?'page':undefined} onClick={()=>setMobileNav(v=>!v)}><Icon name="menu"/><span>More</span></button></nav>}
      <main className={`shell${session?' workspace-main':''}`} id="main">

        <div className="workspace-feedback">
          {session&&pendingJobAction?.actor===session.email&&<section className="card timer-recovery" role="status"><strong>Check the saved timer action</strong><p>Check the original {pendingJobAction.body.action} action before starting another timer. This checks its saved result without creating an extra timer.</p><button type="button" disabled={pending||invoiceBusy||!session.memberships.some(m=>m.organization_id===pendingJobAction.body.organizationId&&['owner','admin','technician'].includes(m.role))} onClick={()=>void sendFieldAction(pendingJobAction,true)}>Check saved timer action</button>{!session.memberships.some(m=>m.organization_id===pendingJobAction.body.organizationId&&['owner','admin','technician'].includes(m.role))&&<p>Current access to the original company is required. The retry remains saved.</p>}</section>}
          {session&&timerRecoveryUnavailable&&<p className="error" role="alert">Timer recovery on this device needs attention. Keep the original browser tab and retry available; do not start a replacement timer.</p>}
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
          <OwnerLogin initialEmail={initialEmail} brand={loginBrand}/>
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
                    const nextOrg=e.target.value;
                    const member=session.memberships.find(m=>m.organization_id===nextOrg);
                    if(!member)return;
                    setData(null);retryKeys.current.clear();
                    saveDestination({organization:nextOrg,section:workspaceHome(member.role),request:null,customer:null});
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
                    <p>Your sign-in is complete. If your workspace has not loaded, try again.</p>
                    <button disabled={pending} onClick={() => void refresh()}>Reload workspace</button>
                  </div>
                )}
                {data && (
                  <>
                    <div className="list-heading">
                      <h1 tabIndex={-1}>
                        {section==='Work'&&workRequest?'Job':sections.find(s=>s.key===section)?.label||section}
                      </h1>
                      <div className="heading-actions"><span className="tiny">{new Intl.DateTimeFormat('en-US',{timeZone:data.company.timezone,dateStyle:'full'}).format(new Date())}</span><button className="secondary" onClick={()=>void refresh()}><Icon name="refresh"/>Refresh</button></div>
                    </div>
                    {(page>0||data.pagination.hasMore)&&(section==='Money'||(section==='Customers'&&!['owner','admin'].includes(role||''))||(section==='Work'&&role==='technician')) && <div className="actions record-pages" aria-label="Record pages"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous records</button><span>Page {page+1} · 50 records per page</span><button disabled={!data.pagination.hasMore} onClick={()=>setPage(p=>p+1)}>Next records</button></div>}

                    {section==='Dashboard'&&['owner','admin'].includes(role||'')&&<CommandCenter key={org} organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onOpen={['owner','admin'].includes(role||'')?openWork:setActiveRequest} onNavigate={navigate}/>}
                    {section==='Requests'&&operational&&<RequestInbox fieldMode={['owner','admin'].includes(role||'')} key={org} organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onOpen={['owner','admin'].includes(role||'')?openWork:setActiveRequest} canManage={['owner','admin'].includes(role||'')}/>}
                    {section==='Activity'&&['owner','admin'].includes(role||'')&&<NotificationAttention organization={org}/>}
                    {section === "Snapshot" && ["owner","admin"].includes(role||"") && <BusinessSnapshot key={org} organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onOpen={navigate}/>}
                    {section === "Calendar" && ['owner','admin'].includes(role||'') && <>
                      <div className="calendar-inbox-link"><div><strong>New requests start in your inbox.</strong><span>Review proposed times here; schedule requests without a time from Requests.</span></div><button className="secondary" onClick={()=>navigate('Requests')}><Icon name="inbox"/>Open requests</button></div><MonthCalendar key={org} organization={org} timezone={data.company.timezone} revision={reloadSequence.current} onOpen={['owner','admin'].includes(role||'')?openWork:setActiveRequest}/>
                    </>}
                    {section === 'Marketing'&&['owner','admin'].includes(role||'')&&<><CustomerServiceInsights key={'insights:'+org} organization={org} timezone={data.company.timezone} onCustomer={openCustomer}/><MarketingDrafts key={org} organization={org}/></>}
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

                      {workRequest&&<button type="button" className="secondary" onClick={()=>navigate('Work')}>All jobs</button>}
                      {role==='technician'?<section className="card"><h2>Work assigned to your company</h2>{data.jobs.map(j=><article className="card" key={j.id}><h3>{data.customers.find(c=>c.id===j.customer_id)?.display_name||'Service call'}</h3><p>{j.status.replaceAll('_',' ')}</p>{data.features?.productionWorkflows&&<div className="actions">{['approved','scheduled','en_route','arrived'].includes(j.status)&&<button disabled={pending} onClick={()=>void fieldAction(j,'start')}>Start work</button>}{j.status==='working'&&<button disabled={pending} onClick={()=>void fieldAction(j,'pause')}>Pause work</button>}{j.status==='paused'&&<button disabled={pending} onClick={()=>void fieldAction(j,'resume')}>Resume work</button>}</div>}<p>The owner reviews completion, invoices and payments.</p></article>)}{!data.jobs.length&&<p>No work on this records page.</p>}</section>:workRequest?data.requests.filter(r=>r.id===workRequest).map(r=><ServiceWorkflow key={r.id} onCustomer={openCustomer} organization={org} request={{...r,appointments:data.appointments.filter(a=>a.request_id===r.id)}} quotes={data.quotes.filter(q=>q.request_id===r.id)} jobs={data.jobs.filter(j=>data.quotes.some(q=>q.id===j.quote_id&&q.request_id===r.id))} invoices={data.invoices.filter(i=>data.jobs.some(j=>j.id===i.job_id&&data.quotes.some(q=>q.id===j.quote_id&&q.request_id===r.id)))} timezone={data.company.timezone} canManage={['owner','admin'].includes(role||'')} canQuote={operational} canWork={Boolean(data.features?.productionWorkflows)&&['owner','admin','technician'].includes(role||'')} busy={pending||invoiceBusy} onBusy={setInvoiceBusy} onReview={()=>setActiveRequest(r.id)} act={act} fieldAction={fieldAction} onChanged={()=>void refresh()}/>):null}
                      {role!=='technician'&&workRequest&&!data.requests.some(r=>r.id===workRequest)&&<div className="card" role="alert"><h2>This job could not be opened</h2><p>It may no longer be available to this account. Refresh to check its saved status, or return to Requests.</p><button className="secondary" disabled={pending||invoiceBusy} onClick={()=>void refresh()}>Check saved job</button></div>}

                    </>}
                    {section === "Money" && (
                      <>

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
                            <details className="card money-invoice" key={i.id}>
                              <summary><span><strong>Invoice {invoiceNumber(i.number)}</strong><span>{i.snapshot?.recipient?.name||'Customer on issued invoice'}</span></span><span className="money-invoice-balance"><strong>{usd(balance)}</strong><span>{balance===0?'Settled':'Remaining'}</span></span></summary>
                              <div className="money-invoice-actions">
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
                              <p>{[i.snapshot?.recipient?.street,i.snapshot?.recipient?.city].filter(Boolean).join(', ')}</p><p>{i.snapshot?.scope}</p>
                              <a href={'/invoice?'+new URLSearchParams({organization:org,invoice:i.id})}>View / print invoice</a>
                              {['owner','admin'].includes(role||'')&&<details><summary>Email invoice</summary><InvoiceDelivery organization={org} invoice={i.id}/></details>}
                              {['owner','admin'].includes(role||'')&&(i.customer_id||data.jobs.find(j=>j.id===i.job_id)?.customer_id)&&<RelatedCustomerFiles organization={org} customer={i.customer_id||data.jobs.find(j=>j.id===i.job_id)!.customer_id} targets={[{kind:'invoice',id:i.id},{kind:'job',id:i.job_id}]} disabled={pending||invoiceBusy} onManage={()=>openCustomer(i.customer_id||data.jobs.find(j=>j.id===i.job_id)!.customer_id)}/>}
                              {finance&&<InvoicePayments organization={org} invoice={i.id} totalCents={i.total_cents} timezone={data.company.timezone} onChanged={()=>void refresh()}/>}
                              </div>
                            </details>
                          );
                        })}
                        <details className="card money-pending"><summary>Scheduled work · pending invoices</summary><p>See the appointment and agreed labor estimate while work is waiting. Issued invoices appear below.</p>{data.requests.filter(r=>data.appointments.some(a=>a.request_id===r.id&&a.status==='reserved'&&!data.invoices.some(i=>i.job_id===a.job_id))).map(r=><ScheduledInvoice key={r.id} request={{...r,appointments:data.appointments.filter(a=>a.request_id===r.id)}} quotes={data.quotes.filter(q=>q.request_id===r.id)} jobs={data.jobs} timezone={data.company.timezone} busy={pending} onOpen={()=>openWork(r.id)}/>)}{!data.requests.some(r=>data.appointments.some(a=>a.request_id===r.id&&a.status==='reserved'&&!data.invoices.some(i=>i.job_id===a.job_id)))&&<p>No pending invoices on this records page. Open Calendar to review other scheduled visits.</p>}</details>
                        {finance && <p><a href={"/owner/taxes?"+new URLSearchParams({organization:org})}>Taxes · rules, due dates, payments and exports</a></p>}
                        {finance && <DeferredTool key={"expenses:"+org} label="Expenses & cash activity"><FinanceActivity key={org} organization={org} companyName={data.company.display_name} timezone={data.company.timezone}/></DeferredTool>}
                        {finance && <DeferredTool key={"mileage:"+org} label="Mileage & trips"><MileageActivity key={'mileage:'+org} organization={org} timezone={data.company.timezone}/></DeferredTool>}

                      </>
                    )}
                    {section === "Settings" && (
                      <>
                      <div className="card">
                        <h2>Business preferences</h2>
                        <p><a href="/auth/password">Change my password</a></p>
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
      {session&&data&&activeRequest&&<RequestDetail key={org+activeRequest} organization={org} requestId={activeRequest} timezone={data.company.timezone} canManage={['owner','admin'].includes(role||'')} onClose={()=>{if(pending||invoiceBusy||!canLeave())return;setActiveRequest(null);const url=new URL(window.location.href);if(section==='Work'&&workRequest)url.searchParams.set('request',workRequest);else url.searchParams.delete('request');historyController.current?.replace(url);}} onChanged={()=>void refresh()} onWork={openWork}/>}
    </div>
  );
}
