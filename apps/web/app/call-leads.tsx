'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {leadSourceOptions} from '../../../packages/contracts/index';
import {daysWaiting,type CallLead,type CallLeadList} from '../lib/call-leads-contract';

type Payload=({installed:true}&CallLeadList)|{installed:false};
const statusLabel:Record<CallLead['status'],string>={open:'Call back',called:'Called',booked:'Booked',closed:'Closed'};
const day=(iso:string)=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
const plusDays=(n:number)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toLocaleDateString('en-CA');};

// Call list: website call-back requests and phone calls logged by hand, so no caller is forgotten.
export default function CallLeads({organization,revision}:{organization:string;revision:number}){
 const [data,setData]=useState<Payload|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0),[logging,setLogging]=useState(false);
 const [form,setForm]=useState({name:'',phone:'',need:'',leadSource:'',referredBy:'',followUpOn:'',note:''});
 useEffect(()=>{let active=true;const controller=new AbortController();
  void sessionFetch('/api/call-leads?'+new URLSearchParams({organization}),{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active){setData(d);setError('');}}).catch(e=>{if(active&&!controller.signal.aborted)setError(publicError(e));});
  return()=>{active=false;controller.abort();};
 },[organization,revision,reload]);
 async function save(body:Record<string,unknown>){
  setBusy(true);setError('');
  try{const r=await sessionFetch('/api/call-leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,...body})});const d=await r.json();if(!r.ok)throw Error(d.error);setReload(n=>n+1);return true;}
  catch(e){setError(publicError(e));return false;}finally{setBusy(false);}
 }
 if(data&&!data.installed)return <section className="card call-leads" aria-label="Call list"><p className="eyebrow">Call list</p><p>The call list turns on after the database update for call-backs is applied.</p></section>;
 if(!data)return <section className="card call-leads" aria-label="Call list" aria-busy={!error}>{error?<p role="alert">{error}</p>:<p>Loading your call list…</p>}</section>;
 const open=data.items.filter(l=>l.status==='open'||l.status==='called'),done=data.items.filter(l=>l.status==='booked'||l.status==='closed');
 return <section className="card call-leads" aria-label="Call list">
  <p className="eyebrow">Call list</p>
  <h2>{data.counts.open?`${data.counts.open} to call back`:'Nobody waiting on a call'}</h2>
  <p className="scorecard-note">{data.counts.due?`${data.counts.due} follow-up${data.counts.due===1?'':'s'} due today or earlier. `:''}{data.counts.booked30} booked from calls in the last 30 days.</p>
  {error&&<p role="alert">{error}</p>}
  {open.length?<ul className="call-lead-list">{open.map(l=><li key={l.id} className={l.status==='open'&&daysWaiting(l.createdAt)>=1?'is-waiting':''}>
   <div><strong>{l.name}</strong> <span className="call-lead-meta">{l.origin==='website'?'Website call-back':'Phone call'} · {statusLabel[l.status]}{l.status==='open'?` · waiting ${daysWaiting(l.createdAt)===0?'since today':daysWaiting(l.createdAt)+' day'+(daysWaiting(l.createdAt)===1?'':'s')}`:''}</span></div>
   <p>{l.need}</p>
   {(l.leadSource||l.referredBy)&&<p className="call-lead-meta">{l.leadSource||''}{l.referredBy?` · referred by ${l.referredBy}`:''}</p>}
   {l.followUpOn&&<p className="call-lead-meta">Follow up {day(l.followUpOn)}</p>}
   {l.note&&<p className="call-lead-meta">Note: {l.note}</p>}
   <div className="call-lead-actions"><a className="button secondary" href={'tel:'+l.phone.replace(/[^0-9+]/g,'')}>Call {l.phone}</a>
    {l.status==='open'&&<button type="button" disabled={busy} onClick={()=>void save({id:l.id,status:'called',followUpOn:l.followUpOn??plusDays(2)})}>Mark called</button>}
    <button type="button" disabled={busy} onClick={()=>void save({id:l.id,status:'booked'})}>Booked</button>
    <button type="button" disabled={busy} onClick={()=>void save({id:l.id,followUpOn:plusDays(7)})}>Follow up in a week</button>
    <button type="button" disabled={busy} onClick={()=>void save({id:l.id,status:'closed'})}>Close</button></div>
  </li>)}</ul>:<p>No open calls.</p>}
  <details open={logging} onToggle={e=>setLogging((e.target as HTMLDetailsElement).open)}><summary>Log a phone call</summary>
   <form className="call-lead-form" onSubmit={async e=>{e.preventDefault();const ok=await save({id:null,name:form.name,phone:form.phone,need:form.need,leadSource:form.leadSource,referredBy:form.referredBy,followUpOn:form.followUpOn||null,note:form.note,status:'called'});if(ok){setForm({name:'',phone:'',need:'',leadSource:'',referredBy:'',followUpOn:'',note:''});setLogging(false);}}}>
    <label>Name<input required minLength={2} maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label>Phone<input required type="tel" minLength={7} maxLength={35} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
    <label>What they need<input required minLength={3} maxLength={500} value={form.need} onChange={e=>setForm({...form,need:e.target.value})}/></label>
    <label>How they heard about us<select value={form.leadSource} onChange={e=>setForm({...form,leadSource:e.target.value})}><option value="">Not asked</option>{leadSourceOptions.map(o=><option key={o}>{o}</option>)}</select></label>
    {['Friend, family or neighbor','Realtor or property manager'].includes(form.leadSource)&&<label>Who sent them<input maxLength={120} value={form.referredBy} onChange={e=>setForm({...form,referredBy:e.target.value})}/></label>}
    <label>Follow up on<input type="date" value={form.followUpOn} onChange={e=>setForm({...form,followUpOn:e.target.value})}/></label>
    <label>Note<input maxLength={1000} value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label>
    <button className="button" type="submit" disabled={busy}>Save call</button>
   </form>
  </details>
  {done.length>0&&<details><summary>Booked and closed (last 30 days)</summary><ul className="call-lead-list">{done.map(l=><li key={l.id}><strong>{l.name}</strong> <span className="call-lead-meta">{statusLabel[l.status]} · {l.need}</span> <button type="button" disabled={busy} onClick={()=>void save({id:l.id,status:'open'})}>Reopen</button></li>)}</ul></details>}
 </section>;
}
