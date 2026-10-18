"use client";
import { publicError } from "../lib/public-errors";
import {useEffect,useRef,useState} from 'react';
import {useBlockedEntry,useUnsavedEntry} from './entry-safety';
import {z} from 'zod';
import {sessionFetch} from '../lib/session-fetch';
const statuses=['pending','leased','sending','accepted','failed','needs_reconciliation','dead_letter','suppressed'] as const;
const deliveryState=z.object({enabled:z.boolean(),recipient:z.email().nullable(),status:z.enum(['not_requested',...statuses]),paidStatus:z.enum(['not_queued',...statuses])}).strict();
type Delivery={enabled:boolean;recipient:string|null;status:string;paidStatus:string};
const labels:Record<string,string>={not_queued:'Not queued',not_requested:'Not sent yet',pending:'Waiting to send',leased:'Preparing email',sending:'Sending — waiting for the email service',accepted:'Accepted by the email service. Inbox receipt is not confirmed.',failed:'Sending failed. Automatic retries may follow.',needs_reconciliation:'Delivery result is uncertain. Review before attempting another send.',dead_letter:'Delivery needs owner attention.',suppressed:'Delivery stopped.'};
export default function InvoiceDelivery({organization,invoice,onBusy}:{organization:string;invoice:string;onBusy?:(busy:boolean)=>void}){
 const [data,setData]=useState<Delivery|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reviewed,setReviewed]=useState(false),[uncertain,setUncertain]=useState(false);
 useEffect(()=>{onBusy?.(busy);return()=>onBusy?.(false);},[busy,onBusy]);
 const retry=useRef<string|null>(null),attempt=useRef<string|null>(null),sending=useRef(false),generation=useRef(0);
 useBlockedEntry('invoice-delivery:'+organization+':'+invoice,busy||uncertain);
 useUnsavedEntry('invoice-delivery-review:'+organization+':'+invoice,reviewed);
 const identity=organization+':'+invoice;
 const currentIdentity=useRef(identity);currentIdentity.current=identity;
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{generation.current++;setData(null);setError('');setReviewed(false);setBusy(false);retry.current=null;attempt.current=null;setUncertain(false);},[organization,invoice]);
 useEffect(()=>{
  if(busy)return;
  let active=true,inFlight=false;const controller=new AbortController();
  async function read(){
   if(inFlight)return;inFlight=true;
   try{
    const r=await sessionFetch('/api/invoice-delivery?'+new URLSearchParams({organization,invoice}),{cache:'no-store',signal:controller.signal});
    const d=await r.json();if(!r.ok)throw Error(d.error);
    const parsed=deliveryState.parse(d);
    if(active){setData(parsed);if(parsed.status!=='not_requested'){setUncertain(false);attempt.current=null;retry.current=null;}setError('');}
   }catch(e){if(active&&!controller.signal.aborted){setData(null);setError(publicError(e));}}
   finally{inFlight=false;}
  }
  void read();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},60000);
  return()=>{active=false;controller.abort();clearInterval(timer);};
 },[organization,invoice,busy,refresh]);
 async function send(){
  if(sending.current||busy||!data?.enabled||!data.recipient||data.status!=='not_requested'||(!reviewed&&!uncertain))return;
  const target=identity,attemptGeneration=generation.current;sending.current=true;setBusy(true);setError('');
  try{
   if(!attempt.current){retry.current??=crypto.randomUUID();attempt.current=JSON.stringify({organization,invoice,reviewed:true,key:retry.current});}
   const r=await sessionFetch('/api/invoice-delivery',{method:'POST',headers:{'Content-Type':'application/json'},body:attempt.current});
   const d=await r.json().catch(()=>null);
   if(currentIdentity.current!==target||generation.current!==attemptGeneration)return;
   if(!r.ok){
    if(r.status>=400&&r.status<500&&!uncertain){attempt.current=null;retry.current=null;setError(d?.error||'The request was rejected.');return;}
    throw Error('UNCONFIRMED');
   }
   if(typeof d?.delivery?.id!=='string'||!z.uuid().safeParse(d.delivery.id).success||!z.enum(statuses).safeParse(d.delivery.status).success)throw Error('UNCONFIRMED');
   setData(current=>current?{...current,status:d.delivery.status}:current);setReviewed(false);setUncertain(false);retry.current=null;attempt.current=null;
  }catch{
   if(currentIdentity.current===target&&generation.current===attemptGeneration){setUncertain(true);setError('We could not confirm whether your email request was queued. Check the same saved request before sending again.');}
  }finally{sending.current=false;if(currentIdentity.current===target&&generation.current===attemptGeneration)setBusy(false);}
 }
 return <section aria-label="Invoice email delivery"><h3>Email the invoice</h3>{!data&&!error&&<p role="status">Checking delivery…</p>}{data&&<><p>Delivery: {labels[data.status]||'Review delivery status'}</p>{data.paidStatus!=='not_queued'&&<p>Payment thank-you: {labels[data.paidStatus]||'Review follow-up status'}</p>}<p>To: {data.recipient||'Email address missing on this invoice'}</p>{!data.enabled&&<p>Business email needs attention. Review Business email in Settings before sending. You can still download the invoice PDF.</p>}{data.status==='not_requested'&&!uncertain&&<><p>Review the invoice and recipient. Sending includes a PDF copy.</p><label className="check"><input type="checkbox" checked={reviewed} disabled={busy||!data.enabled||!data.recipient} onChange={e=>setReviewed(e.target.checked)}/>The issued invoice and recipient are correct.</label><button disabled={busy||!reviewed||!data.enabled||!data.recipient} onClick={()=>void send()}>{busy?'Saving email request…':'Send invoice & PDF'}</button></>}{uncertain&&data.status==='not_requested'&&<button type="button" disabled={busy} onClick={()=>void send()}>{busy?'Checking saved request…':'Check saved email request'}</button>}</>}<p className="tiny">Status updates while this screen is open. Sending continues after you close it.</p><button type="button" className="secondary" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Refresh email status</button>{error&&<p role="alert">{error}</p>}</section>;
}
