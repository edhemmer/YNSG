'use client';
import {useState} from 'react';
import {reviewOnSiteExtra,type OnSiteExtraInput} from '../lib/on-site-extra';

const choices:{value:OnSiteExtraInput['work'];label:string}[]=[
 {value:'hang_picture',label:'Hang a picture or artwork'},
 {value:'hang_shelf',label:'Hang a shelf'},
 {value:'small_drywall_patch',label:'Patch a small drywall hole'},
 {value:'trim_cut',label:'Make or adjust a trim/miter cut'},
 {value:'replace_caulk',label:'Remove and replace caulk'},
 {value:'smart_lock',label:'Smart-lock work (currently held)'},
 {value:'other',label:'Another task — requires separate review'}
];
export default function OnSiteExtraReview(){
 const [work,setWork]=useState<OnSiteExtraInput['work']>('hang_shelf');
 const [expected,setExpected]=useState(60),[remaining,setRemaining]=useState(0),[material,setMaterial]=useState(0);
 const [scope,setScope]=useState(false),[price,setPrice]=useState(false),[materialsApproved,setMaterialsApproved]=useState(false),[accessSafe,setAccessSafe]=useState(false);
 const result=reviewOnSiteExtra({work,expectedMinutes:expected,remainingMinutes:remaining,additionalMaterialsCents:material,materialsApproved,scopeReviewed:scope,customerPriceApproved:price,accessSafe});
 return <details className="card" aria-label="Review an additional job requested on site">
  <summary>Customer asks for another small job?</summary>
  <p>Check the extra work before saying yes. Nothing here books extra time, changes the invoice, or records customer approval. Use the existing scope, quote and approval workflow afterward.</p>
  <label>Additional job<select value={work} onChange={e=>setWork(e.target.value as OnSiteExtraInput['work'])}>{choices.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
  <label>Estimated extra work minutes<input type="number" min={15} max={480} step={15} value={expected} onChange={e=>setExpected(Math.max(15,Math.min(480,Number(e.target.value)||15)))}/></label>
  <label>Available minutes before the next commitment<input type="number" min={0} max={720} step={15} value={remaining} onChange={e=>setRemaining(Math.max(0,Math.min(720,Number(e.target.value)||0)))}/></label>
  <label>Additional materials cost ($)<input type="number" min={0} max={999999.99} step={0.01} value={material/100} onChange={e=>setMaterial(Math.round(Math.max(0,Math.min(999999.99,Number(e.target.value)||0))*100))}/></label>
  <label className="check"><input type="checkbox" checked={accessSafe} onChange={e=>setAccessSafe(e.target.checked)}/>Safe access, appropriate wall/fixture conditions and tools verified</label>
  <label className="check"><input type="checkbox" checked={scope} onChange={e=>setScope(e.target.checked)}/>Scope and existing service restrictions reviewed</label>
  <label className="check"><input type="checkbox" checked={price} onChange={e=>setPrice(e.target.checked)}/>Customer actually agreed to the added scope and price</label>
  {material>0&&<label className="check"><input type="checkbox" checked={materialsApproved} onChange={e=>setMaterialsApproved(e.target.checked)}/>Customer approved materials and purchasing method</label>}
  <p role="status"><strong>{result.decision==='refer'?'Do not accept without separate approval':result.decision==='reschedule'?'Schedule separately':'Review and record before starting'}</strong> — reserve at least {result.allocationMinutes} minutes for the extra task.</p>
  {result.reasons.length>0&&<ul>{result.reasons.map(x=><li key={x}>{x}</li>)}</ul>}
  <ul>{result.requirements.map(x=><li key={x}>{x}</li>)}</ul>
  <p>For work already in progress, pause and confirm any change before spending time or buying supplies. The current approved appointment stays intact.</p>
 </details>;
}
