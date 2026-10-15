'use client';
import {useState} from 'react';
import {reviewUnforeseenJob,type UnforeseenInput} from '../lib/unforeseen-job-cost';

const categories:{id:UnforeseenInput['kind'];label:string}[]=[
 {id:'supply_line',label:'Supply line problem'},
 {id:'shutoff_valve',label:'Shutoff valve problem'},
 {id:'damaged_connection',label:'Damaged plumbing connection'},
 {id:'wrong_part',label:'Wrong or incompatible part'},
 {id:'hidden_damage',label:'Hidden damage discovered'},
 {id:'additional_small_task',label:'Customer requests another small job'},
 {id:'other',label:'Another unexpected condition'}
];
const dollars=(v:number)=>(v/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
const cents=(v:string)=>Math.max(0,Math.min(10000000,Math.round((Number(v)||0)*100)));
export default function UnforeseenJobReview(){
 const [kind,setKind]=useState<UnforeseenInput['kind']>('wrong_part');
 const [description,setDescription]=useState('');
 const [hands,setHands]=useState(30),[trip,setTrip]=useState(0),[remaining,setRemaining]=useState(60);
 const [laborCost,setLaborCost]=useState(0),[materials,setMaterials]=useState(0),[approvedCharge,setApprovedCharge]=useState(0);
 const [customerApproved,setCustomerApproved]=useState(false),[compatible,setCompatible]=useState(false),[safe,setSafe]=useState(false),[permitted,setPermitted]=useState(false);
 const hasDescription=description.trim().length>=5&&laborCost>0;
 const review=hasDescription?reviewUnforeseenJob({
  kind,description,expectedHandsOnMinutes:hands,supplyRunMinutes:trip,minutesBeforeNextCommitment:remaining,
  ownerLaborCostCentsPerHour:laborCost,businessMaterialCostCents:materials,additionalApprovedChargeCents:approvedCharge,
  customerApprovedExtra:customerApproved,materialCompatibilityConfirmed:compatible,
  safeConditionsConfirmed:safe,permittedByLicenseAndScope:permitted
 }):null;
 const blockedKind=['supply_line','shutoff_valve','damaged_connection','hidden_damage'].includes(kind);
 return <details className="card" aria-label="Review unexpected costs and hidden conditions">
  <summary>Unexpected problem or extra parts? Check the cost before continuing</summary>
  <p>Use this when a fitting, supply line, valve, hardware part, or hidden condition changes the job. This is a private planning worksheet. It does not change a customer agreement, appointment or invoice.</p>
  <label>Problem discovered<select value={kind} onChange={e=>{setKind(e.target.value as UnforeseenInput['kind']);setPermitted(false);setSafe(false);setCustomerApproved(false);}}>
   {categories.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
  </select></label>
  <label>What changed?<textarea maxLength={500} placeholder="Original agreed work, what you found, affected parts and what you need to verify" value={description} onChange={e=>setDescription(e.target.value)}/></label>
  {blockedKind&&<p role="alert">Stop and review licensing and safety before proceeding. In Illinois, plumbing installation and repair generally require appropriate licensing. Identifying an issue does not authorize YNSG to replace supply lines, valves or damaged plumbing.</p>}
  <label>Additional hands-on minutes<input type="number" min={0} max={1440} step={15} value={hands} onChange={e=>setHands(Math.max(0,Math.min(1440,Math.round(Number(e.target.value)||0))))}/></label>
  <label>Extra supplier-trip minutes<input type="number" min={0} max={480} step={15} value={trip} onChange={e=>setTrip(Math.max(0,Math.min(480,Math.round(Number(e.target.value)||0))))}/></label>
  <label>Time remaining before your next commitment<input type="number" min={0} max={720} step={15} value={remaining} onChange={e=>setRemaining(Math.max(0,Math.min(720,Math.round(Number(e.target.value)||0))))}/></label>
  <label>Owner cost of labor per hour ($) — required to calculate contribution<input type="number" min={0} max={1000} step={1} value={laborCost/100} onChange={e=>setLaborCost(cents(e.target.value))}/></label>
  <label>Materials paid by the business ($)<input type="number" min={0} max={100000} step={0.01} value={materials/100} onChange={e=>setMaterials(cents(e.target.value))}/></label>
  <label>Approved extra revenue ($)<input type="number" min={0} max={100000} step={0.01} value={approvedCharge/100} onChange={e=>setApprovedCharge(cents(e.target.value))}/></label>
  <label className="check"><input type="checkbox" checked={safe} onChange={e=>setSafe(e.target.checked)}/>Site conditions confirmed safe</label>
  <label className="check"><input type="checkbox" checked={permitted} onChange={e=>setPermitted(e.target.checked)}/>Correct trade license and YNSG service authorization independently verified</label>
  <label className="check"><input type="checkbox" checked={compatible} onChange={e=>setCompatible(e.target.checked)}/>Exact replacement part, measurements and supplier availability verified</label>
  <label className="check"><input type="checkbox" checked={customerApproved} onChange={e=>setCustomerApproved(e.target.checked)}/>Customer has actually approved the changed scope and additional price in the established workflow</label>
  {review?<section aria-live="polite"><p><strong>{review.decision==='stop-refer'?'Stop and refer for safety/licensing review':review.decision==='reschedule'?'Arrange a separately approved return visit':review.decision==='approval-required'?'Get missing verification and customer approval':'Review the approved scope and schedule before proceeding'}</strong></p>
   <p>Added time: <strong>{review.extraMinutes} minutes</strong> including supplier travel. Owner labor opportunity cost: <strong>{dollars(review.laborOpportunityCostCents)}</strong>.</p>
   <p>Estimated incremental contribution: <strong>{dollars(review.estimatedIncrementalContributionCents)}</strong> before unentered overhead, fees, taxes and other job costs.</p>
   {review.flags.length>0&&<ul>{review.flags.map(x=><li key={x}>{x}</li>)}</ul>}
  </section>:<p>Describe what changed and enter your own hourly labor cost to review its cost and risk.</p>}
  <p className="tiny">The owner controls rates and cost assumptions. This calculation does not automatically bill additional time, override earlier pricing, confirm compliance or authorize supplier purchases.</p>
 </details>;
}
