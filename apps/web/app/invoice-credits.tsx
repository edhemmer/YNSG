'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {creditAmount,creditTotal,invoiceCreditCommand,verifyCreditSaved,invoiceCreditContext} from '../lib/invoice-credit-contract';
import type {z} from 'zod';
import {useBlockedEntry,useUnsavedEntry} from './entry-safety';
const usd=(n:number)=>(n/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function InvoiceCredits({organization,context,disabled,timezone,onBusy,onDirty,onChanged}:{organization:string;context:z.infer<typeof invoiceCreditContext>;disabled:boolean;timezone:string;onBusy:(v:boolean)=>void;onDirty:(v:boolean)=>void;onChanged:()=>Promise<unknown>}){
 const [action,setAction]=useState<'issue'|'reverse'>('issue'),[subtotal,setSubtotal]=useState('0'),[tax,setTax]=useState(context.taxComponents.map(()=>'0')),[reason,setReason]=useState(''),[selected,setSelected]=useState(''),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[sync,setSync]=useState(false),[message,setMessage]=useState('');
 const attempt=useRef<{body:string;original?:typeof context.credits[number]}|null>(null),sending=useRef(false),mounted=useRef(true),locked=busy||unknown||sync,dirty=Boolean(reason||selected||reviewed||subtotal!=='0'||tax.some(t=>t!=='0'));
 const reversed=new Set(context.credits.map(c=>c.reversesId)),eligible=context.credits.filter(c=>!c.reversesId&&!reversed.has(c.id));
 const credited=creditTotal(context.credits),balance=context.totalCents-context.paidCents-credited;
 const chargeLeft=context.subtotalCents-context.credits.reduce((n,c)=>n+c.subtotalCents,0);
 const taxLeft=context.taxComponents.map((t,i)=>t.taxCents-context.credits.reduce((n,c)=>n+c.taxComponents[i]!.taxCents,0));
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{setReviewed(false);},[context.revision,context.paidCents]);
 useEffect(()=>{onBusy(locked);return()=>onBusy(false);},[locked,onBusy]);useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
 useBlockedEntry('invoice-credit:'+organization+context.invoiceId,locked);useUnsavedEntry('invoice-credit:'+organization+context.invoiceId,dirty);
 async function refresh(){setBusy(true);try{await onChanged();if(mounted.current){setSync(false);setMessage('Credit history and remaining balance refreshed.');}}catch{if(mounted.current)setMessage('The credit is saved. Refresh its history before another change.');}finally{if(mounted.current)setBusy(false);}}
 async function send(){if(sending.current||!attempt.current)return;const frozen=attempt.current;sending.current=true;setBusy(true);setMessage('');let saved=false;
  try{const r=await sessionFetch('/api/invoice-credits',{method:'POST',headers:{'Content-Type':'application/json'},body:frozen.body});
   if(!r.ok&&r.status>=400&&r.status<500&&!unknown){attempt.current=null;setMessage('The credit was rejected. Your entries are kept; refresh the invoice and review them before another save.');return;}
   if(!r.ok)throw Error('UNKNOWN');const c=invoiceCreditCommand.parse(JSON.parse(frozen.body)),proof=verifyCreditSaved(await r.json(),c);
   if(frozen.original&&(proof.credit.totalCents!==-frozen.original.totalCents||proof.credit.subtotalCents!==-frozen.original.subtotalCents||proof.credit.taxComponents.length!==frozen.original.taxComponents.length||proof.credit.taxComponents.some((t,i)=>t.taxCents!==-frozen.original!.taxComponents[i]!.taxCents||t.label!==frozen.original!.taxComponents[i]!.label||t.kind!==frozen.original!.taxComponents[i]!.kind||t.ratePpm!==frozen.original!.taxComponents[i]!.ratePpm)))throw Error('UNKNOWN');
   if(!mounted.current)return;attempt.current=null;setUnknown(false);setSync(true);setSubtotal('0');setTax(context.taxComponents.map(()=>'0'));setReason('');setSelected('');setReviewed(false);saved=true;
  }catch{if(mounted.current){setUnknown(true);setMessage('The saved credit result is uncertain. Keep this screen open and check the same attempt before another change.');}}
  finally{sending.current=false;if(mounted.current)setBusy(false);}
  if(saved&&mounted.current)await refresh();
 }
 function submit(){if(disabled||locked||sending.current||!context.canIssue)return;
  try{const values=tax.map(creditAmount),charges=creditAmount(subtotal),original=eligible.find(c=>c.id===selected);
   if(action==='issue'&&(charges>chargeLeft||values.some((v,i)=>v>taxLeft[i]!)||charges+values.reduce((n,v)=>n+v,0)>balance))throw Error('The credit exceeds an original component or the unpaid balance.');
   const c=invoiceCreditCommand.parse({organization,invoice:context.invoiceId,revision:context.revision,key:crypto.randomUUID(),action,reason,reviewed,...(action==='issue'?{subtotalCents:charges,taxCents:values}:{credit:selected})});if(action==='reverse'&&!original)throw Error('Choose an uncorrected credit.');
   attempt.current={body:JSON.stringify(c),original:action==='reverse'?original:undefined};void send();
  }catch{setMessage('Review the charge and tax credit amounts, a 10–300 character reason, and your confirmation. Credits cannot exceed the remaining original components or unpaid balance.');}
 }
 return <details className="receipt-correction"><summary>Invoice credits and corrections</summary><p>Credits reduce an unpaid bill. They do not record a payment or send a refund. Original charges, receipts and adjustments remain in history.</p>
 {context.credits.length>0&&<p>Net credit after corrections: {usd(credited)}. The invoice document includes the retained adjustment history.</p>}
 {context.canIssue&&<>{message&&<p role="status">{message}</p>}{unknown&&<button type="button" disabled={busy} onClick={()=>void send()}>Check saved credit result</button>}{sync&&<button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh credit history</button>}
 <form onSubmit={e=>{e.preventDefault();submit();}}><fieldset disabled={disabled||locked}>
 <label>Adjustment<select value={action} onChange={e=>{setAction(e.target.value as 'issue'|'reverse');setReviewed(false);}}><option value="issue">Issue a credit</option><option value="reverse" disabled={!eligible.length}>Correct a mistaken credit</option></select></label>
 {action==='issue'?<><p>Unpaid balance {usd(balance)}. Enter the exact reductions you reviewed, including each applicable sales-tax component.</p><label>Charge credit (USD) · up to {usd(chargeLeft)}<input inputMode="decimal" required value={subtotal} onChange={e=>{setSubtotal(e.target.value);setReviewed(false);}}/></label>{context.taxComponents.map((t,i)=><label key={i}>{t.label} tax credit (USD) · up to {usd(taxLeft[i]!)}<input inputMode="decimal" required value={tax[i]} onChange={e=>{setTax(v=>v.map((n,index)=>index===i?e.target.value:n));setReviewed(false);}}/></label>)}</>:<><p>Correcting a mistaken credit restores its exact charge and tax amounts to the balance. It does not collect money.</p><label>Original credit<select required value={selected} onChange={e=>{setSelected(e.target.value);setReviewed(false);}}><option value="">Choose a credit</option>{eligible.map(c=><option key={c.id} value={c.id}>{usd(c.totalCents)} · {new Date(c.issuedAt).toLocaleDateString('en-US',{timeZone:timezone})}</option>)}</select></label></>}
 <label>Reason shown on the invoice<textarea required minLength={10} maxLength={300} value={reason} onChange={e=>{setReason(e.target.value);setReviewed(false);}}/></label><p className="tiny">Use a customer-facing explanation. Do not include account numbers, access codes or private notes.</p><label className="check"><input required type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed the original invoice, remaining balance, exact charge/tax amounts and this adjustment.</label><button disabled={!reviewed||action==='issue'&&balance<=0||action==='reverse'&&!selected}>Save reviewed adjustment</button></fieldset></form></>}
 </details>;
}
