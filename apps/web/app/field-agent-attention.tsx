'use client';
import {useEffect,useState} from 'react';
import {z} from 'zod';
import {sessionFetch} from '../lib/session-fetch';
const schema=z.object({tasks:z.array(z.object({id:z.string(),request_id:z.string(),title:z.string(),detail:z.string(),task_kind:z.string()})),hasMore:z.boolean()});
type Attention=z.infer<typeof schema>;
/** Small, read-only approval entry point. Authoritative actions remain in the job. */
export default function FieldAgentAttention({organization,revision,onOpen}:{organization:string;revision:number;onOpen:(id:string)=>void}){
 const [saved,setSaved]=useState<{org:string;value:Attention}|null>(null);
 useEffect(()=>{
  const controller=new AbortController();let live=true;
  setSaved(null);
  async function read(){
   try{
    const response=await sessionFetch('/api/field-agent?'+new URLSearchParams({organization}),{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('UNAVAILABLE');
    const value=schema.parse(await response.json());
    if(live)setSaved({org:organization,value});
   }catch{if(live&&!controller.signal.aborted)setSaved(null);}
  }
  void read();
  const refresh=()=>{if(document.visibilityState==='visible')void read();};
  const timer=setInterval(refresh,30000);
  document.addEventListener('visibilitychange',refresh);
  return()=>{live=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[organization,revision]);
 const tasks=saved?.org===organization?saved.value.tasks:[];
 const first=tasks[0];
 if(!first)return null;
 return <section className="field-queue-section" aria-label="Prepared decisions requiring your approval">
  <div className="section-heading"><h2>Ready for your decision</h2><span className="tiny">Prepared automatically · not approved</span></div>
  <button type="button" className="secondary field-queue-row" onClick={()=>onOpen(first.request_id)}>
   <span><strong>{first.title}</strong><small>{first.detail}</small></span><span>Review</span>
  </button>
  {tasks.length>1&&<details><summary>{tasks.length-1} more prepared {tasks.length===2?'decision':'decisions'}</summary><div className="field-queue-list">{tasks.slice(1).map(t=><button type="button" className="secondary field-queue-row" key={t.id} onClick={()=>onOpen(t.request_id)}><span><strong>{t.title}</strong><small>{t.detail}</small></span><span>Review</span></button>)}</div></details>}
 </section>;
}
