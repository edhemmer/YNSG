'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {localDate} from '../lib/day-plan';
import type {BusinessSnapshot} from '../lib/business-snapshot';
import Icon from './crm-icons';
import RequestInbox from './request-inbox';
import BusinessBrief from './business-brief';
import MarketingDrafts from './marketing-drafts';
import OwnerDay from './owner-day';
import OwnerWork from './owner-work';
export default function CommandCenter({organization,timezone,revision,onOpen,onNavigate}:{organization:string;timezone:string;revision:number;onOpen:(id:string)=>void;onNavigate:(section:string)=>void}){
 const [data,setData]=useState<BusinessSnapshot|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const today=localDate(new Date(),timezone);
 useEffect(()=>{setData(null);setError('');let live=true,inFlight=false;const controller=new AbortController();
  async function read(){if(inFlight)return;inFlight=true;try{const r=await sessionFetch('/api/business-snapshot?'+new URLSearchParams({organization,from:today.slice(0,7)+'-01',to:today}),{cache:'no-store',signal:controller.signal});const d=await r.json();if(!r.ok)throw Error(d.error);if(live){setData(d);setError('');}}catch(e){if(live&&!controller.signal.aborted){setData(null);setError(publicError(e));}}finally{inFlight=false;}}
  void read();const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},60000);return()=>{live=false;controller.abort();clearInterval(timer);};
 },[organization,today,revision,retry]);
 return <>
  <header className="owner-today-heading"><div><h2>Ready for your next stop</h2></div><div className="actions"><button type="button" className="secondary" onClick={()=>onNavigate('Work')}><Icon name="work"/>Jobs</button><button type="button" className="secondary" onClick={()=>onNavigate('Today')}><Icon name="pin"/>Routes</button></div></header>
  <OwnerDay organization={organization} revision={revision} onNavigate={onNavigate} onOpen={onOpen}/>
  {error&&<p role="alert" className="error note">Business totals could not load. {error}</p>}
  <RequestInbox organization={organization} timezone={timezone} revision={revision} onOpen={onOpen} canManage compact/>
  <details className="owner-today-admin"><summary>Continue unfinished jobs</summary><OwnerWork organization={organization} revision={revision} onOpen={onOpen}/></details>
  <details className="owner-today-admin"><summary>Business overview and reports</summary>
  <section className="metric-grid" aria-label="Current business totals">{[
   {label:'Needs review',value:data?.counts.requestsToReview,icon:'inbox',section:'Requests',note:'New and under-review requests',tone:'amber'},
   {label:'Upcoming visits',value:data?.counts.upcomingVisits,icon:'calendar',section:'Calendar',note:'Confirmed appointments ahead',tone:'green'},
   {label:'Work to finish',value:data?data.counts.working+data.counts.paused+(data.counts.jobsNeedingInvoice||0):undefined,icon:'work',section:'Work',note:'Working, paused or awaiting an invoice',tone:'blue'},
   {label:'Unpaid balance',value:data?(data.finance.outstandingAsOfEndCents/100).toLocaleString('en-US',{style:'currency',currency:'USD'}):undefined,icon:'money',section:'Money',note:'Recorded balance through today',tone:'violet'}
  ].map(m=><button className="metric-card" key={m.label} onClick={()=>onNavigate(m.section)}><span className={'metric-icon tone-'+m.tone}><Icon name={m.icon}/></span><span className="metric-label">{m.label}</span><strong>{m.value===undefined?'—':m.value}</strong><span className="metric-note">{m.note}</span><Icon name="arrow" className="metric-arrow"/></button>)}</section>
  <BusinessBrief data={data} error={error} onNavigate={onNavigate} onRetry={()=>setRetry(n=>n+1)}/>
  </details>
  <details className="card"><summary>Marketing drafts · optional business tools</summary><MarketingDrafts key={organization} organization={organization}/></details>
 </>;
}
