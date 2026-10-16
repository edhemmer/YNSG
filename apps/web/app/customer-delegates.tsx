'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {useBlockedEntry} from './entry-safety';

type Delegate={user:string;email:string;canApprove:boolean;canViewBilling:boolean;revoked:boolean;expired:boolean};
export default function CustomerDelegates({organization,customer}:{organization:string;customer:string}){
 const [rows,setRows]=useState<Delegate[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const sending=useRef(false),generation=useRef(0);
 useBlockedEntry('customer-delegates:'+organization+':'+customer,busy||uncertain);
 async function load(){
  const current=++generation.current;setLoading(true);setError('');
  try{
   const url='/api/customer-delegate?'+new URLSearchParams({organization,customer});
   const r=await sessionFetch(url,{cache:'no-store'});const result=await r.json();
   if(!r.ok||!Array.isArray(result.delegates))throw Error(typeof result.error==='string'?result.error:'Unable to verify access.');
   if(current===generation.current){setRows(result.delegates);setUncertain(false);}
  }catch{if(current===generation.current)setError('Customer access could not be verified. Try reloading before making changes.');}
  finally{if(current===generation.current)setLoading(false);}
 }
 useEffect(()=>{setRows([]);setUncertain(false);void load();return()=>{generation.current++;};},[organization,customer]);
 async function update(item:Delegate,action:'revoke'|'capabilities',canApprove=false,canViewBilling=false){
  if(sending.current||loading||busy||uncertain||item.revoked||item.expired)return;
  const explanation=action==='revoke'?'Remove this person’s access to the customer account? This cannot be undone with the same invitation.':'Change this person’s approval and billing permissions?';
  if(!window.confirm(explanation))return;
  sending.current=true;setBusy(true);setError('');setNotice('');
  try{
   const r=await sessionFetch('/api/customer-delegate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,customer,user:item.user,action,canApprove,canViewBilling})});
   const result=await r.json();
   if(!r.ok){if(r.status>=400&&r.status<500){setError(typeof result.error==='string'?result.error:'Access change rejected.');return;}throw Error('UNKNOWN');}
   if(result?.result?.user!==item.user||result?.result?.customer!==customer)throw Error('UNKNOWN');
   setUncertain(true);
   setNotice('The access change was saved. Reload current permissions to confirm them.');
   await load();
  }catch{setUncertain(true);setError('The outcome could not be confirmed. Do not repeat the change. Reload customer permissions to reconcile the saved result.');}
  finally{sending.current=false;setBusy(false);}
 }
 return <section aria-label="Customer account delegates">
  <h4>People with account access</h4>
  <p>Saved contacts do not automatically receive account access. Each person must accept a separate invitation.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <button type="button" className="secondary" disabled={busy||loading} onClick={()=>void load()}>{loading?'Checking access…':'Refresh account access'}</button>
  {rows.map(person=><article className="customer-item" key={person.user}>
   <strong>{person.email}</strong>
   <p>{person.revoked?'Access revoked':person.expired?'Access expired':'Access active'}</p>
   {!person.revoked&&!person.expired&&<>
    <p>Approvals: {person.canApprove?'Allowed':'Not allowed'} · Billing: {person.canViewBilling?'Allowed':'Not allowed'}</p>
    <div className="actions">
     <button type="button" className="secondary" disabled={busy||loading||uncertain} onClick={()=>void update(person,'capabilities',!person.canApprove,person.canViewBilling)}>{person.canApprove?'Turn off approval':'Allow approval'}</button>
     <button type="button" className="secondary" disabled={busy||loading||uncertain} onClick={()=>void update(person,'capabilities',person.canApprove,!person.canViewBilling)}>{person.canViewBilling?'Turn off billing':'Allow billing'}</button>
     <button type="button" className="secondary" disabled={busy||loading||uncertain} onClick={()=>void update(person,'revoke')}>Revoke access</button>
    </div>
   </>}
  </article>)}
  {!loading&&!rows.length&&!error&&<p>No connected customer accounts. Send an invitation above when the customer requests access.</p>}
 </section>;
}
