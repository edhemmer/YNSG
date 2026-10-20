'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {ownerWorkResponse,type OwnerWork} from '../lib/owner-work';
import Icon from './crm-icons';
export default function OwnerWork({organization,revision,onOpen}:{organization:string;revision:number;onOpen:(id:string)=>void}){
 const [page,setPage]=useState(0),[data,setData]=useState<OwnerWork|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true,inFlight=false;const controller=new AbortController();setData(null);setError('');
  async function read(){if(inFlight)return;inFlight=true;try{const r=await sessionFetch('/api/owner-work?'+new URLSearchParams({organization,page:String(page)}),{cache:'no-store',signal:controller.signal});const d=await r.json();if(!r.ok)throw Error(d.error);if(live){setData(ownerWorkResponse.parse(d));setError('');}}catch(e){if(live&&!controller.signal.aborted){setData(null);setError(publicError(e));}}finally{inFlight=false;}}
  void read();const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},30000);return()=>{live=false;controller.abort();clearInterval(timer);};
 },[organization,revision,page,retry]);
 return <section className="card owner-jobs-compact" aria-label="Unfinished jobs">
 <header className="owner-jobs-heading"><h2>Jobs {data?'('+data.total+')':''}</h2><button type="button" className="secondary" aria-label="Refresh jobs" onClick={()=>setRetry(n=>n+1)}><Icon name="refresh"/>Refresh</button></header>
 {error?<p role="alert" className="error">Could not load jobs. {error}</p>:!data?<p role="status">Loading jobs…</p>:<>
 <div className="owner-jobs-list">{data.items.map(j=><article className="owner-job-row" key={j.job}>
  <div className="owner-job-main"><span className="owner-job-status">{j.status==='completed'?'Invoice ready':j.status==='paused'?'Paused':'In progress'}</span><h3>{j.name}</h3><p>{j.address}</p><p className="owner-job-services">{j.tasks.slice(0,2).join(' · ')}{j.tasks.length>2?' · +'+(j.tasks.length-2)+' more':''}</p></div>
  <a className="button owner-job-action" href={'/owner?'+new URLSearchParams({section:'Work',request:j.request})} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onOpen(j.request);}}>{j.status==='completed'?'Review invoice':'Open job'}<Icon name="arrow"/></a>
 </article>)}</div>
 {!data.items.length&&<p>All caught up. Scheduled visits are in Calendar.</p>}
 {(data.hasMore||page>0)&&<nav className="owner-jobs-pages" aria-label="Job pages"><button type="button" className="secondary" disabled={page===0} onClick={()=>setPage(v=>v-1)}>Previous</button><span>Page {page+1}</span><button type="button" className="secondary" disabled={!data.hasMore} onClick={()=>setPage(v=>v+1)}>Next</button></nav>}
 </>}
 </section>;
}
