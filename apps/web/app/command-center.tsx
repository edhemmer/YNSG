'use client';
import {useEffect,useState} from 'react';
import {z} from 'zod';
import {sessionFetch} from '../lib/session-fetch';
import {ownerDayResponse,ownerStopCall,ownerStopDirections,type OwnerDay} from '../lib/owner-day';
import {ownerWorkResponse,type OwnerWork} from '../lib/owner-work';
import Icon from './crm-icons';
import {fieldSearchMatches} from '../lib/field-search';
import {navigationUrl} from '../lib/day-plan';

const decisions=z.object({total:z.number().int().nonnegative(),hasMore:z.boolean(),requests:z.array(z.object({id:z.uuid(),status:z.string(),original_submission:z.object({name:z.string(),street:z.string().optional(),city:z.string().optional(),service:z.string().optional(),task:z.string().optional(),services:z.array(z.object({service:z.string(),task:z.string()})).optional()}),appointments:z.array(z.object({status:z.string()}))})).max(20)});
type Decisions=z.infer<typeof decisions>;
type Reads={day:OwnerDay|null;work:OwnerWork|null;requests:Decisions|null;errors:string[];denied:boolean};
export default function CommandCenter({organization,timezone,revision,onOpen,onNavigate}:{organization:string;timezone:string;revision:number;onOpen:(id:string)=>void;onNavigate:(section:string)=>void}){
 const [stored,setStored]=useState<{organization:string;value:Reads}|null>(null),[retry,setRetry]=useState(0),[refreshing,setRefreshing]=useState(true);
 const [search,setSearch]=useState({organization,query:''});
 const query=search.organization===organization?search.query:'';
 useEffect(()=>{
  let live=true,inFlight=false,firstRead=true;const controller=new AbortController();setStored(null);setRefreshing(true);
  async function read(){
   if(inFlight)return;inFlight=true;if(firstRead)setRefreshing(true);
   const sources=[['day','/api/owner-day',ownerDayResponse],['work','/api/owner-work',ownerWorkResponse],['requests','/api/request-inbox',decisions]] as const;
   const results=await Promise.allSettled(sources.map(async([,path,schema])=>{
    const r=await sessionFetch(path+'?'+new URLSearchParams({organization,...(path.includes('inbox')?{filter:'review'}:{})}),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
    if(r.status===401||r.status===403){if(live)setStored({organization,value:{day:null,work:null,requests:null,errors:['Company access'],denied:true}});throw Error('ACCESS_DENIED');}
    if(!r.ok)throw Error('UNAVAILABLE');return schema.parse(await r.json());
   }));
   if(live){const value:Reads={day:null,work:null,requests:null,errors:[],denied:results.some(r=>r.status==='rejected'&&r.reason instanceof Error&&r.reason.message==='ACCESS_DENIED')};if(value.denied)value.errors=['Company access'];else results.forEach((r,i)=>{const key=sources[i]![0];if(r.status==='fulfilled'){if(key==='day')value.day=r.value as OwnerDay;else if(key==='work')value.work=r.value as OwnerWork;else value.requests=r.value as Decisions;}else value.errors.push(key==='day'?'Appointments':key==='work'?'Unfinished work':'Requests');});setStored({organization,value});setRefreshing(false);firstRead=false;}inFlight=false;
  }
  void read();const resume=()=>{if(document.visibilityState==='visible')void read();};const timer=setInterval(resume,30000);document.addEventListener('visibilitychange',resume);
  return()=>{live=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',resume);};
 },[organization,revision,retry]);
 const data=stored?.organization===organization?stored.value:null;
 const work=[...(data?.work?.items||[])].sort((a,b)=>({working:0,paused:1,completed:2}[a.status]-{working:0,paused:1,completed:2}[b.status]));
 // Only an actively running/paused job replaces a visit card; completed uninvoiced work must not hide a later appointment.
 const activeRequestIds=new Set(work.filter(j=>j.status==='working'||j.status==='paused').map(j=>j.request));
 const seenVisits=new Set<string>();
 const stops=[...(data?.day?.calls||[])].sort((a,b)=>Date.parse(a.arrivalAt)-Date.parse(b.arrivalAt)).filter(c=>{if(activeRequestIds.has(c.requestId)||seenVisits.has(c.id))return false;seenVisits.add(c.id);return true;});
 // The review feed is an independent owner-action queue: a linked job or reserved appointment must not hide a separate decision.
 const pending=(data?.requests?.requests||[]).filter(r=>!['declined','canceled'].includes(r.status));
 // Multiple legitimate jobs can share one service request. Deduplicate the exact job only, not the customer request.
 const shownWork=work.filter((j,i)=>work.findIndex(other=>other.job===j.job)===i);
 const activeWork=shownWork.find(j=>j.status==='working'||j.status==='paused');
 const next=activeWork||(!stops.length?shownWork[0]:null),nextStop=!next?stops[0]:null;
 const remainingWork=shownWork.filter(j=>j.job!==next?.job);
 const searching=query.trim().length>0;
 const foundWork=shownWork.filter(j=>fieldSearchMatches(query,[j.name,j.address,...j.tasks,j.status,j.status==='completed'?'invoice':'']));
 const foundStops=stops.filter(c=>fieldSearchMatches(query,[c.name,c.address,...c.tasks,'appointment']));
 const foundRequests=pending.filter(r=>fieldSearchMatches(query,[r.original_submission.name,r.original_submission.street||'',r.original_submission.city||'',r.status,r.original_submission.task||'',r.original_submission.service||'',...(r.original_submission.services||[]).flatMap(t=>[t.task,t.service]),'request']));
 const foundCount=foundWork.length+foundStops.length+foundRequests.length;
 const time=(value:string)=>new Intl.DateTimeFormat('en-US',{timeZone:data?.day?.timezone||timezone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
 return <section className="field-desk" aria-label="Field work queue" aria-busy={refreshing}>
  {data?.errors.length? <div className="note" role="alert"><p>{data.denied?'Company access could not be verified. Protected jobs and requests are hidden. Retry after checking your access.':data.errors.join(', ')+' could not refresh. Check these before relying on the queue.'}</p><button type="button" className="secondary" onClick={()=>setRetry(n=>n+1)}>Retry queue</button></div>:null}
  {!data?<p role="status">Loading your work queue…</p>:data.denied?null:<>
   <div className="field-search"><label htmlFor="field-search">Find in your work queue</label><div className="field-search-input"><input id="field-search" type="search" value={query} maxLength={200} autoComplete="off" placeholder="Customer, street, or job" onChange={e=>setSearch({organization,query:e.target.value})}/>{query&&<button type="button" className="secondary" onClick={()=>setSearch({organization,query:''})}>Clear</button>}</div></div>
   {searching?<section className="field-queue-section" aria-label="Matching work"><p role="status">{foundCount} {foundCount===1?'match':'matches'} in the loaded queue{data.errors.length?' · some records are unavailable':''}.</p><div className="field-queue-list">{foundWork.map(j=><button type="button" className="secondary field-queue-row" key={j.job} onClick={()=>onOpen(j.request)}><span><strong>{j.name}</strong><small>{j.status==='completed'?'Prepare invoice':j.status==='paused'?'Resume work':'Continue work'} · {j.address}</small></span><Icon name="arrow"/></button>)}{foundStops.map(c=><button type="button" className="secondary field-queue-row" key={c.id} onClick={()=>onOpen(c.requestId)}><span><strong>{c.name}</strong><small>{time(c.arrivalAt)} · {c.address}</small></span><Icon name="arrow"/></button>)}{foundRequests.map(r=><button type="button" className="secondary field-queue-row" key={r.id} onClick={()=>onOpen(r.id)}><span><strong>{r.original_submission.name}</strong><small>{['Review request',r.original_submission.street,r.original_submission.city].filter(Boolean).join(' · ')}</small></span><Icon name="arrow"/></button>)}</div><p className="tiny">Search covers loaded work, upcoming visits and requests. For older or additional records, open Jobs, Calendar or Requests.</p><div className="actions"><button type="button" className="secondary" onClick={()=>onNavigate('Work')}>Jobs</button><button type="button" className="secondary" onClick={()=>onNavigate('Calendar')}>Calendar</button><button type="button" className="secondary" onClick={()=>onNavigate('Requests')}>Requests</button></div></section>:<>
   {next?<section className="field-current card" aria-label="Current job"><span className="status-pill">{next.status==='working'?'Timer running':next.status==='paused'?'Work paused':'Work completed · invoice needed'}</span><h2>{next.name}</h2><p>{next.tasks.join(' · ')}</p><p>{next.address}</p><div className="actions"><button type="button" onClick={()=>onOpen(next.request)}>{next.status==='completed'?'Prepare invoice':next.status==='paused'?'Review paused job':'Continue job'}<Icon name="arrow"/></button>{navigationUrl(next.address)&&<a className="button secondary" href={navigationUrl(next.address)!} target="_blank" rel="noopener noreferrer" aria-label={'Directions to '+next.name}>Directions</a>}</div></section>:nextStop?<section className="field-current card" aria-label="Next appointment"><span className="status-pill">Next appointment</span><p className="field-stop-time">{time(nextStop.arrivalAt)}</p><h2>{nextStop.name}</h2><p>{nextStop.tasks.join(' · ')}</p><p>{nextStop.address}</p><div className="actions"><button type="button" onClick={()=>onOpen(nextStop.requestId)}>Open job<Icon name="arrow"/></button>{ownerStopDirections(nextStop.address)&&<a className="button secondary" href={ownerStopDirections(nextStop.address)!} target="_blank" rel="noopener noreferrer">Directions</a>}{ownerStopCall(nextStop.phone)&&<a className="button secondary" href={ownerStopCall(nextStop.phone)!}>Call</a>}</div></section>:pending.length?<section className="field-current card" aria-label="Next request decision"><span className="status-pill">Customer decision needed</span><h2>{pending[0]!.original_submission.name}</h2><p>{pending[0]!.original_submission.services?.map(t=>t.task||t.service).join(' · ')||pending[0]!.original_submission.task||pending[0]!.original_submission.service||'Review service request'}</p><button type="button" onClick={()=>onOpen(pending[0]!.id)}>Review request<Icon name="arrow"/></button></section>:data.errors.length===0?<p className="card">No unfinished work, upcoming appointments, or requests requiring a decision in the loaded queue.</p>:null}
   <section className="field-queue-section" aria-label="Requests awaiting a decision"><div className="section-heading"><h2>Requests needing a decision{pending.length?` (${pending.length}${data.requests?.hasMore?'+':''})`:data.requests?.hasMore?' (+ more)':''}</h2><button type="button" className="secondary" onClick={()=>onNavigate('Requests')}>All requests</button></div>{data.requests?pending.length?<div className="field-queue-list">{pending.slice(0,3).map(r=><button type="button" className="secondary field-queue-row" key={r.id} onClick={()=>onOpen(r.id)}><span><strong>{r.original_submission.name}</strong><small>{r.original_submission.services?.map(t=>t.task||t.service).join(' · ')||r.original_submission.task||r.original_submission.service||'Review service request'}</small></span><span>Review<Icon name="arrow"/></span></button>)}</div>:<p>No outstanding decisions in the loaded queue. Check All requests for additional records.</p>:<p>Requests are unavailable. Open Requests to retry.</p>}{data.requests&&(data.requests.hasMore||pending.length>3)&&<p className="tiny">Open All requests for the complete paginated list.</p>}</section>
   {(remainingWork.length>0||stops.length>(nextStop?1:0))&&<details className="field-queue-section field-later" aria-label="Remaining work"><summary>Other work & upcoming stops</summary><div className="field-queue-list">{remainingWork.map(j=><button type="button" className="secondary field-queue-row" key={j.job} onClick={()=>onOpen(j.request)}><span><strong>{j.name}</strong><small>{j.status==='completed'?'Prepare invoice':j.status==='paused'?'Resume work':'Continue work'}</small></span><Icon name="arrow"/></button>)}{stops.slice(nextStop?1:0).map(c=><button type="button" className="secondary field-queue-row" key={c.id} onClick={()=>onOpen(c.requestId)}><span><strong>{c.name}</strong><small>{time(c.arrivalAt)} · {c.tasks.slice(0,2).join(' · ')}</small></span><Icon name="arrow"/></button>)}</div></details>}
   {data.work?.hasMore&&<button className="secondary" onClick={()=>onNavigate('Work')}>All unfinished jobs</button>}{data.day?.hasMore&&<button className="secondary" onClick={()=>onNavigate('Calendar')}>All appointments</button>}

  </>}</>}
  <nav className="field-desk-links" aria-label="Field shortcuts"><button className="secondary" onClick={()=>onNavigate('Today')}><Icon name="pin"/>Day route</button><button className="secondary" onClick={()=>onNavigate('Money')}><Icon name="money"/>Invoices & receipts</button></nav>
 </section>;
}
