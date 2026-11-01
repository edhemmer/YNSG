"use client";
import {useEffect,useState} from 'react';
import {publicError} from '../lib/public-errors';
import {sessionFetch} from '../lib/session-fetch';
import {notificationAttention,notificationName} from '../lib/notification-attention';
import {messageQueue,type MessageQueue} from '../lib/notification-contract';
import {businessTimestamp} from '../lib/business-time';
export default function NotificationAttention({organization,timezone='UTC',onRequest,onSettings}:{organization:string;timezone?:string;onRequest?:(id:string)=>void;onSettings?:()=>void}){
 const [page,setPage]=useState(0),[view,setView]=useState<'attention'|'recent'>('attention'),[refresh,setRefresh]=useState(0),[data,setData]=useState<MessageQueue|null>(null),[error,setError]=useState('');
 useEffect(()=>{setPage(0);setView('attention')},[organization]);
 useEffect(()=>{
  let active=true,inFlight=false;const controller=new AbortController();setData(null);setError('');
  async function read(){if(inFlight)return;inFlight=true;try{
   const response=await sessionFetch('/api/notification-attention?'+new URLSearchParams({organization,page:String(page),view}),{cache:'no-store',signal:controller.signal});const value=await response.json();if(!response.ok)throw Error(value.error);
   const result=messageQueue.parse(value);if(result.organization!==organization||result.view!==view||result.page!==page)throw Error('INVALID_RESPONSE');
   if(active){setData(result);setError('');}
  }catch(e){if(active&&!controller.signal.aborted){setData(null);setError(publicError(e));}}finally{inFlight=false;}}
  void read();const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},30000);return()=>{active=false;controller.abort();clearInterval(timer);};
 },[organization,page,view,refresh]);
 const current=data?.organization===organization&&data.view===view&&data.page===page?data:null;
 return <section className="card" aria-label="Notification attention">
  <p className="eyebrow">Communications</p><h2>Message activity</h2>
  <div className="actions" role="group" aria-label="Message view">{(['attention','recent'] as const).map(choice=><button key={choice} type="button" className="secondary" aria-pressed={view===choice} onClick={()=>{setPage(0);setView(choice)}}>{choice==='attention'?'Needs attention':'Recent messages'}</button>)}</div>
  {error&&<p role="alert">{error}</p>}{!current&&!error&&<p role="status">Checking notifications…</p>}
  {current&&<>
   {!current.enabled&&<p>Email delivery is paused. {onSettings?<button className="secondary" onClick={onSettings}>Open email settings</button>:'Verify Business email in Settings.'}</p>}
   <p>{current.total} {view==='attention'?'due or unresolved messages · oldest first':'messages · newest first'}</p>
   {current.records.map(row=>{const info=notificationAttention(row,current.enabled,Date.parse(current.checkedAt));return <article className="notification-attention-row" key={row.id}>
    <h3>{notificationName(row.kind)}</h3><strong>{info.label}</strong><p>{info.action}</p>
    <p className="tiny">Created {businessTimestamp(row.created_at,timezone)} · Attempts: {row.attempts}</p>
    {row.status==='pending'&&Date.parse(row.next_attempt_at)>Date.parse(current.checkedAt)&&<p>Scheduled {businessTimestamp(row.next_attempt_at,timezone)}</p>}
    {row.kind.startsWith('invoice.')&&<a href={'/invoice?'+new URLSearchParams({organization,invoice:row.object_id})}>Open invoice</a>}
    {row.request_id&&(onRequest?<button className="secondary" onClick={()=>onRequest(row.request_id!)}>Open service request</button>:<a href={'/?'+new URLSearchParams({organization,request:row.request_id})}>Open service request</a>)}
   </article>})}
   {!current.records.length&&<p>{view==='attention'?'No messages need attention on this page.':'No recent messages on this page.'}</p>}
   {(page>0||current.hasMore)&&<div className="actions"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous messages</button><span>Page {page+1}</span><button disabled={!current.hasMore} onClick={()=>setPage(p=>p+1)}>Next messages</button></div>}
  </>}
  <p className="tiny">Updates every 30 seconds while visible. All times use {timezone}. Email service acceptance does not confirm inbox receipt.</p>
  <button className="secondary" onClick={()=>setRefresh(n=>n+1)}>Refresh messages</button>
 </section>;
}
