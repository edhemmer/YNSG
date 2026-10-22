'use client';
import {useEffect,useState} from 'react';
import {z} from 'zod';
import {sessionFetch} from '../lib/session-fetch';
import {ownerDayResponse,ownerStopCall,ownerStopDirections,type OwnerDay} from '../lib/owner-day';
import {ownerWorkResponse,type OwnerWork} from '../lib/owner-work';
import Icon from './crm-icons';

const decisions=z.object({total:z.number().int().nonnegative(),hasMore:z.boolean(),requests:z.array(z.object({id:z.uuid(),status:z.string(),original_submission:z.object({name:z.string(),service:z.string().optional(),task:z.string().optional(),services:z.array(z.object({service:z.string(),task:z.string()})).optional()}),appointments:z.array(z.object({status:z.string()}))})).max(20)});
type Decisions=z.infer<typeof decisions>;
type Reads={day:OwnerDay|null;work:OwnerWork|null;requests:Decisions|null;errors:string[]};
export default function CommandCenter({organization,timezone,revision,onOpen,onNavigate}:{organization:string;timezone:string;revision:number;onOpen:(id:string)=>void;onNavigate:(section:string)=>void}){
 const [stored,setStored]=useState<{organization:string;value:Reads}|null>(null),[retry,setRetry]=useState(0),[refreshing,setRefreshing]=useState(true);
 useEffect(()=>{
  let live=true,inFlight=false;const controller=new AbortController();setStored(null);setRefreshing(true);
  async function read(){
   if(inFlight)return;inFlight=true;setRefreshing(true);
   const sources=[['day','/api/owner-day',ownerDayResponse],['work','/api/owner-work',ownerWorkResponse],['requests','/api/request-inbox',decisions]] as const;
   const results=await Promise.allSettled(sources.map(async([,path,schema])=>{
    const r=await sessionFetch(path+'?'+new URLSearchParams({organization,...(path.includes('inbox')?{filter:'review'}:{})}),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
    if(!r.ok)throw Error('UNAVAILABLE');return schema.parse(await r.json());
   }));
   if(live){const value:Reads={day:null,work:null,requests:null,errors:[]};results.forEach((r,i)=>{const key=sources[i]![0];if(r.status==='fulfilled'){if(key==='day')value.day=r.value as OwnerDay;else if(key==='work')value.work=r.value as OwnerWork;else value.requests=r.value as Decisions;}else value.errors.push(key==='day'?'Appointments':key==='work'?'Unfinished work':'Requests');});setStored({organization,value});setRefreshing(false);}inFlight=false;
  }
  void read();const resume=()=>{if(document.visibilityState==='visible')void read();};const timer=setInterval(resume,30000);document.addEventListener('visibilitychange',resume);
  return()=>{live=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',resume);};
 },[organization,revision,retry]);
 const data=stored?.organization===organization?stored.value:null;
 const work=[...(data?.work?.items||[])].sort((a,b)=>({working:0,paused:1,completed:2}[a.status]-{working:0,paused:1,completed:2}[b.status]));
 const used=new Set(work.map(j=>j.request));
 const stops=(data?.day?.calls||[]).filter(c=>{if(used.has(c.requestId))return false;used.add(c.requestId);return true;});
 const pending=(data?.requests?.requests||[]).filter(r=>!used.has(r.id)&&!['declined','canceled'].includes(r.status)&&!r.appointments.some(a=>a.status==='reserved'));
 const shownWork=work.filter((j,i)=>work.findIndex(other=>other.request===j.request)===i);
 const next=shownWork[0],nextStop=!next?stops[0]:null;
 const time=(value:string)=>new Intl.DateTimeFormat('en-US',{timeZone:data?.day?.timezone||timezone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
 return <section className="field-desk" aria-label="Field work queue" aria-busy={refreshing}>
  {data?.errors.length? <div className="note" role="alert"><p>{data.errors.join(', ')} could not refresh. Check these before relying on the queue.</p><button type="button" className="secondary" onClick={()=>setRetry(n=>n+1)}>Retry queue</button></div>:null}
  {!data?<p role="status">Loading your work queue…</p>:<>
   {next?<section className="field-current card" aria-label="Current job"><span className="status-pill">{next.status==='working'?'Timer running':next.status==='paused'?'Work paused':'Work completed · invoice needed'}</span><h2>{next.name}</h2><p>{next.tasks.join(' · ')}</p><p>{next.address}</p><button type="button" onClick={()=>onOpen(next.request)}>{next.status==='completed'?'Prepare invoice':'Continue job'}<Icon name="arrow"/></button></section>:nextStop?<section className="field-current card" aria-label="Next appointment"><span className="status-pill">Next appointment</span><p className="field-stop-time">{time(nextStop.arrivalAt)}</p><h2>{nextStop.name}</h2><p>{nextStop.tasks.join(' · ')}</p><p>{nextStop.address}</p><div className="actions"><button type="button" onClick={()=>onOpen(nextStop.requestId)}>Open job<Icon name="arrow"/></button>{ownerStopDirections(nextStop.address)&&<a className="button secondary" href={ownerStopDirections(nextStop.address)!} target="_blank" rel="noopener noreferrer">Directions</a>}{ownerStopCall(nextStop.phone)&&<a className="button secondary" href={ownerStopCall(nextStop.phone)!}>Call</a>}</div></section>:data.errors.length===0?<p className="card">No unfinished work or upcoming appointments. New requests are below.</p>:null}
   {(shownWork.length>1||stops.length>(nextStop?1:0))&&<details className="field-queue-section field-later" aria-label="Remaining work"><summary>Other work & upcoming stops</summary><div className="field-queue-list">{shownWork.slice(1).map(j=><button type="button" className="secondary field-queue-row" key={j.request} onClick={()=>onOpen(j.request)}><span><strong>{j.name}</strong><small>{j.status==='completed'?'Prepare invoice':j.status==='paused'?'Resume work':'Continue work'}</small></span><Icon name="arrow"/></button>)}{stops.slice(nextStop?1:0).map(c=><button type="button" className="secondary field-queue-row" key={c.id} onClick={()=>onOpen(c.requestId)}><span><strong>{c.name}</strong><small>{time(c.arrivalAt)} · {c.tasks.slice(0,2).join(' · ')}</small></span><Icon name="arrow"/></button>)}</div></details>}
   {data.work?.hasMore&&<button className="secondary" onClick={()=>onNavigate('Work')}>All unfinished jobs</button>}{data.day?.hasMore&&<button className="secondary" onClick={()=>onNavigate('Calendar')}>All appointments</button>}
   <section className="field-queue-section" aria-label="Requests awaiting a decision"><div className="section-heading"><h2>New requests</h2><button type="button" className="secondary" onClick={()=>onNavigate('Requests')}>All requests</button></div>{data.requests?pending.length?<div className="field-queue-list">{pending.slice(0,3).map(r=><button type="button" className="secondary field-queue-row" key={r.id} onClick={()=>onOpen(r.id)}><span><strong>{r.original_submission.name}</strong><small>{r.original_submission.services?.map(t=>t.task||t.service).join(' · ')||r.original_submission.task||r.original_submission.service||'Review service request'}</small></span><span>Review<Icon name="arrow"/></span></button>)}</div>:<p>No unconfirmed requests on this page.</p>:<p>Requests are unavailable. Open Requests to retry.</p>}{data.requests&&(data.requests.hasMore||pending.length>3)&&<p className="tiny">Open All requests for the complete paginated list.</p>}</section>
  </>}
  <nav className="field-desk-links" aria-label="Field shortcuts"><button className="secondary" onClick={()=>onNavigate('Today')}><Icon name="pin"/>Day route</button><button className="secondary" onClick={()=>onNavigate('Money')}><Icon name="money"/>Invoices & receipts</button></nav>
 </section>;
}
