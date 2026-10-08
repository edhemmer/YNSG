'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {requestStage,requestTasks,type InboxData} from '../lib/request-inbox';
import Icon from './crm-icons';
export default function RequestInbox({organization,timezone,onOpen,revision,compact=false}:{organization:string;timezone:string;onOpen:(id:string)=>void;revision:number;compact?:boolean}){
 const [data,setData]=useState<InboxData|null>(null),[error,setError]=useState(''),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState('review'),[page,setPage]=useState(0),[reload,setReload]=useState(0),[busy,setBusy]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>{setPage(0);setQuery(search);},250);return()=>clearTimeout(timer);},[search]);
 useEffect(()=>{let active=true,inFlight=false;const controller=new AbortController();setBusy(true);setError('');
  async function read(){if(inFlight)return;inFlight=true;try{const r=await sessionFetch('/api/request-inbox?'+new URLSearchParams({organization,page:String(page),filter,search:query}),{cache:'no-store',signal:controller.signal});const v=await r.json();if(!r.ok)throw Error(v.error);if(active)setData(v);}catch(e){if(active&&!controller.signal.aborted){setError(publicError(e));setData(null);}}finally{inFlight=false;if(active)setBusy(false);}}
  void read();const interval=setInterval(()=>{if(document.visibilityState==='visible')void read();},30000);
  return()=>{active=false;controller.abort();clearInterval(interval);};
 },[organization,page,filter,query,revision,reload]);
 const date=(v:string)=>new Intl.DateTimeFormat('en-US',{timeZone:timezone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v));
 return <section className={'inbox-panel '+(compact?'compact-inbox':'')} aria-label={compact?'Requests needing attention':'Service request inbox'}>
  <div className="section-heading"><div><p className="eyebrow">{compact?'Your next decisions':'Request inbox'}</p><h2>{compact?'Needs your attention':'Every request. One clear next step.'}</h2></div><button type="button" className="icon-button secondary" aria-label="Refresh requests" disabled={busy} onClick={()=>setReload(n=>n+1)}><Icon name="refresh"/></button></div>
  {!compact&&<><div className="inbox-tools"><label className="search-field"><Icon name="search"/><span className="sr-only">Search requests by customer, address, email or phone</span><input type="search" placeholder="Search a name, address, email or phone…" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)}/></label><span className="tiny">Newest requests first</span></div><div className="filter-tabs" role="group" aria-label="Request filters">{[['review','Open requests'],['all','All requests'],['closed','Declined / canceled']].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>{setFilter(value!);setPage(0);}}>{label}</button>)}</div></>}
  {error&&<p role="alert" className="error note">{error}</p>}{!data&&!error&&<div className="loading" role="status">Gathering your requests…</div>}
  {data&&<><div className="inbox-summary"><span>{compact?`${data.needsReview} new or under review`:`${data.total} matching request${data.total===1?'':'s'}`}</span><span className="tiny">{busy?'Updating…':'Auto-updates every 30 seconds'}</span></div>
   <div className="request-list" aria-busy={busy}>{(compact?data.requests.slice(0,5):data.requests).map(r=>{const stage=requestStage(r),s=r.original_submission,tasks=requestTasks(s);return <button type="button" className="request-list-row" key={r.id} onClick={()=>onOpen(r.id)}>
    <span className={'request-avatar avatar-'+stage.tone}>{s.name?.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()||'?'}</span><span className="request-row-main"><span className="request-row-title"><strong>{s.name||'Service request'}</strong><span className={'status-pill tone-'+stage.tone}>{stage.label}</span></span><span className="request-work">{tasks.map(v=>v.task||v.service).join(' · ')}</span><span className="request-address"><Icon name="pin"/>{s.street}, {s.city}</span></span><span className="request-row-next"><time dateTime={r.created_at}>{date(r.created_at)}</time><span>{stage.next}<Icon name="arrow"/></span></span>
   </button>;})}</div>
   {!data.requests.length&&<div className="empty-state"><span className="empty-icon"><Icon name="inbox"/></span><h3>{query?'No matching requests':filter==='review'?'You’re caught up':'No requests in this view'}</h3><p>{query?'Try another name, address, email or phone number.':'New website requests will appear here automatically.'}</p></div>}
   {!compact&&<div className="list-pagination"><span>Page {page+1} · Up to 20 requests per page</span><div className="actions"><button className="secondary" disabled={page===0||busy} onClick={()=>setPage(p=>p-1)}>Previous</button><button className="secondary" disabled={!data.hasMore||busy} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>}
  </>}
 </section>;
}
