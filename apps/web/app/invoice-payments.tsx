"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {invoiceChargeCents} from '../lib/invoice-charge';
import {paymentInput} from '../lib/payment-input';
import {publicError} from '../lib/public-errors';
const money=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
type PaymentData={admin:{revision:number;dueDate:string|null;archived:boolean};orders:{id:string;cents:number;status:string;url:string|null}[];payments:{id:string;cents:number;method:string;receivedAt:string;reference:string}[];canManage:boolean;cardConfigured:boolean;cardTransactions:{id:string;kind:string;amountCents:number;feeCents:number;netCents:number;details:{status?:string;eventType?:string}}[]};
export default function InvoicePayments({organization,invoice,totalCents,timezone,onChanged}:{organization:string;invoice:string;totalCents:number;timezone:string;onChanged?:()=>void}){
 const [data,setData]=useState<PaymentData|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[amount,setAmount]=useState(''),[message,setMessage]=useState(''),[receiptSyncNeeded,setReceiptSyncNeeded]=useState(false);const loadGeneration=useRef(0),retry=useRef<{value:string;key:string}|null>(null),mounted=useRef(true),sending=useRef(false),receiptRetry=useRef<{value:string;key:string}|null>(null);
 async function load(){const generation=++loadGeneration.current;const r=await sessionFetch('/api/invoice-admin?'+new URLSearchParams({organization,invoice}));const d=await r.json();if(!r.ok)throw Error(d.error);if(mounted.current&&generation===loadGeneration.current){setData(d);setAmount((Math.max(0,totalCents-d.payments.reduce((s:number,p:{cents:number})=>s+p.cents,0))/100).toFixed(2));}}
 useEffect(()=>{mounted.current=true;void load().catch(()=>setError('Payment details could not be loaded. Refresh this invoice.'));return()=>{mounted.current=false};},[organization,invoice,totalCents]);
 async function card(action:'create'|'cancel'){if(sending.current)return;const cents=action==='cancel'?pending?.cents:invoiceChargeCents(amount);if(!cents){setError('Enter a positive payment amount.');return;}sending.current=true;setBusy(true);setError('');try{const r=await sessionFetch('/api/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,invoice,amountCents:cents,action})});const d=await r.json();if(!r.ok)throw Error(d.error);if(d.url){const u=new URL(d.url);if(u.origin!=='https://checkout.stripe.com')throw Error('Card checkout could not be opened.');location.assign(u.href);}else{await load();onChanged?.();setMessage('Card checkout updated. Payment status uses Stripe confirmation.');}}catch(e){setError(e instanceof Error?e.message:'Card checkout unavailable.');}finally{sending.current=false;if(mounted.current)setBusy(false);}}
 async function recordReceipt(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(sending.current||receiptSyncNeeded)return;
  const form=e.currentTarget;
  setError('');setMessage('');
  let body;
  try{
   const value=paymentInput(new FormData(form),timezone);
   if(value.cents>balance)throw Error('The received amount exceeds the remaining invoice balance.');
   body={organizationId:organization,command:'RecordPayment',id:invoice,...value,confirmed:true};
  }catch(err){setError(publicError(err));return;}
  const value=JSON.stringify(body);
  if(receiptRetry.current?.value!==value)receiptRetry.current={value,key:crypto.randomUUID()};
  sending.current=true;setBusy(true);
  try{
   const r=await sessionFetch('/api/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,key:receiptRetry.current.key})});
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'The payment could not be recorded.');
   receiptRetry.current=null;form.reset();setReceiptSyncNeeded(true);
   setMessage('Payment received and recorded.');
   try{await load();setReceiptSyncNeeded(false);onChanged?.();}
   catch{setError('The payment was recorded. Refresh this invoice to see the updated balance.');}
  }catch(err){setError(publicError(err));}
  finally{sending.current=false;if(mounted.current)setBusy(false);}
 }
 const paid=data?.payments.reduce((s,p)=>s+p.cents,0)||0,balance=Math.max(0,totalCents-paid),pending=data?.orders.find(o=>['prepared','open'].includes(o.status));
 return <section className="card"><h2>Payments and invoice records</h2>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{data&&<>
 <p>Invoice total {money(totalCents)} · confirmed payments {money(paid)} · remaining {money(balance)}</p><p>Recorded due date: {data.admin.dueDate||'Not recorded — see invoice terms'}. {data.admin.archived?'Archived. The document, balance and payment history are retained.':''}</p>
 {pending&&<p className="note">Card checkout pending for {money(pending.cents)}. Resolve or cancel it before recording cash or Zelle. A return from checkout alone does not mark the invoice paid.</p>}
 {data.cardConfigured&&balance>0&&<div><label>Card payment amount ($)<input value={pending?(pending.cents/100).toFixed(2):amount} disabled={busy||Boolean(pending)} inputMode="decimal" onChange={e=>setAmount(e.target.value)}/></label><div className="actions"><button disabled={busy} onClick={()=>void card('create')}>{pending?'Resume card checkout':'Pay by card securely with Stripe'}</button>{pending&&<button disabled={busy} className="secondary" onClick={()=>void card('cancel')}>Cancel pending checkout</button>}</div><p>No customer processing surcharge is added. The invoice already includes any reviewed sales tax. Partial card payments apply only the chosen amount.</p></div>}
 {balance>0&&!pending&&<p className="note">{data.canManage?'Record only funds received. Each cash or Zelle entry reduces the remaining balance.':'Cash and Zelle payments are recorded after receipt. For Zelle, confirm the payment contact with your service provider before sending money.'}</p>}
 {data.canManage&&balance>0&&!pending&&<details><summary>Record cash or Zelle received</summary><p>For a split payment, record each received amount separately. A Zelle request or screenshot is not confirmation that funds arrived.</p><form key={balance} onSubmit={recordReceipt}><fieldset disabled={busy||receiptSyncNeeded}><label>Amount received (USD)<input name="amount" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" defaultValue={(balance/100).toFixed(2)} required/></label><label>Payment method<select name="method"><option value="cash">Cash</option><option value="zelle">Zelle</option></select></label><label>Received at ({timezone})<input name="receivedAt" type="datetime-local" required/></label><label>Receipt reference (no account numbers)<input name="reference" maxLength={300} required/></label><label className="check"><input type="checkbox" required/>I confirmed the money was received.</label><button>Record received payment</button></fieldset></form></details>}
 <h3>Confirmed payment history</h3>{!data.payments.length&&<p>No confirmed payments.</p>}{data.payments.map(p=><p key={p.id}>{p.method==='stripe_refund'?'Card refund':p.method==='stripe'?'Stripe card':p.method==='zelle'?'Zelle':'Cash'} · {money(p.cents)} · {new Date(p.receivedAt).toLocaleString()}{data.canManage&&<><br/>Reference: {p.reference}</>}</p>)}
 {data.canManage&&<>{data.cardTransactions.length>0&&<details><summary>Card settlement details</summary><p>Actual processor fees and net Stripe balance movements, not estimated fees or proof of a bank payout.</p>{data.cardTransactions.map(t=><p key={t.id}>{t.kind==='alert'?`Payment issue needs review in Stripe: ${t.details.eventType} (${t.details.status})`:`${t.kind}: gross ${money(t.amountCents)}, processor fees ${money(t.feeCents)}, net Stripe balance ${money(t.netCents)}`}<br/>{t.id}</p>)}</details>}
 <details><summary>Due date and archive</summary><p>Archive preserves the invoice, taxes and outstanding balance. Record only a customer-agreed payment due date; updating this record does not email revised terms.</p><form key={data.admin.revision} onSubmit={async e=>{e.preventDefault();if(sending.current)return;sending.current=true;setBusy(true);setError('');const f=new FormData(e.currentTarget),body={organization,invoice,revision:data.admin.revision,dueDate:String(f.get('dueDate')||'')||null,archived:f.get('archived')==='on',reason:String(f.get('reason')||'')};try{const value=JSON.stringify(body);if(retry.current?.value!==value)retry.current={value,key:crypto.randomUUID()};const r=await sessionFetch('/api/invoice-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,key:retry.current.key})});const d=await r.json();if(!r.ok)throw Error(d.error);retry.current=null;await load();onChanged?.();setMessage('Invoice record updated. Its issued charges remain fixed.');}catch(e){setError(e instanceof Error?e.message:'The record was not updated.');}finally{sending.current=false;if(mounted.current)setBusy(false);}}}><fieldset disabled={busy}><label>Agreed payment due date<input name="dueDate" type="date" defaultValue={data.admin.dueDate||''}/></label><label><input name="archived" type="checkbox" defaultChecked={data.admin.archived}/>Archive this invoice</label><label>Reason / customer agreement evidence<textarea required name="reason" minLength={2} maxLength={500}/></label><button>Save invoice record</button></fieldset></form></details></>}
 </>}{!data&&!error&&<p role="status">Loading payment history…</p>}</section>;
}
