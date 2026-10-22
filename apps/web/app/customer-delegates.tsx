'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {useBlockedEntry} from './entry-safety';

type Delegate={user:string;email:string;canApprove:boolean;canViewBilling:boolean;revoked:boolean;expired:boolean};
export default function CustomerDelegates({organization,customer}:{organization:string;customer:string}){
 const [verified,setVerified]=useState(false);
 const [rows,setRows]=useState<Delegate[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const sending=useRef(false),generation=useRef(0),identity=useRef(organization+':'+customer);
 identity.current=organization+':'+customer;
 useBlockedEntry('customer-delegates:'+organization+':'+customer,busy||uncertain);
 const load=useCallback(async ()=>{
  const current=++generation.current;setLoading(true);setVerified(false);setError('');
  try{
   const url='/api/customer-delegate?'+new URLSearchParams({organization,customer});
   const r=await sessionFetch(url,{cache:'no-store'});const result=await r.json();
   if((r.status===401||r.status===403)&&current===generation.current){setRows([]);}
   if(!r.ok||!Array.isArray(result.delegates))throw Error(typeof result.error==='string'?result.error:'Unable to verify access.');
   if(current===generation.current&&identity.current===organization+':'+customer){setRows(result.delegates);setVerified(true);setUncertain(false);}
  }catch{if(current===generation.current){setVerified(false);setError('Customer access could not be verified. Try reloading before making changes.');}}
  finally{if(current===generation.current)setLoading(false);}
 },[organization,customer]);
 useEffect(()=>{
 // Capture ref containers so teardown invalidates the latest in-flight generation.
 const teardownGeneration=generation;
 setRows([]);setBusy(false);setNotice('');setUncertain(false);void load();return()=>{teardownGeneration.current++;};},[load]);
 async function update(item:Delegate,action:'revoke'|'capabilities',canApprove=false,canViewBilling=false){
  if(sending.current||!verified||loading||busy||uncertain||item.revoked||item.expired)return;
  const explanation=action==='revoke'?'Remove this person’s access to the customer account? This cannot be undone with the same invitation.':'Change this person’s approval and billing permissions?';
  if(!window.confirm(explanation))return;
  const target=organization+':'+customer,attemptGeneration=generation.current;
  sending.current=true;setBusy(true);setError('');setNotice('');
  try{
   const r=await sessionFetch('/api/customer-delegate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,customer,user:item.user,action,canApprove,canViewBilling})});
   const result=await r.json();
   if(identity.current!==target||generation.current!==attemptGeneration)return;
   if(!r.ok){if(r.status>=400&&r.status<500){setError(typeof result.error==='string'?result.error:'Access change rejected.');return;}throw Error('UNKNOWN');}
   if(result?.result?.user!==item.user||result?.result?.customer!==customer)throw Error('UNKNOWN');
   setUncertain(true);
   setNotice('The access change was saved. Reload current permissions to confirm them.');
   await load();
  }catch{if(identity.current!==target||generation.current!==attemptGeneration)return;setUncertain(true);setError('The outcome could not be confirmed. Do not repeat the change. Reload customer permissions to reconcile the saved result.');}
  finally{sending.current=false;if(identity.current===target)setBusy(false);}
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
     <button type="button" className="secondary" disabled={busy||loading||uncertain||!verified} onClick={()=>void update(person,'capabilities',!person.canApprove,person.canViewBilling)}>{person.canApprove?'Turn off approval':'Allow approval'}</button>
     <button type="button" className="secondary" disabled={busy||loading||uncertain||!verified} onClick={()=>void update(person,'capabilities',person.canApprove,!person.canViewBilling)}>{person.canViewBilling?'Turn off billing':'Allow billing'}</button>
     <button type="button" className="secondary" disabled={busy||loading||uncertain||!verified} onClick={()=>void update(person,'revoke')}>Revoke access</button>
    </div>
   </>}
  </article>)}
  {!loading&&!rows.length&&!error&&<p>No connected customer accounts. Send an invitation above when the customer requests access.</p>}
 </section>;
}
