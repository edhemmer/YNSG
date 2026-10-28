'use client';
import {useEffect,useState} from 'react';
import {z} from 'zod';
import {sessionFetch} from '../lib/session-fetch';
const schema=z.object({tasks:z.array(z.object({id:z.string(),request_id:z.string(),title:z.string(),detail:z.string(),task_kind:z.string()})),hasMore:z.boolean()});
type Attention=z.infer<typeof schema>;
/** Small, read-only approval entry point. Authoritative actions remain in the job. */
export default function FieldAgentAttention({organization,revision,onOpen}:{organization:string;revision:number;onOpen:(id:string)=>void}){
 const [saved,setSaved]=useState<{org:string;value:Attention}|null>(null);
 const [error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let live=true,inFlight=false;
  setSaved(null);setError(false);
  async function read(){
   if(inFlight)return;
   inFlight=true;
   try{
    const response=await sessionFetch('/api/field-agent?'+new URLSearchParams({organization}),{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('UNAVAILABLE');
    const value=schema.parse(await response.json());
    if(live){setSaved({org:organization,value});setError(false);}
   }catch{if(live&&!controller.signal.aborted)setError(true);}
   finally{inFlight=false;}
  }
  void read();
  const refresh=()=>{if(document.visibilityState==='visible')void read();};
  const timer=setInterval(refresh,30000);
  document.addEventListener('visibilitychange',refresh);
  return()=>{live=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[organization,revision,retry]);
 const tasks=saved?.org===organization?saved.value.tasks:[];
 const first=tasks[0];
 if(!first&&!error)return null;
 return <section className="field-queue-section" aria-label="Prepared decisions requiring your approval">
  <div className="section-heading"><h2>Ready for your decision</h2><span className="tiny">Prepared automatically · not approved</span></div>
  {error&&<div role="alert"><p>Could not check the latest decisions. {saved?.org===organization?"Previously loaded decisions are shown below; check the job before acting.":"No current decision list is available."}</p><button type="button" className="secondary" onClick={()=>setRetry(n=>n+1)}>Retry decisions</button></div>}
  {first&&<button type="button" className="secondary field-queue-row" onClick={()=>onOpen(first.request_id)}>
   <span><strong>{first.title}</strong><small>{first.detail}</small></span><span>Review</span>
  </button>}
  {tasks.length>1&&<details><summary>{tasks.length-1} more prepared {tasks.length===2?'decision':'decisions'}</summary><div className="field-queue-list">{tasks.slice(1).map(t=><button type="button" className="secondary field-queue-row" key={t.id} onClick={()=>onOpen(t.request_id)}><span><strong>{t.title}</strong><small>{t.detail}</small></span><span>Review</span></button>)}</div></details>}
 </section>;
}
