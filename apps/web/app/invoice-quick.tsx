"use client";
// One-screen owner invoice: type the amount, press one button. The agreed estimate is kept as a
// private "suggested" value next to what was actually charged; customers never see it.
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {invoiceChargeCents} from '../lib/invoice-charge';
import {salesTax,type TaxRule} from '../lib/taxes';
import {ownerPricingSchema,pricingTotals,type OwnerPricing} from '../lib/owner-invoice-pricing';
import {useBlockedEntry,useUnsavedEntry} from './entry-safety';

type Row={description:string;amount:string};
type TaxContext={required:boolean;rules:TaxRule[];valid:boolean;tax:{taxCents:number;rule?:TaxRule;customerApprovalEvidence?:string}|null};
type Stage='draft'|'issue'|'email'|'done';
type Attempt={fingerprint:string;keys:{complete:string;draft:string;email:string;issue:string};stage:Stage;revision:number;invoice?:string;total?:number;completed:boolean};
const money=(cents:number)=>(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
const dollars=(cents:number)=>(cents/100).toFixed(2);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function post(url:string,body:unknown){
 const response=await sessionFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>null);
 return {ok:response.ok,status:response.status,data};
}

export default function InvoiceQuick({organization,job,revision,completed,blocked,onBusy,saved,suggested,trackedMinutes,fallback}:{
 organization:string;job:string;revision:number;completed:boolean;blocked:boolean;onBusy:(busy:boolean)=>void;saved:()=>void;
 suggested?:{description:string;chargedCents:number};trackedMinutes?:number;fallback?:ReactNode;
}){
 const [rows,setRows]=useState<Row[]>([]),[note,setNote]=useState(''),[loaded,setLoaded]=useState(false),[crew,setCrew]=useState(false);
 const [tax,setTax]=useState<TaxContext|null>(null),[taxRule,setTaxRule]=useState(''),[taxEvidence,setTaxEvidence]=useState('');
 const [ready,setReady]=useState<{ready:boolean;reasons:string[]}|null>(null),[standardCents,setStandardCents]=useState<number|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState<{stage:string;text:string}|null>(null),[retryNeeded,setRetryNeeded]=useState(false);
 const [dirty,setDirty]=useState(false),[loadError,setLoadError]=useState(false),[attempts,setAttempts]=useState(0);
 const attempt=useRef<Attempt|null>(null),mounted=useRef(true),sending=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;onBusy(false);};},[onBusy]);
 useUnsavedEntry('quick-invoice:'+organization+':'+job,dirty&&!done);
 useBlockedEntry('quick-invoice-send:'+organization+':'+job,busy||retryNeeded);

 useEffect(()=>{
  if(sending.current||attempt.current)return;
  const controller=new AbortController();let active=true;setLoaded(false);setLoadError(false);
  sessionFetch('/api/invoice-draft?'+new URLSearchParams({organization,job}),{cache:'no-store',signal:controller.signal}).then(async r=>{
   const d=await r.json();if(!r.ok)throw Error(d.error);if(!active)return;
   if(d.crew){setCrew(true);setLoaded(true);return;}
   const draftLines:{description:string;chargedCents:number}[]=d.draft?.lines?.length?d.draft.lines:suggested?[{description:suggested.description,chargedCents:suggested.chargedCents}]:[{description:'',chargedCents:0}];
   setRows(draftLines.map(l=>({description:(l.description||'').slice(0,1000),amount:l.chargedCents?dollars(l.chargedCents):(d.draft?.lines?.length?'0.00':'')})));
   const priced=d.ownerPricing?ownerPricingSchema.safeParse(d.ownerPricing):null;
   setStandardCents(priced?.success?pricingTotals(priced.data).standardCents:suggested?suggested.chargedCents:null);
   setNote(priced?.success?priced.data.reason:'');
   setTax(d.tax);setTaxRule(d.tax?.valid?d.tax?.tax?.rule?.id||'':'');setTaxEvidence(d.tax?.valid?d.tax?.tax?.customerApprovalEvidence||'':'');
   setReady(d.readiness||null);setDirty(false);setLoaded(true);
  }).catch(e=>{if(active&&!controller.signal.aborted){setLoadError(true);setMessage(publicError(e));}});
  return()=>{active=false;controller.abort();};
 // Re-read only when the saved job changes underneath an idle editor.
 },[organization,job,revision,attempts]);// eslint-disable-line react-hooks/exhaustive-deps

 if(crew&&fallback)return <>{fallback}</>;
 const cents=rows.map(r=>invoiceChargeCents(r.amount.trim()));
 const valid=rows.length>0&&cents.every(n=>n!==null)&&rows.every(r=>r.description.trim().length>=2);
 const subtotal=cents.reduce<number>((s,n)=>s+(n??0),0);
 const rule=tax?.rules.find(r=>r.id===taxRule);
 let taxed:{taxCents:number;totalCents:number}|null=null;try{if(rule)taxed=salesTax(subtotal,rule);}catch{}
 const taxNeeded=tax?.required===true;
 const total=taxNeeded?(taxed?.totalCents??null):subtotal;
 const taxOk=!taxNeeded||(Boolean(taxed)&&taxEvidence.trim().length>=2);
 const diff=standardCents===null?null:subtotal-standardCents;
 const canSend=loaded&&valid&&taxOk&&ready?.ready!==false&&total!==null&&!busy&&!blocked&&!done;

 function edit(next:Row[]){setRows(next);setDirty(true);setMessage('');setRetryNeeded(false);}
 function privateRecord():OwnerPricing{
  const std=standardCents??subtotal;
  const label=(rows[0]?.description.trim()||'Service performed').slice(0,160);
  return {services:[{description:label.length>=2?label:'Service performed',method:'fixed',standardCents:std,billedCents:subtotal}],reason:note.trim().slice(0,500)};
 }
 function lines(){
  const minutes=Number.isSafeInteger(trackedMinutes)&&trackedMinutes!==undefined&&trackedMinutes>=0&&trackedMinutes<=1440?trackedMinutes:0;
  return rows.map((r,i)=>({description:r.description.trim(),recordedMinutes:i===0?minutes:0,chargedCents:cents[i] as number,waiverReason:(cents[i]??0)===0?'No charge':'',billingBasis:'fixed' as const}));
 }
 async function run(issueAfter:boolean){
  if(sending.current||!loaded||!valid||blocked)return;
  const body=lines();
  const fingerprint=JSON.stringify([organization,job,body,privateRecord(),taxRule,taxEvidence,issueAfter]);
  if(!attempt.current||attempt.current.fingerprint!==fingerprint){
   if(attempt.current&&attempt.current.stage!=='draft'&&attempt.current.fingerprint!==fingerprint){setMessage('Part of this invoice is already saved. Refresh the job before changing it.');return;}
   attempt.current={fingerprint,keys:{complete:crypto.randomUUID(),draft:crypto.randomUUID(),email:crypto.randomUUID(),issue:crypto.randomUUID()},stage:'draft',revision,completed};
  }
  const a=attempt.current as Attempt;sending.current=true;setBusy(true);onBusy(true);setMessage('');setRetryNeeded(false);
  try{
   if(a.stage==='draft'){
    if(!a.completed){
     setMessage('Saving the visit…');
     const r=await post('/api/visit-completion',{organization,job,revision:a.revision,lines:body,key:a.keys.complete,reviewed:true});
     if(!r.ok){if(r.status<500&&r.data?.uncertain===false)throw new Error('REJECTED:'+(r.data?.error||'The visit was not completed.'));throw new Error('UNCONFIRMED');}
     if(r.data?.result?.status!=='completed'||!Number.isSafeInteger(r.data.result.revision)||r.data.result.revision<=a.revision)throw new Error('UNCONFIRMED');
     a.revision=r.data.result.revision;a.completed=true;
    }
    setMessage('Saving the invoice…');
    const d=await post('/api/invoice-draft',{organization,job,revision:a.revision,lines:body,ownerPricing:privateRecord(),key:a.keys.draft});
    if(!d.ok){if(d.status>=400&&d.status<500)throw new Error('REJECTED:'+(d.data?.error||'The invoice was not saved.'));throw new Error('UNCONFIRMED');}
    if(!Number.isSafeInteger(d.data?.result?.revision)||d.data.result.revision!==a.revision+1)throw new Error('UNCONFIRMED');
    a.revision=d.data.result.revision;a.stage=issueAfter?'issue':'done';
    if(!issueAfter){attempt.current=null;setDirty(false);setMessage('Saved. Nothing has been sent.');try{saved();}catch{}return;}
   }
   if(a.stage==='issue'){
    setMessage('Creating the invoice…');
    const totalCents=total as number;
    const c=await post('/api/commands',{command:'ApproveInvoice',organizationId:organization,id:job,revision:a.revision,totalCents,...(taxNeeded?{taxRuleId:taxRule,taxEvidence}:{}),reviewed:true,key:a.keys.issue});
    if(!c.ok){if(c.status>=400&&c.status<500)throw new Error('REJECTED:'+publicError(Error(c.data?.error)));throw new Error('UNCONFIRMED');}
    if(c.data?.ok!==true||typeof c.data.result?.id!=='string'||!uuid.test(c.data.result.id)||c.data.result.totalCents!==totalCents)throw new Error('UNCONFIRMED');
    a.invoice=c.data.result.id;a.total=totalCents;a.stage='email';
   }
   if(a.stage==='email'&&a.invoice){
    setMessage('Emailing the invoice…');
    const e=await post('/api/invoice-delivery',{organization,invoice:a.invoice,reviewed:true,key:a.keys.email});
    if(!e.ok){
     if(e.status>=400&&e.status<500){a.stage='done';finish('Invoice '+money(a.total??0)+' created. It was not emailed: '+(e.data?.error||'check the customer email in Settings')+'. Open it to download the PDF or send it again.');return;}
     throw new Error('UNCONFIRMED');
    }
    a.stage='done';finish('Invoice '+money(a.total??0)+' created and emailed with a PDF copy.');
   }
  }catch(err){
   const m=err instanceof Error?err.message:'';
   if(m.startsWith('REJECTED:')){
    // A rejected step never changed anything; later steps may have, so keep their progress.
    setMessage(m.slice(9));
    if(attempt.current&&attempt.current.stage==='draft'){if(attempt.current.completed&&!completed){try{saved();}catch{}}attempt.current=null;}
   }else{setRetryNeeded(true);setMessage('The connection dropped before this was confirmed. Press the button again; it safely continues from where it stopped and will not send twice.');}
  }finally{sending.current=false;if(mounted.current){setBusy(false);onBusy(false);}}
 }
 function finish(text:string){setDone({stage:'done',text});setDirty(false);setMessage('');try{saved();}catch{}}

 if(loadError)return <section className="quick-invoice"><p role="alert">{message||'The invoice could not load.'}</p><button type="button" onClick={()=>setAttempts(n=>n+1)}>Try again</button></section>;
 if(!loaded)return <section className="quick-invoice"><p role="status">Loading invoice…</p></section>;
 if(done)return <section className="quick-invoice"><p role="status"><strong>{done.text}</strong></p></section>;
 return <section className="quick-invoice" aria-label="Invoice">
  <h3>{completed?'Invoice':'Finish the visit & invoice'}</h3>
  {ready?.ready===false&&<div className="note" role="status"><strong>One thing to set up before sending</strong><ul>{ready.reasons.map(r=><li key={r}>{r}</li>)}</ul><p>You can still save this.</p></div>}
  <form onSubmit={e=>{e.preventDefault();void run(true);}}>
   <fieldset disabled={busy||blocked}>
    {rows.map((row,i)=><div className="quick-row" key={i}>
     <label>What you did<textarea required minLength={2} maxLength={1000} rows={2} value={row.description} onChange={e=>edit(rows.map((r,j)=>j===i?{...r,description:e.target.value}:r))}/></label>
     <label className="quick-amount">Amount ($)<input type="text" inputMode="decimal" autoComplete="off" required aria-label={rows.length>1?'Amount for line '+(i+1)+' in dollars':'Invoice amount in dollars'} value={row.amount} onFocus={e=>e.currentTarget.select()} onChange={e=>edit(rows.map((r,j)=>j===i?{...r,amount:e.target.value.replace(/[^0-9.]/g,'')}:r))}/></label>
     {rows.length>1&&<button type="button" className="link" onClick={()=>edit(rows.filter((_,j)=>j!==i))}>Remove line</button>}
    </div>)}
    {rows.length<10&&<button type="button" className="link" onClick={()=>edit([...rows,{description:'',amount:''}])}>+ Add a line</button>}
    {cents.some(n=>n===null)&&rows.some(r=>r.amount!=='')&&<p role="alert" className="tiny">Use dollars and cents, like 85 or 85.50.</p>}
    {taxNeeded&&<div className="quick-tax"><label>Sales tax rule<select required value={taxRule} onChange={e=>{setTaxRule(e.target.value);setDirty(true);}}><option value="">Choose the rule</option>{tax!.rules.map(r=><option key={r.id} value={r.id}>{r.label} — {r.city}, {r.state}</option>)}</select></label>
     {taxed&&<p>Tax {money(taxed.taxCents)} · Total {money(taxed.totalCents)}</p>}
     <label>Customer approved subtotal plus tax (how)<input maxLength={1000} value={taxEvidence} onChange={e=>{setTaxEvidence(e.target.value);setDirty(true);}} placeholder="e.g. Agreed by text on 11/10"/></label></div>}
    <p className="quick-total"><span>Total</span><strong>{total===null?'Choose the tax rule':money(total)}</strong></p>
    <aside className="quick-private" aria-label="Private record">
     <p><strong>Only you see this.</strong> {standardCents===null?'No estimate on file.':'Suggested '+money(standardCents)+' · charging '+money(subtotal)+(diff===0?' · on the estimate':diff!==null&&diff>0?' · '+money(diff)+' above':' · '+money(-(diff||0))+' below')+'.'}</p>
     <label>Private note (optional)<input maxLength={500} value={note} onChange={e=>{setNote(e.target.value);setDirty(true);}} placeholder="Why you charged this"/></label>
    </aside>
    <button type="submit" className="quick-send" disabled={!canSend}>{busy?(message||'Working…'):retryNeeded?'Continue sending':'Send invoice'+(total!==null?' · '+money(total):'')}</button>
    <button type="button" className="secondary" disabled={!loaded||!valid||busy||blocked||(taxNeeded&&!taxOk)} onClick={()=>void run(false)}>Save without sending</button>
   </fieldset>
   {message&&!busy&&<p role="status">{message}</p>}
   <p className="tiny">Sends the customer an email with the invoice PDF and a way to pay. You can also record cash, check or Zelle on the invoice afterward.</p>
  </form>
 </section>;
}
