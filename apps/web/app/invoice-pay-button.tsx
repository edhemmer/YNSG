"use client";
// Customer-facing Pay button. Card checkout runs through the connected payment provider when one is
// live; until then the invoice's own payment terms (check, cash, Zelle) stay the way to pay.
import {useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
const money=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function InvoicePayButton({organization,invoice,balanceCents}:{organization:string;invoice:string;balanceCents:number}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(balanceCents<=0)return null;
 async function pay(){
  if(busy)return;setBusy(true);setMessage('');
  try{
   const response=await sessionFetch('/api/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,invoice,amountCents:balanceCents,action:'create'})});
   const data=await response.json().catch(()=>null);
   if(response.ok&&data?.status==='open'&&typeof data.url==='string'&&new URL(data.url).origin==='https://checkout.stripe.com'){window.location.assign(data.url);return;}
   if(response.status===503)setMessage('Card payment is not turned on yet. Please pay using the payment terms on this invoice (check, cash or Zelle).');
   else if(response.status===409)setMessage('A card payment for this invoice is already in progress. Finish it or wait a few minutes, then try again.');
   else setMessage(typeof data?.error==='string'?data.error:'Card payment could not start. Please use the payment terms on this invoice.');
  }catch{setMessage('Card payment could not start. Please use the payment terms on this invoice.');}
  finally{setBusy(false);}
 }
 return <section className="invoice-pay" aria-label="Pay this invoice"><button type="button" className="invoice-pay-button" disabled={busy} onClick={()=>void pay()}>{busy?'Opening secure payment…':'Pay '+money(balanceCents)+' now'}</button>{message&&<p role="status">{message}</p>}</section>;
}
