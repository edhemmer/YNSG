'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {ownerDayResponse,ownerDayLabel,type OwnerDay} from '../lib/owner-day';
import Icon from './crm-icons';
export default function OwnerDay({organization,revision,onOpen,onNavigate}:{organization:string;revision:number;onOpen:(id:string)=>void;onNavigate:(section:string)=>void}){
 const [data,setData]=useState<OwnerDay|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true,inFlight=false;const controller=new AbortController();setData(null);setError('');
  async function read(){if(inFlight)return;inFlight=true;try{const r=await sessionFetch('/api/owner-day?'+new URLSearchParams({organization}),{cache:'no-store',signal:controller.signal});const d=await r.json();if(!r.ok)throw Error(d.error);if(live){setData(ownerDayResponse.parse(d));setError('');}}catch(e){if(live&&!controller.signal.aborted){setData(null);setError(publicError(e));}}finally{inFlight=false;}}
  void read();const refresh=()=>{if(document.visibilityState==='visible')void read();};const timer=setInterval(refresh,30000);document.addEventListener('visibilitychange',refresh);
  return()=>{live=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[organization,revision,retry]);
 return <section className="card owner-day" aria-labelledby="owner-day-heading"><div className="section-heading"><div><p className="eyebrow">Your next stops</p><h2 id="owner-day-heading">Today & upcoming</h2></div><button className="secondary" onClick={()=>onNavigate('Calendar')}><Icon name="calendar"/>Calendar</button></div>
  {error?<div role="alert"><p className="error">Appointments could not load. {error}</p><button className="secondary" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:!data?<p role="status">Loading your confirmed appointments…</p>:<>
   {!data.calls.length&&<p>No confirmed appointments ahead. Review new requests or open Calendar to choose a time.</p>}
   <div className="owner-stop-list">{data.calls.slice(0,3).map((c,i)=>{const format=(value:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('en-US',{timeZone:data.timezone,...options}).format(new Date(value));return <article className={'owner-stop '+(i===0?'owner-stop-next':'')} key={c.id}>
    <p className="eyebrow">{i===0?'Next stop · ':''}{ownerDayLabel(c,data.timezone)}</p><h3>{c.name}</h3>
    <p className="owner-stop-time"><Icon name="calendar"/>{format(c.arrivalAt,{weekday:'short',month:'short',day:'numeric'})}<strong>{format(c.arrivalAt,{hour:'numeric',minute:'2-digit',timeZoneName:'short'})}</strong></p>
    {c.startAt!==c.arrivalAt&&<p className="tiny">Work / pickup starts {format(c.startAt,{hour:'numeric',minute:'2-digit',timeZoneName:'short'})}</p>}
    <p><Icon name="pin"/>{c.address}</p><p>{c.tasks.join(' · ')}</p><button onClick={()=>onOpen(c.requestId)}>Open job<Icon name="arrow"/></button>
   </article>;})}</div>
   {(data.calls.length>3||data.hasMore)&&<p className="tiny">Showing your next 3 stops. Calendar contains the rest of your schedule.</p>}
   <p className="tiny">Confirmed schedule · refreshed {new Intl.DateTimeFormat('en-US',{timeZone:data.timezone,hour:'numeric',minute:'2-digit'}).format(new Date(data.checkedAt))}. Open the job to check its current work and billing status.</p>
  </>}
 </section>;
}
