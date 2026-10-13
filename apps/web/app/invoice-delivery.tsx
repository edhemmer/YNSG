"use client";
import { publicError } from "../lib/public-errors";
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
type Delivery={enabled:boolean;recipient:string|null;status:string;paidStatus:string};
const labels:Record<string,string>={not_queued:'Not queued',not_requested:'Not sent yet',pending:'Waiting to send',leased:'Preparing email',sending:'Sending — waiting for the email service',accepted:'Accepted by the email service. Inbox receipt is not confirmed.',failed:'Sending failed. Automatic retries may follow.',needs_reconciliation:'Delivery result is uncertain. Review before attempting another send.',dead_letter:'Delivery needs owner attention.',suppressed:'Delivery stopped.'};
export default function InvoiceDelivery({organization,invoice}:{organization:string;invoice:string}){
 const [data,setData]=useState<Delivery|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reviewed,setReviewed]=useState(false);
 const retry=useRef<string|null>(null);
 const identity=organization+':'+invoice;
 const currentIdentity=useRef(identity);currentIdentity.current=identity;
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{setData(null);setError('');setReviewed(false);setBusy(false);retry.current=null;},[organization,invoice]);
 useEffect(()=>{
  if(busy)return;
  let active=true,inFlight=false;const controller=new AbortController();
  async function read(){
   if(inFlight)return;inFlight=true;
   try{
    const r=await sessionFetch('/api/invoice-delivery?'+new URLSearchParams({organization,invoice}),{cache:'no-store',signal:controller.signal});
    const d=await r.json();if(!r.ok)throw Error(d.error);
    if(active){setData(d);setError('');}
   }catch(e){if(active&&!controller.signal.aborted){setData(null);setError(publicError(e));}}
   finally{inFlight=false;}
  }
  void read();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},60000);
  return()=>{active=false;controller.abort();clearInterval(timer);};
 },[organization,invoice,busy,refresh]);
 async function send(){
  if(busy||!reviewed||!data?.enabled||!data.recipient||data.status!=='not_requested')return;
  const target=identity;setBusy(true);setError('');
  try{
   retry.current??=crypto.randomUUID();
   const r=await sessionFetch('/api/invoice-delivery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,invoice,reviewed:true,key:retry.current})});
   const d=await r.json();if(!r.ok)throw Error(d.error);
   if(currentIdentity.current!==target)return;
   setData(current=>current?{...current,status:d.delivery.status}:current);setReviewed(false);retry.current=null;
  }catch(e){if(currentIdentity.current===target)setError(publicError(e));}
  finally{if(currentIdentity.current===target)setBusy(false);}
 }
 return <section aria-label="Invoice email delivery"><h3>Email the invoice</h3>{!data&&!error&&<p role="status">Checking delivery…</p>}{data&&<><p>Delivery: {labels[data.status]||'Review delivery status'}</p>{data.paidStatus!=='not_queued'&&<p>Payment thank-you: {labels[data.paidStatus]||'Review follow-up status'}</p>}<p>To: {data.recipient||'Email address missing on this invoice'}</p>{!data.enabled&&<p>Business email needs attention. Review Business email in Settings before sending. You can still download the invoice PDF.</p>}{data.status==='not_requested'&&<><p>Review the invoice and recipient. Sending includes a PDF copy.</p><label className="check"><input type="checkbox" checked={reviewed} disabled={busy||!data.enabled||!data.recipient} onChange={e=>setReviewed(e.target.checked)}/>The issued invoice and recipient are correct.</label><button disabled={busy||!reviewed||!data.enabled||!data.recipient} onClick={()=>void send()}>{busy?'Saving email request…':'Send invoice & PDF'}</button></>}</>}<p className="tiny">Status updates while this screen is open. Sending continues after you close it.</p><button type="button" className="secondary" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Refresh email status</button>{error&&<p role="alert">{error}</p>}</section>;
}
