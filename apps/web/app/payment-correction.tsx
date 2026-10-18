'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {paymentCorrection,verifyPaymentCorrection} from '../lib/payment-correction-contract';
import {useBlockedEntry,useUnsavedEntry} from './entry-safety';
type Receipt={id:string;cents:number;method:string;reversesPayment?:string|null};
const money=(cents:number)=>(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function PaymentCorrection({organization,invoice,payments,disabled,onBusy,onChanged}:{organization:string;invoice:string;payments:Receipt[];disabled:boolean;onBusy:(value:boolean)=>void;onChanged:()=>Promise<unknown>}){
 const [selected,setSelected]=useState(''),[reason,setReason]=useState(''),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[syncNeeded,setSyncNeeded]=useState(false),[message,setMessage]=useState('');
 const attempt=useRef<{body:string;cents:number}|null>(null),sending=useRef(false),mounted=useRef(true);
 const corrected=new Set(payments.map(p=>p.reversesPayment).filter(Boolean)),eligible=payments.filter(p=>['cash','zelle'].includes(p.method)&&p.cents>0&&!corrected.has(p.id));
 const locked=busy||unknown||syncNeeded;
 useBlockedEntry('payment-correction:'+organization+invoice,locked);useUnsavedEntry('payment-correction:'+organization+invoice,Boolean(selected||reason||reviewed));
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{onBusy(locked);return()=>onBusy(false);},[locked,onBusy]);
 async function refresh(){
  setBusy(true);try{await onChanged();if(mounted.current){setSyncNeeded(false);setMessage('Receipt correction saved. The current payment history and balance are shown.');}}catch{if(mounted.current)setMessage('Correction saved. Refresh payment history before recording or correcting another receipt.');}finally{if(mounted.current)setBusy(false);}
 }
 async function send(){
  if(sending.current||!attempt.current)return;sending.current=true;setBusy(true);setMessage('');
  const frozen=attempt.current;let saved=false;
  try{
   const r=await sessionFetch('/api/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:frozen.body});
   if(!r.ok&&r.status>=400&&r.status<500&&!unknown){attempt.current=null;setMessage('Correction rejected. Refresh the payment history and review the original receipt; your reason is kept.');return;}
   if(!r.ok)throw Error('UNCONFIRMED');
   const d=await r.json();if(d.ok!==true)throw Error('UNCONFIRMED');const receipt=verifyPaymentCorrection(d.result,paymentCorrection.parse(JSON.parse(frozen.body)));if(receipt.cents!==-frozen.cents)throw Error('UNCONFIRMED');
   if(!mounted.current)return;attempt.current=null;setUnknown(false);setSelected('');setReason('');setReviewed(false);setSyncNeeded(true);saved=true;
  }catch{if(mounted.current){setUnknown(true);setMessage('Correction result is uncertain. Keep this screen open and check the same saved attempt before another change.');}}
  finally{sending.current=false;if(mounted.current)setBusy(false);}
  if(saved&&mounted.current)await refresh();
 }
 function submit(){
  if(disabled||locked||sending.current)return;const original=eligible.find(p=>p.id===selected);if(!original)return;
  const c=paymentCorrection.safeParse({organizationId:organization,key:crypto.randomUUID(),command:'ReverseRecordedPayment',id:invoice,paymentId:selected,reason,reviewed});if(!c.success){setMessage('Select the mistaken receipt, explain the correction in 10–300 characters and confirm your review.');return;}
  attempt.current={body:JSON.stringify(c.data),cents:original.cents};void send();
 }
 return <details className="receipt-correction"><summary>Correct a mistaken cash or Zelle entry</summary><p>This corrects an incorrectly recorded receipt. It does not send money or make a refund. The original receipt stays in history with a separate opposite entry. If needed, record the correct received amount afterward.</p>
 {message&&<p role="status">{message}</p>}{unknown&&<button type="button" disabled={busy} onClick={()=>void send()}>Check saved receipt correction</button>}{syncNeeded&&<button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh corrected payment history</button>}
 {!eligible.length&&!locked&&<p>No uncorrected cash or Zelle receipts are available.</p>}
 <form onSubmit={e=>{e.preventDefault();submit();}}><fieldset disabled={disabled||locked||!eligible.length}><label>Mistaken receipt<select value={selected} onChange={e=>{setSelected(e.target.value);setReviewed(false);}} required><option value="">Choose the original receipt</option>{eligible.map(p=><option key={p.id} value={p.id}>{p.method==='cash'?'Cash':'Zelle'} · {money(p.cents)}</option>)}</select></label><label>Correction reason<textarea value={reason} required minLength={10} maxLength={300} onChange={e=>{setReason(e.target.value);setReviewed(false);}}/></label><label className="check"><input type="checkbox" required checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed the original receipt. This entry was recorded incorrectly.</label><button disabled={!selected||!reviewed}>Save receipt correction</button></fieldset></form></details>;
}
