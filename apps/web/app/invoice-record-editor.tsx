'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {invoiceRecordCommand,invoiceRecordSaved,invoiceRecordState,type InvoiceRecordState} from '../lib/invoice-record-contract';
import {useBlockedEntry,useUnsavedEntry} from './entry-safety';
type Draft={dueDate:string;archived:boolean;reason:string};
const fields=(saved:InvoiceRecordState):Draft=>({dueDate:saved.dueDate||'',archived:saved.archived,reason:''});
export default function InvoiceRecordEditor({organization,invoice,saved,disabled=false,reload,onSaved,onBusy,onDraft}:{organization:string;invoice:string;saved:InvoiceRecordState;disabled?:boolean;reload:()=>Promise<InvoiceRecordState>;onSaved:(value:InvoiceRecordState)=>void;onBusy?:(value:boolean)=>void;onDraft?:(value:boolean)=>void}){
 const [draft,setDraft]=useState(()=>fields(saved)),[revision,setRevision]=useState(saved.revision),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[conflict,setConflict]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const baseline=useRef(fields(saved)),attempt=useRef<string|null>(null),sending=useRef(false),mounted=useRef(true),dirtyRef=useRef(false),locked=busy||unknown;
 useUnsavedEntry('invoice-record:'+organization+':'+invoice,dirty);
 useBlockedEntry('invoice-record:'+organization+':'+invoice,locked);
 useEffect(()=>{onDraft?.(dirty);return()=>onDraft?.(false);},[dirty,onDraft]);
 useEffect(()=>{onBusy?.(locked);return()=>onBusy?.(false);},[locked,onBusy]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{if(saved.revision<=revision)return;if(dirtyRef.current||attempt.current){setConflict(true);return;}baseline.current=fields(saved);setDraft(baseline.current);setRevision(saved.revision);},[saved.revision,saved.dueDate,saved.archived,revision]);
 function edit(value:Partial<Draft>){const next={...draft,...value},changed=JSON.stringify(next)!==JSON.stringify(baseline.current);dirtyRef.current=changed;setDirty(changed);setNotice('');setError('');setDraft(next);}
 async function refresh(){
  if(locked||disabled||sending.current)return;
  if(dirtyRef.current&&!window.confirm('Reload the saved invoice record and discard your unsaved due date, archive choice and reason?'))return;
  setBusy(true);setError('');
  try{const latest=invoiceRecordState.parse(await reload());if(latest.revision<revision)throw Error('STALE_READ');if(!mounted.current)return;baseline.current=fields(latest);setDraft(baseline.current);setRevision(latest.revision);setConflict(false);dirtyRef.current=false;setDirty(false);setNotice('Saved invoice record loaded.');}
  catch{if(mounted.current)setError('The saved invoice record could not load. Your entries are kept. Try again.');}
  finally{if(mounted.current)setBusy(false);}
 }
 async function send(){
  if(sending.current||!attempt.current)return;sending.current=true;setBusy(true);setError('');setNotice('');
  try{const response=await sessionFetch('/api/invoice-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:attempt.current});
   if(!response.ok&&response.status>=400&&response.status<500){if(mounted.current){attempt.current=null;setUnknown(false);setConflict(true);setError(response.status===401||response.status===403?'Your account cannot update this invoice record. Sign in or review your access.':'The invoice record changed or the entries were rejected. Your draft is kept; reload the saved record before trying a new save.');}return;}
   const body=await response.json();if(!response.ok)throw Error('UNVERIFIED');const result=invoiceRecordSaved.parse(body);if(!mounted.current)return;
   attempt.current=null;setUnknown(false);setConflict(false);dirtyRef.current=false;setDirty(false);setRevision(result.revision);baseline.current=fields(result);setDraft(baseline.current);setNotice('Invoice record saved. Issued charges are unchanged. No email was sent.');try{onSaved({revision:result.revision,dueDate:result.dueDate,archived:result.archived});}catch{setError('The invoice record was saved. Refresh the invoice to update the rest of this screen.');}
  }catch{if(mounted.current){setUnknown(true);setError('We couldn’t confirm whether this change saved. Keep this screen open and choose “Check saved invoice record” before changing anything else.');}}
  finally{sending.current=false;if(mounted.current)setBusy(false);}
 }
 function save(){if(!dirty||disabled||locked||conflict||sending.current)return;const value=invoiceRecordCommand.safeParse({organization,invoice,revision,dueDate:draft.dueDate||null,archived:draft.archived,reason:draft.reason,key:crypto.randomUUID()});if(!value.success){setError('Choose a valid due date, and enter a reason or agreement evidence of 2–500 characters.');return;}attempt.current=JSON.stringify(value.data);void send();}
 return <details><summary>Due date and archive</summary><p>Record a customer-agreed due date or archive this invoice. Issued charges and payment history stay fixed. Saving does not email revised terms.</p>
  {dirty&&!locked&&!conflict&&<p role="status">Unsaved invoice record changes.</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {unknown&&<button type="button" disabled={busy} onClick={()=>void send()}>{busy?'Checking saved result…':'Check saved invoice record'}</button>}
  {conflict&&<p role="status">Your draft is kept. Reload saved details only when you are ready to discard these entries.</p>}
  <form onSubmit={e=>{e.preventDefault();save();}}><fieldset disabled={disabled||locked||conflict}>
   <label>Agreed payment due date<input name="dueDate" type="date" value={draft.dueDate} onChange={e=>edit({dueDate:e.target.value})}/></label>
   <label className="check"><input name="archived" type="checkbox" checked={draft.archived} onChange={e=>edit({archived:e.target.checked})}/>Archive this invoice</label>
   <label>Reason / customer agreement evidence<textarea required name="reason" minLength={2} maxLength={500} value={draft.reason} onChange={e=>edit({reason:e.target.value})}/></label><button disabled={!dirty}>{busy?'Saving invoice record…':'Save invoice record'}</button>
  </fieldset></form><button type="button" className="secondary" disabled={disabled||locked} onClick={()=>void refresh()}>Reload saved invoice record</button>
 </details>;
}
