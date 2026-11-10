"use client";
// Owner-only: change what you will charge without touching the customer's approved quote.
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {invoiceChargeCents} from '../lib/invoice-charge';
const money=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function WorkingPrice({organization,job,approvedCents,onChanged}:{organization:string;job:string;approvedCents:number;onChanged?:()=>void}){
 const [price,setPrice]=useState<{cents:number;note:string}|null>(null),[editing,setEditing]=useState(false),[amount,setAmount]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{
  const c=new AbortController();
  sessionFetch('/api/job-working-price?'+new URLSearchParams({organization,job}),{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json();if(r.ok)setPrice(d.price);}).catch(()=>{});
  return()=>c.abort();
 },[organization,job]);
 const current=price?price.cents:approvedCents;
 async function save(){
  const cents=invoiceChargeCents(amount.trim());if(cents===null||busy){setMessage('Use dollars and cents, like 85 or 85.50.');return;}
  setBusy(true);setMessage('');
  try{
   const r=await sessionFetch('/api/job-working-price',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,job,cents,note:note.trim()})});
   const d=await r.json().catch(()=>null);
   if(!r.ok||!d?.price){setMessage(typeof d?.error==='string'?d.error:'Not saved. Try again.');return;}
   setPrice(d.price);setEditing(false);onChanged?.();
  }catch{setMessage('Not saved. Try again.');}finally{setBusy(false);}
 }
 return <div className="working-price" aria-label="Your price for this job">
  {!editing?<p>You will charge <strong>{money(current)}</strong>{price&&price.cents!==approvedCents&&<span className="tiny"> · customer approved {money(approvedCents)} (only you see this)</span>} <button type="button" className="link" onClick={()=>{setAmount((current/100).toFixed(2));setNote(price?.note||'');setEditing(true);}}>Change</button></p>
  :<form onSubmit={e=>{e.preventDefault();void save();}}>
   <label>Your price ($)<input name="working-price" inputMode="decimal" autoComplete="off" value={amount} onFocus={e=>e.currentTarget.select()} onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g,''))}/></label>
   <label>Private note (optional)<input maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label>
   <p className="tiny">The customer's approved quote ({money(approvedCents)}) stays on record. This only sets your price and fills in the invoice.</p>
   <button type="submit" disabled={busy}>{busy?'Saving…':'Save price'}</button> <button type="button" className="secondary" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button>
   {message&&<p role="alert">{message}</p>}
  </form>}
 </div>;
}
