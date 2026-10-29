'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {ownerDayResponse,ownerDayLabel,ownerStopDirections,ownerStopCall,type OwnerDay} from '../lib/owner-day';
import Icon from './crm-icons';
export default function OwnerDay({organization,revision,onNavigate,onOpen}:{organization:string;revision:number;onNavigate:(section:string)=>void;onOpen:(requestId:string)=>void}){
 const [stored,setStored]=useState<{organization:string;data:OwnerDay|null;error:string}|null>(null),[retry,setRetry]=useState(0),[refreshing,setRefreshing]=useState(true);
 const data=stored?.organization===organization?stored.data:null,error=stored?.organization===organization?stored.error:'';
 useEffect(()=>{let live=true,inFlight=false;const controller=new AbortController();setStored(null);setRefreshing(true);
  async function read(){if(inFlight)return;inFlight=true;setRefreshing(true);try{const r=await sessionFetch('/api/owner-day?'+new URLSearchParams({organization}),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});const d=await r.json();if(!r.ok)throw Error(d.error);if(live){setStored({organization,data:ownerDayResponse.parse(d),error:''});}}catch(e){if(live&&!controller.signal.aborted){setStored({organization,data:null,error:publicError(e)});}}finally{inFlight=false;if(live)setRefreshing(false);}}
  void read();const refresh=()=>{if(document.visibilityState==='visible')void read();};const timer=setInterval(refresh,30000);document.addEventListener('visibilitychange',refresh);
  return()=>{live=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[organization,revision,retry]);
 return <section className="card owner-day" aria-labelledby="owner-day-heading" aria-busy={refreshing}><div className="section-heading"><div><p className="eyebrow">Your next stops</p><h2 id="owner-day-heading">Today & upcoming</h2></div><div className="owner-day-heading-actions"><button type="button" className="secondary" disabled={refreshing} onClick={()=>setRetry(n=>n+1)}>{refreshing?'Refreshing…':'Refresh'}</button><button type="button" className="secondary" onClick={()=>onNavigate('Calendar')}><Icon name="calendar"/>Calendar</button></div></div>
  {error?<div role="alert"><p className="error">Appointments could not load. {error}</p><button className="secondary" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:!data?<p role="status">Loading your confirmed appointments…</p>:<>
   {!data.calls.length&&<p>No confirmed appointments ahead. Review new requests or open Calendar to choose a time.</p>}
   <div className="owner-stop-list">{data.calls.slice(0,1).map((c,i)=>{const format=(value:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('en-US',{timeZone:data.timezone,...options}).format(new Date(value));return <article className={'owner-stop '+(i===0?'owner-stop-next':'')} key={c.id}>
    <p className="eyebrow">{i===0?'Next stop · ':''}{ownerDayLabel(c,data.timezone)}</p><h3>{c.name}</h3>
    <p className="owner-stop-time"><Icon name="calendar"/>{format(c.arrivalAt,{weekday:'short',month:'short',day:'numeric'})}<strong>{format(c.arrivalAt,{hour:'numeric',minute:'2-digit',timeZoneName:'short'})}</strong></p>
    {c.startAt!==c.arrivalAt&&<p className="tiny">Work / pickup starts {format(c.startAt,{hour:'numeric',minute:'2-digit',timeZoneName:'short'})}</p>}
    <p><Icon name="pin"/>{c.address||'Address needs review'}</p><p>{c.tasks.join(' · ')}</p>
    <div className="owner-stop-quick-actions">
     {ownerStopDirections(c.address)&&<a className="secondary owner-stop-link" href={ownerStopDirections(c.address)!} target="_blank" rel="noopener noreferrer" aria-label={`Get directions to ${c.name}`}>Directions</a>}
     {ownerStopCall(c.phone)&&<a className="secondary owner-stop-link" href={ownerStopCall(c.phone)!} aria-label={`Call ${c.name}`}>Call</a>}
    </div>
    <button type="button" className="button" onClick={()=>onOpen(c.requestId)}>Open job<Icon name="arrow"/></button>
   </article>;})}</div>
   {data.calls.length>1&&<details className="owner-upcoming-stops"><summary>Next {data.calls.length-1} upcoming {data.calls.length-1===1?'stop':'stops'}</summary><div className="owner-stop-list">{data.calls.slice(1).map(c=><article className="owner-stop" key={c.id}><strong>{c.name}</strong><p className="owner-upcoming-time">{new Intl.DateTimeFormat('en-US',{timeZone:data.timezone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(c.arrivalAt))}</p><p>{c.address||'Address needs review'}</p><p>{c.tasks.slice(0,2).join(' · ')}</p><div className="owner-upcoming-actions"><button type="button" className="secondary" onClick={()=>onOpen(c.requestId)}>Open job <Icon name="arrow"/></button>{ownerStopDirections(c.address)&&<a className="secondary owner-stop-link" href={ownerStopDirections(c.address)!} target="_blank" rel="noopener noreferrer" aria-label={`Get directions to ${c.name}`}>Directions</a>}{ownerStopCall(c.phone)&&<a className="secondary owner-stop-link" href={ownerStopCall(c.phone)!} aria-label={`Call ${c.name}`}>Call</a>}</div></article>)}</div></details>}{data.hasMore&&<p className="tiny">More confirmed visits are available in Calendar.</p>}

  </>}
 </section>;
}
