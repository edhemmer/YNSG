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
export default function CommandCenter({organization,timezone,revision,onOpen,onNavigate}:{organization:string;timezone:string;revision:number;onOpen:(id:string)=>void;onNavigate:(section:string)=>void}){
 const [data,setData]=useState<BusinessSnapshot|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const today=localDate(new Date(),timezone);
 useEffect(()=>{setData(null);setError('');let live=true,inFlight=false;const controller=new AbortController();
  async function read(){if(inFlight)return;inFlight=true;try{const r=await sessionFetch('/api/business-snapshot?'+new URLSearchParams({organization,from:today.slice(0,7)+'-01',to:today}),{cache:'no-store',signal:controller.signal});const d=await r.json();if(!r.ok)throw Error(d.error);if(live){setData(d);setError('');}}catch(e){if(live&&!controller.signal.aborted){setData(null);setError(publicError(e));}}finally{inFlight=false;}}
  void read();const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},60000);return()=>{live=false;controller.abort();clearInterval(timer);};
 },[organization,today,revision,retry]);
 return <>
  <section className="command-hero"><div><span className="hero-tag"><Icon name="leaf"/>Your business, in focus</span><h2>A clear plan.<br/>A smoother day.</h2><p>Requests, routes, follow-through and marketing drafts—with the next decision ready for you.</p><button onClick={()=>onNavigate('Requests')}>Review requests<Icon name="arrow"/></button></div><div className="hero-art" aria-hidden="true"><div className="art-sun"/><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-card"><Icon name="calendar"/><span>Request → Confirm → Complete</span><div className="art-checks"><Icon name="check"/><Icon name="check"/><Icon name="check"/></div></div></div></section>
  {error&&<p role="alert" className="error note">Business totals could not load. {error}</p>}
  <section className="metric-grid" aria-label="Current business totals">{[
   {label:'Needs review',value:data?.counts.requestsToReview,icon:'inbox',section:'Requests',note:'New and under-review requests',tone:'amber'},
   {label:'Upcoming visits',value:data?.counts.upcomingVisits,icon:'calendar',section:'Calendar',note:'Confirmed appointments ahead',tone:'green'},
   {label:'Active jobs',value:data?data.counts.working+data.counts.paused:undefined,icon:'work',section:'Work',note:'Working and paused service calls',tone:'blue'},
   {label:'Unpaid balance',value:data?(data.finance.outstandingAsOfEndCents/100).toLocaleString('en-US',{style:'currency',currency:'USD'}):undefined,icon:'money',section:'Money',note:'Recorded balance through today',tone:'violet'}
  ].map(m=><button className="metric-card" key={m.label} onClick={()=>onNavigate(m.section)}><span className={'metric-icon tone-'+m.tone}><Icon name={m.icon}/></span><span className="metric-label">{m.label}</span><strong>{m.value===undefined?'—':m.value}</strong><span className="metric-note">{m.note}</span><Icon name="arrow" className="metric-arrow"/></button>)}</section>
  <div className="command-grid"><RequestInbox organization={organization} timezone={timezone} revision={revision} onOpen={onOpen} canManage compact/><aside className="command-aside"><BusinessBrief data={data} error={error} onNavigate={onNavigate} onRetry={()=>setRetry(n=>n+1)}/><MarketingDrafts key={organization} organization={organization}/></aside></div>
 </>;
}
