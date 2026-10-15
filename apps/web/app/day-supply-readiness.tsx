'use client';
import {useMemo,useState} from 'react';
import {consolidateDaySupplies,mergeApprovedDaySupplies} from '../lib/day-supplies';
import type {WorkItem,PackingLine} from '../lib/packing-plan';

type State='unknown'|'packed'|'purchase'|'not-needed';
export default function DaySupplyReadiness({workItems,approvedPacking,packingAvailable}:{workItems:WorkItem[];approvedPacking:PackingLine[];packingAvailable:boolean}){
 const plan=useMemo(()=>mergeApprovedDaySupplies(consolidateDaySupplies(workItems),approvedPacking),[workItems,approvedPacking]);
 const [states,setStates]=useState<Record<string,State>>({});
 const unverified=plan.items.filter(x=>!states[x.name]||states[x.name]==='unknown');
 const toBuy=plan.items.filter(x=>states[x.name]==='purchase');
 const [measurementsReviewed,setMeasurementsReviewed]=useState(false),[copyStatus,setCopyStatus]=useState('');
 const ready=packingAvailable&&plan.items.length>0&&unverified.length===0&&toBuy.length===0&&measurementsReviewed&&plan.held.length===0&&plan.unscoped.length===0;
 return <details className="day-supplies card">
  <summary>Before you leave: consolidate tools, supplies & purchases</summary>
  <p>Suggested preparation only. This does not verify inventory or create an order. Nothing is marked packed until you check it. Items differ by the job’s size, surface and approved scope.</p>
  {!packingAvailable&&<p role="alert">Approved packing data is unavailable. This list is incomplete; refresh the day route before departure.</p>}
  {plan.held.length>0&&<p role="alert">A listed job is on hold under the current service rules. Do not use a shopping list as permission to perform it.</p>}
  {plan.unscoped.length>0&&<p role="alert">{plan.unscoped.length} job type(s) lack an approved preparation guide. Measure and review the full scope before departure.</p>}
  <h3>Confirm site details before buying</h3>
  <ul>{plan.questions.map((q,i)=><li key={i}><strong>{q.work}:</strong> {q.question}</li>)}</ul>
  <label className="check"><input type="checkbox" checked={measurementsReviewed} onChange={e=>setMeasurementsReviewed(e.target.checked)}/>Measurements, materials, supplier availability and customer purchase authorization are checked</label>
  <h3>One combined departure checklist</h3>
  {plan.items.length===0?<p>There is no complete suggested list. Check every job’s scope and approved equipment before departure.</p>:<ul>{plan.items.map(item=><li key={item.name}>
   <label>{item.name}{item.approved?' — Owner-approved: '+item.approved.quantity+' '+item.approved.unit+(item.approved.consumed?' (consumable)':' (reusable)'):''} — {item.reason}. Needed for {item.tasks.join('; ')}.
    <select aria-label={'Status for '+item.name} value={states[item.name]||'unknown'} onChange={e=>setStates(p=>({...p,[item.name]:e.target.value as State}))}>
     <option value="unknown">Not yet checked</option>
     <option value="packed">Already have it / packed</option>
     <option value="purchase">Need to obtain</option>
     <option value="not-needed">Verified not needed for this job</option>
    </select>
   </label>
  </li>)}</ul>}
  {toBuy.length>0&&<section><h3>Plan one supplier trip</h3><p>Confirm stock, exact model/material compatibility, supplier hours, quantities and customer authorization before driving. Do not assume stores have inventory.</p><ul>{toBuy.map(x=><li key={x.name}>{x.name}</li>)}</ul><button type="button" onClick={()=>{const list=toBuy.map(x=>x.name+(x.approved?' — '+x.approved.quantity+' '+x.approved.unit:'')+' — '+x.reason).join('\n');if(!navigator.clipboard?.writeText){setCopyStatus('Clipboard unavailable. Select and copy the list below.');return;}void navigator.clipboard.writeText(list).then(()=>setCopyStatus('Purchase checklist copied.')).catch(()=>setCopyStatus('Copy did not work. Select and copy the list below.'));}}>Copy purchase checklist</button><p role="status">{copyStatus}</p><textarea aria-label="Purchase checklist for manual copying" readOnly rows={Math.min(10,toBuy.length+1)} value={toBuy.map(x=>x.name+(x.approved?' — '+x.approved.quantity+' '+x.approved.unit:'')+' — '+x.reason).join('\n')}/></section>}
  <p role="status">{ready?'All suggested items have been reviewed. Re-check job-specific requirements and approved work before departure.':unverified.length+' items unchecked; '+toBuy.length+' to obtain. Complete job measurements, approval and packing before leaving.'}</p>
  <p className="tiny">This is a temporary on-screen checklist, not saved inventory. Refreshing clears it. The existing approved packing rules remain authoritative for company records.</p>
 </details>;
}
