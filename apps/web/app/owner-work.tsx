'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {ownerWorkResponse,type OwnerWork} from '../lib/owner-work';
import Icon from './crm-icons';
import {navigationUrl} from '../lib/day-plan';
const directionsFor=(address:string)=>navigationUrl(address);
export default function OwnerWork({organization,revision,onOpen}:{organization:string;revision:number;onOpen:(requestId:string)=>void}){
 const [snapshotKey,setSnapshotKey]=useState(''),[refreshing,setRefreshing]=useState(false);const [page,setPage]=useState(0),[statusFilter,setStatusFilter]=useState<'all'|'working'|'paused'|'completed'>('all'),[data,setData]=useState<OwnerWork|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true,inFlight=false;const controller=new AbortController();setError('');
  async function read(){if(inFlight)return;inFlight=true;setRefreshing(true);try{const r=await sessionFetch('/api/owner-work?'+new URLSearchParams({organization,page:String(page),status:statusFilter}),{cache:'no-store',signal:controller.signal});const d=await r.json();if(!r.ok)throw Error(d.error);if(live){setData(ownerWorkResponse.parse(d));setSnapshotKey(organization+':'+page+':'+statusFilter);setError('');}}catch(e){if(live&&!controller.signal.aborted){setError(publicError(e));}}finally{inFlight=false;if(live)setRefreshing(false);}}
  void read();const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},30000);
  // Returning from directions or another app should show the latest job state promptly.
  const onReturn=()=>{if(document.visibilityState==='visible')void read();};
  document.addEventListener('visibilitychange',onReturn);
  return()=>{live=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',onReturn);};
 },[organization,revision,page,statusFilter,retry]);
 const visible=data&&snapshotKey===organization+':'+page+':'+statusFilter?data:null;
 return <section className="card owner-jobs-compact" aria-label="Unfinished jobs">
 <header className="owner-jobs-heading"><p>{visible?visible.total+' unfinished '+(visible.total===1?'job':'jobs'):'Unfinished work'}</p><button type="button" className="secondary" disabled={refreshing} aria-label="Refresh current jobs" onClick={()=>setRetry(n=>n+1)}>{refreshing?'Refreshing…':'Refresh jobs'}</button></header>
 {error&&<div role="alert"><p className="error">{visible?'Could not refresh jobs; showing the last saved view. ':'Could not load jobs. '}{error}</p><button type="button" className="secondary" onClick={()=>setRetry(n=>n+1)}>Retry jobs</button></div>}{!visible?<p role="status">Loading jobs…</p>:<>
 {refreshing&&<span className="tiny" role="status">Checking current job status…</span>}
 <div className="owner-job-filters" role="group" aria-label="Filter unfinished jobs">{([["all","All"],["working","In progress"],["paused","Paused"],["completed","Needs invoice"]] as const).map(([value,label])=><button key={value} type="button" className={statusFilter===value?"button":"secondary"} aria-pressed={statusFilter===value} onClick={()=>{setPage(0);setStatusFilter(value);}}>{label}</button>)}</div>
 <div className="owner-jobs-list">{visible.items.map(j=><article className="owner-job-row" key={j.job}>
  <div className="owner-job-main"><span className="owner-job-status">{j.status==='completed'?'Needs invoice':j.status==='paused'?'Paused':j.status==='working'?'In progress':'Needs attention'}</span><h3>{j.name}</h3><p className="owner-job-services">{j.tasks.slice(0,2).join(' · ')}{j.tasks.length>2?' · +'+(j.tasks.length-2)+' more':''}</p><details className="owner-job-extra"><summary>Full job details</summary><p>{j.address}</p><p>{j.tasks.join(' · ')}</p></details></div>
  <div className="owner-job-quick-actions">{directionsFor(j.address)&&<a className="secondary" href={directionsFor(j.address)!} target="_blank" rel="noopener noreferrer" aria-label={"Directions to "+j.name}><Icon name="pin"/> Directions</a>}<button type="button" className="button owner-job-action" onClick={()=>onOpen(j.request)}>{j.status==='completed'?'Review invoice':j.status==='paused'?'Resume job':'Open job'}<Icon name="arrow"/></button></div>
 </article>)}</div>
 {!visible.items.length&&statusFilter==='all'&&<p>All caught up. Scheduled visits are in Calendar.</p>}{visible.items.length===0&&statusFilter!=='all'&&<p className="note">No jobs match this filter. Choose All to see other jobs.</p>}
 {(visible.hasMore||page>0)&&<nav className="owner-jobs-pages" aria-label="Job pages"><button type="button" className="secondary" disabled={page===0} onClick={()=>setPage(v=>v-1)}>Previous</button><span>Page {page+1}</span><button type="button" className="secondary" disabled={!visible.hasMore} onClick={()=>setPage(v=>v+1)}>Next</button></nav>}
 </>}
 </section>;
}
