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
 return <section className="card" aria-label="Unfinished jobs"><div className="section-heading"><div><p className="eyebrow">Keep the day moving</p><h2>Work to finish</h2></div><button className="secondary" onClick={()=>setRetry(n=>n+1)}><Icon name="refresh"/>Refresh jobs</button></div>
  {error?<p role="alert" className="error">Jobs could not load. {error}</p>:!data?<p role="status">Checking unfinished work…</p>:<>
   <p>{data.total} job{data.total===1?'':'s'} working, paused or awaiting an invoice. Earlier appointments stay here until their work is invoiced.</p>
   {data.items.map(j=><article className="owner-stop" key={j.job}><p className="status-pill">{j.status==='completed'?'Ready for invoice review':j.status==='paused'?'Work paused':'Work in progress'}</p><h3>{j.name}</h3><p>{j.address}</p><p>{j.tasks.join(' · ')}</p><button onClick={()=>onOpen(j.request)}>{j.status==='completed'?'Review invoice':'Continue work'}<Icon name="arrow"/></button></article>)}
   {!data.items.length&&<p>No unfinished work on this page. Scheduled visits are in Calendar; issued invoices and balances are in Invoices & money.</p>}
   <div className="list-pagination"><span>Page {page+1} · up to 20 jobs</span><div className="actions"><button className="secondary" disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous jobs</button><button className="secondary" disabled={!data.hasMore} onClick={()=>setPage(p=>p+1)}>More jobs</button></div></div>
  </>}
 </section>;
}
