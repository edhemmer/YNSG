'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {localDate} from '../lib/day-plan';
import type {BusinessSnapshot} from '../lib/business-snapshot';
import Icon from './crm-icons';
import RequestInbox from './request-inbox';
export default function CommandCenter({organization,timezone,revision,onOpen,onNavigate}:{organization:string;timezone:string;revision:number;onOpen:(id:string)=>void;onNavigate:(section:string)=>void}){
 const [data,setData]=useState<BusinessSnapshot|null>(null),[error,setError]=useState('');
 const today=localDate(new Date(),timezone),activeJobs=()=>((data?.counts.working??0)+(data?.counts.paused??0));
 useEffect(()=>{let live=true,inFlight=false;const controller=new AbortController();
  async function read(){if(inFlight)return;inFlight=true;try{const r=await sessionFetch('/api/business-snapshot?'+new URLSearchParams({organization,from:today.slice(0,7)+'-01',to:today}),{cache:'no-store',signal:controller.signal});const d=await r.json();if(!r.ok)throw Error(d.error);if(live){setData(d);setError('');}}catch(e){if(live&&!controller.signal.aborted){setData(null);setError(publicError(e));}}finally{inFlight=false;}}
  void read();const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},60000);return()=>{live=false;controller.abort();clearInterval(timer);};
 },[organization,today,revision]);
 return <>
  <section className="command-hero"><div><span className="hero-tag"><Icon name="leaf"/>Your business, moving forward</span><h2>A clear plan.<br/>A smoother day.</h2><p>New requests, upcoming visits and the next decision—all in one place.</p><button onClick={()=>onNavigate('Requests')}>Review requests<Icon name="arrow"/></button></div><div className="hero-art" aria-hidden="true"><div className="art-sun"/><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-card"><Icon name="calendar"/><span>Request → Confirm → Complete</span><div className="art-checks"><Icon name="check"/><Icon name="check"/><Icon name="check"/></div></div></div></section>
  {error&&<p role="alert" className="error note">Business totals could not load. {error}</p>}
  <section className="metric-grid" aria-label="Current business totals">{[
   {label:'Needs review',value:data?.counts.requestsToReview,icon:'inbox',section:'Requests',note:'New and under-review requests',tone:'amber'},
   {label:'Upcoming visits',value:data?.counts.upcomingVisits,icon:'calendar',section:'Calendar',note:'Confirmed appointments ahead',tone:'green'},
   {label:'Active jobs',value:data?data.counts.working+data.counts.paused:undefined,icon:'work',section:'Work',note:'Working and paused service calls',tone:'blue'},
   {label:'Unpaid balance',value:data?(data.finance.outstandingAsOfEndCents/100).toLocaleString('en-US',{style:'currency',currency:'USD'}):undefined,icon:'money',section:'Money',note:'Recorded balance through today',tone:'violet'}
  ].map(m=><button className="metric-card" key={m.label} onClick={()=>onNavigate(m.section)}><span className={'metric-icon tone-'+m.tone}><Icon name={m.icon}/></span><span className="metric-label">{m.label}</span><strong>{m.value===undefined?'—':m.value}</strong><span className="metric-note">{m.note}</span><Icon name="arrow" className="metric-arrow"/></button>)}</section>
  <div className="command-grid"><RequestInbox organization={organization} timezone={timezone} revision={revision} onOpen={onOpen} compact/><aside className="command-aside"><section className="card next-action-card"><p className="eyebrow">Next best action</p><h2>{data?.counts.requestsToReview?'Review a new request':data?.counts.upcomingVisits?'Review the next visit':activeJobs()?'Continue the active job':data?.finance.outstandingAsOfEndCents?'Review unpaid invoices':'Your workspace is clear'}</h2><p>{data?.counts.requestsToReview?'Confirm the customer’s services and proposed time before it expires.':data?.counts.upcomingVisits?'Check the appointment, route and any customer notes.':activeJobs()?'Record progress while the details are fresh.':data?.finance.outstandingAsOfEndCents?'Approve, send or record the next invoice decision.':'New work will appear here automatically.'}</p><button onClick={()=>onNavigate(data?.counts.requestsToReview?'Requests':data?.counts.upcomingVisits?'Calendar':activeJobs()?'Work':data?.finance.outstandingAsOfEndCents?'Money':'Requests')}>{data?.counts.requestsToReview?'Open request inbox':data?.counts.upcomingVisits?'Open calendar':activeJobs()?'Open active jobs':data?.finance.outstandingAsOfEndCents?'Open invoices':'Open requests'}<Icon name="arrow"/></button></section><section className="automation-card"><span className="automation-symbol"><Icon name="refresh"/></span><h3>Your follow-through, connected</h3><p>Saved decisions use your existing calendar and customer email automation. Check exceptions without hunting through requests.</p><button className="secondary" onClick={()=>onNavigate('Activity')}>Open activity & messages<Icon name="arrow"/></button></section></aside></div>
 </>;
}
