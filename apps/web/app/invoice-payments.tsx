"use client";
import InvoiceCredits from './invoice-credits';
import {creditTotal} from '../lib/invoice-credit-contract';

import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {verifiedInvoicePayments,type InvoicePaymentData} from '../lib/invoice-payment-context';
import {invoiceChargeCents} from '../lib/invoice-charge';
import {paymentInput} from '../lib/payment-input';
import {publicError} from '../lib/public-errors';
import PaymentCorrection from './payment-correction';
import InvoiceRecordEditor from './invoice-record-editor';
import {type InvoiceRecordState} from '../lib/invoice-record-contract';
import {useUnsavedEntry,useBlockedEntry} from './entry-safety';
import {localMinute} from '../../../packages/domain/timezone';
const money=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
type PaymentData=InvoicePaymentData;
export default function InvoicePayments({organization,invoice,totalCents,timezone,onChanged,guided=false,onBusy,refreshToken=0}:{organization:string;invoice:string;totalCents:number;timezone:string;onChanged?:()=>void;guided?:boolean;onBusy?:(busy:boolean)=>void;refreshToken?:number}){
 const [creditBusy,setCreditBusy]=useState(false),[creditDirty,setCreditDirty]=useState(false);
 const [receiptDirty,setReceiptDirty]=useState(false),[receiptEpoch,setReceiptEpoch]=useState(0),[adminBusy,setAdminBusy]=useState(false),[correctionBusy,setCorrectionBusy]=useState(false),[adminDirty,setAdminDirty]=useState(false),receiptDirtyRef=useRef(false),detailsCurrent=useRef(false);
 const [paymentOpen,setPaymentOpen]=useState(false),[detailsStale,setDetailsStale]=useState(true),[detailsLoading,setDetailsLoading]=useState(false),[detailsDenied,setDetailsDenied]=useState(false),[receiptUncertain,setReceiptUncertain]=useState(false);
 const receiptAttempt=useRef<Record<string,unknown>|null>(null),identity=organization+':'+invoice,currentIdentity=useRef(identity);currentIdentity.current=identity;
 useEffect(()=>{detailsCurrent.current=false;setData(null);setDetailsDenied(false);setDetailsStale(true);setError('');setReceiptSyncNeeded(false);setReceiptUncertain(false);setPaymentOpen(false);receiptDirtyRef.current=false;setReceiptDirty(false);receiptAttempt.current=null;receiptRetry.current=null;},[identity]);
 const [data,setData]=useState<PaymentData|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[amount,setAmount]=useState(''),[message,setMessage]=useState(''),[receiptSyncNeeded,setReceiptSyncNeeded]=useState(false);const loadGeneration=useRef(0),mounted=useRef(true),sending=useRef(false),receiptRetry=useRef<{value:string;key:string}|null>(null);
 useEffect(()=>{onBusy?.(busy||receiptUncertain||receiptSyncNeeded||adminBusy||correctionBusy||creditBusy);return()=>onBusy?.(false);},[busy,receiptUncertain,receiptSyncNeeded,adminBusy,correctionBusy,creditBusy,onBusy]);
 useUnsavedEntry('invoice-receipt:'+identity,receiptDirty);
 useBlockedEntry('invoice-receipt:'+identity,busy||receiptUncertain||receiptSyncNeeded||adminBusy||correctionBusy||creditBusy);
 const load=useCallback(async ()=>{
  const generation=++loadGeneration.current,target=identity;detailsCurrent.current=false;setDetailsStale(true);setDetailsLoading(true);
  try{const r=await sessionFetch('/api/invoice-admin?'+new URLSearchParams({organization,invoice}),{cache:'no-store',signal:AbortSignal.timeout(45000)}),raw=await r.json();if(!r.ok){if((r.status===401||r.status===403)&&mounted.current&&generation===loadGeneration.current&&currentIdentity.current===target)setDetailsDenied(true);throw Error('UNAVAILABLE');}
   const d=verifiedInvoicePayments(raw,organization,invoice,totalCents);if(!mounted.current||generation!==loadGeneration.current||currentIdentity.current!==target)throw Error('STALE_READ');setData(d);setDetailsDenied(false);detailsCurrent.current=true;setDetailsStale(false);if(!receiptDirtyRef.current)setReceiptEpoch(n=>n+1);setAmount(((totalCents-creditTotal(d.creditContext.credits)-d.payments.reduce((sum,p)=>sum+p.cents,0))/100).toFixed(2));return d.admin;
  }finally{if(mounted.current&&generation===loadGeneration.current&&currentIdentity.current===target)setDetailsLoading(false);}
 },[organization,invoice,identity,totalCents]);

 useEffect(()=>{mounted.current=true;const target=identity,pending=load(),generation=loadGeneration.current;void pending.catch(()=>{if(mounted.current&&currentIdentity.current===target&&generation===loadGeneration.current)setError('Payment details could not be loaded. Refresh this invoice.');});return()=>{mounted.current=false};},[load,identity,refreshToken]);
 async function card(action:'create'|'cancel'){if(sending.current||creditBusy||creditDirty||correctionBusy||!detailsCurrent.current)return;const cents=action==='cancel'?pending?.cents:invoiceChargeCents(amount);if(!cents){setError('Enter a positive payment amount.');return;}sending.current=true;setBusy(true);setError('');try{const r=await sessionFetch('/api/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,invoice,amountCents:cents,action})});const d=await r.json();if(!r.ok)throw Error(d.error);if(d.url){const u=new URL(d.url);if(u.origin!=='https://checkout.stripe.com')throw Error('Card checkout could not be opened.');location.assign(u.href);}else{await load();onChanged?.();setMessage('Card checkout updated. Payment status uses Stripe confirmation.');}}catch(e){setError(e instanceof Error?e.message:'Card checkout unavailable.');}finally{sending.current=false;if(mounted.current)setBusy(false);}}
 async function recordReceipt(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(sending.current||receiptSyncNeeded||adminBusy||correctionBusy||creditBusy||creditDirty||adminDirty||!detailsCurrent.current)return;
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
  await commitReceipt({...body,key:receiptRetry.current.key},form);
 }
 async function commitReceipt(body:Record<string,unknown>,form?:HTMLFormElement){
  if(sending.current)return;
  const target=identity;receiptAttempt.current=body;sending.current=true;setBusy(true);setError('');setMessage('');
  let definitive=false;
  try{
   const r=await sessionFetch('/api/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(!r.ok&&r.status>=400&&r.status<500)definitive=true;
   const d=await r.json();if(!r.ok)throw Error(d.error||'The payment could not be recorded.');
   if(d.ok!==true||typeof d.result?.id!=='string')throw Error('The saved payment response could not be verified.');
   if(currentIdentity.current!==target)return;
   receiptRetry.current=null;receiptAttempt.current=null;receiptDirtyRef.current=false;setReceiptDirty(false);form?.reset();setPaymentOpen(false);setReceiptSyncNeeded(true);setReceiptUncertain(false);
   setMessage('Received payment saved to this invoice. The remaining balance has been recalculated.');
   try{await load();setReceiptSyncNeeded(false);onChanged?.();}
   catch{setError('The payment was recorded. Refresh payment details to see the updated balance.');}
  }catch(err){
   if(currentIdentity.current!==target)return;
   if(definitive){setReceiptUncertain(false);setReceiptSyncNeeded(false);setError(publicError(err));}
   else{setReceiptUncertain(true);setReceiptSyncNeeded(true);setError('The payment result is not confirmed. Check the saved result below before entering another payment.');}
  }finally{sending.current=false;if(mounted.current&&currentIdentity.current===target)setBusy(false);}
 }
 const paid=data?.payments.reduce((s,p)=>s+p.cents,0)||0,credited=creditTotal(data?.creditContext.credits),balance=totalCents-paid-credited,pending=data?.orders.find(o=>['prepared','open'].includes(o.status));
 return <section className="card invoice-payment-panel"><h2>Payment</h2>{error&&<p role="alert">{error}</p>}<button type="button" className="secondary" disabled={busy||adminBusy||correctionBusy||creditBusy||detailsLoading} onClick={()=>{if(sending.current||adminBusy)return;setError('');void load().then(()=>{if(!receiptUncertain)setReceiptSyncNeeded(false);}).catch(()=>setError('Payment details could not be loaded. Try again.'));}}>Refresh payment details</button>{message&&<p role="status">{message}</p>}{detailsDenied&&<p role="status">Payment history is hidden until your access is restored. Unsaved entries are kept in this screen.</p>}{receiptUncertain&&<button type="button" disabled={busy} onClick={()=>{if(receiptAttempt.current)void commitReceipt(receiptAttempt.current);}}>{busy?'Checking saved result…':'Check saved payment result'}</button>}{data&&<div hidden={detailsDenied}>
 {detailsStale&&<p role="status">Payment details are not current. Refresh before recording funds or changing this invoice. Any unsaved entries are kept.</p>}<dl className="payment-balance-summary" aria-label="Invoice balance"><div><dt>Invoice total</dt><dd>{money(totalCents)}</dd></div><div><dt>Net credits</dt><dd>{money(credited)}</dd></div><div><dt>Received</dt><dd>{money(paid)}</dd></div><div><dt>Remaining balance</dt><dd>{money(balance)}</dd></div></dl><p>Recorded due date: {data.admin.dueDate||'Not recorded — see invoice terms'}. {data.admin.archived?'Archived. The document, balance and payment history are retained.':''}</p>
 {pending&&<p className="note">Card checkout pending for {money(pending.cents)}. Resolve or cancel it before recording cash or Zelle. A return from checkout alone does not mark the invoice paid.</p>}
 {data.cardConfigured&&balance>0&&<div><label>Card payment amount ($)<input value={pending?(pending.cents/100).toFixed(2):amount} disabled={busy||detailsStale||Boolean(pending)} inputMode="decimal" onChange={e=>setAmount(e.target.value)}/></label><div className="actions"><button disabled={busy||detailsStale} onClick={()=>void card('create')}>{pending?'Resume card checkout':'Pay by card securely with Stripe'}</button>{pending&&<button disabled={busy} className="secondary" onClick={()=>void card('cancel')}>Cancel pending checkout</button>}</div><p>No customer processing surcharge is added. The invoice already includes any reviewed sales tax. Partial card payments apply only the chosen amount.</p></div>}
 {!detailsStale&&balance===0&&<p className="note" role="status"><strong>No payment remains due.</strong> Recorded receipts and any net credits settle the issued total.</p>}{!guided&&balance>0&&!pending&&<p className="note">{data.canManage?'Record only funds received. Each cash or Zelle entry reduces the remaining balance.':'Cash and Zelle payments are recorded after receipt. For Zelle, confirm the payment contact with your service provider before sending money.'}</p>}
 {data.canManage&&(balance>0||receiptDirty)&&(!pending||receiptDirty)&&<details open={guided||paymentOpen} onToggle={e=>setPaymentOpen(e.currentTarget.open)}><summary>Record money received — cash or Zelle</summary><p>{guided?'Verify cash or Zelle receipt before saving. Record only the amount actually received; a screenshot or payment request is not confirmation.':'Cash and Zelle are both manually recorded after you verify receipt. Zelle is not automatically verified or imported. For partial payments, record only the actual amount received. Do not rely on a screenshot or an unconfirmed payment request.'}</p><form key={receiptEpoch} onChangeCapture={()=>{receiptDirtyRef.current=true;setReceiptDirty(true);}} onSubmit={recordReceipt}><fieldset disabled={busy||detailsStale||receiptSyncNeeded||adminBusy||correctionBusy||creditBusy||creditDirty||adminDirty||Boolean(pending)||balance===0}><label>Amount received (USD)<input name="amount" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" defaultValue={(balance/100).toFixed(2)} required/></label><label>Payment method<select name="method"><option value="cash">Cash</option><option value="zelle">Zelle</option></select></label><label>Received at ({timezone})<input name="receivedAt" type="datetime-local" defaultValue={localMinute(Date.now(),timezone)} required/></label><label>Cash note or Zelle confirmation reference (no bank or account numbers)<input name="reference" maxLength={300} placeholder="Cash received in person, or Zelle receipt reference" required/></label><label className="check"><input type="checkbox" required/>I confirmed the money was received.</label><button>Record received payment</button></fieldset></form></details>}
 {receiptDirty&&<><p role="status">Your unsaved payment entries are kept. Review the current balance before recording funds.</p><button type="button" className="secondary" disabled={busy||receiptSyncNeeded||adminBusy} onClick={()=>{if(sending.current||receiptSyncNeeded||adminBusy)return;if(!window.confirm('Discard these unsaved payment entries? No saved payment will be changed.'))return;receiptDirtyRef.current=false;setReceiptDirty(false);setReceiptEpoch(n=>n+1);receiptRetry.current=null;receiptAttempt.current=null;}}>Discard unsaved payment entries</button></>}
 {adminDirty&&<p role="status">Save or reload the invoice-record edit before entering a payment.</p>}{receiptDirty&&<p>Save or discard the payment entries before changing the due date or archive choice.</p>}
 <details className="payment-history" open={guided?undefined:true}><summary>Payment history & invoice adjustments</summary><h3>Confirmed payment history</h3>{!data.payments.length&&<p>No confirmed payments.</p>}{data.payments.map(p=><p key={p.id}>{p.method==='cash_correction'?'Cash entry correction':p.method==='zelle_correction'?'Zelle entry correction':p.method==='stripe_refund'?'Card refund':p.method==='stripe'?'Stripe card':p.method==='zelle'?'Zelle':'Cash'} · {money(p.cents)} · {new Date(p.receivedAt).toLocaleString('en-US',{timeZone:timezone})}{data.canManage&&<><br/>Reference: {p.reference}</>}</p>)}
 {data.canManage&&<>{data.cardTransactions.length>0&&<details><summary>Card settlement details</summary><p>Actual processor fees and net Stripe balance movements, not estimated fees or proof of a bank payout.</p>{data.cardTransactions.map(t=><p key={t.id}>{t.kind==='alert'?`Payment issue needs review in Stripe: ${t.details.eventType} (${t.details.status})`:`${t.kind}: gross ${money(t.amountCents)}, processor fees ${money(t.feeCents)}, net Stripe balance ${money(t.netCents)}`}<br/>{t.id}</p>)}</details>}
 <PaymentCorrection key={'correction:'+identity} organization={organization} invoice={invoice} payments={data.payments} disabled={busy||detailsStale||receiptSyncNeeded||receiptUncertain||receiptDirty||adminBusy||adminDirty||creditBusy||creditDirty||Boolean(pending)} onBusy={setCorrectionBusy} onChanged={async()=>{await load();onChanged?.();}}/>
 <InvoiceCredits key={'credit:'+identity} organization={organization} context={data.creditContext} timezone={timezone} disabled={busy||detailsStale||receiptSyncNeeded||receiptUncertain||receiptDirty||adminBusy||adminDirty||correctionBusy||Boolean(pending)} onBusy={setCreditBusy} onDirty={setCreditDirty} onChanged={async()=>{await load();onChanged?.();}}/>
 <InvoiceRecordEditor key={identity} organization={organization} invoice={invoice} saved={data.admin} disabled={busy||detailsStale||receiptSyncNeeded||receiptUncertain||receiptDirty||correctionBusy||creditBusy||creditDirty} reload={load} onBusy={setAdminBusy} onDraft={setAdminDirty} onSaved={(admin:InvoiceRecordState)=>{setData(current=>current?{...current,admin}:current);onChanged?.();}}/></>}
 </details></div>}{!data&&!error&&<p role="status">Loading payment history…</p>}</section>;
}
