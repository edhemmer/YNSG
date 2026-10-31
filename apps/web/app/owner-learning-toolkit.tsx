'use client';
import {useMemo,useState} from 'react';
import {estimateVisit,examplePlanningStandards,allTrainingTopics,reviewTaskTime,flatTrimMiterSetting,drywallRepairGuide,type TaskStandard} from '../lib/owner-job-standards';

const lessonDetails:Record<string,{steps:string[];tools:string[];stop:string}>={
 'cutting-angles':{
  steps:['Inspect the existing corner, trim profile, orientation and wall irregularities.','Measure the actual included angle or use two straight, equal-width reference boards to bisect an irregular corner.','For equal miters divide the included angle by two, then convert correctly to the saw’s setting; mark reference faces to avoid flipped cuts.','Make a sacrificial test joint and adjust before cutting finished stock.'],
  tools:['Angle finder or sliding bevel','Square and tape measure','Pencil and equal-width reference boards','Scrap test stock','Clamps and guarded miter saw'],
  stop:'Saw settings vary by saw/reference edge and inside versus outside corners; never guess orientation, bypass guards, or cut outside approved work/safe height.'
 },
 'drywall-small-and-medium':{
  steps:['Check hole size, loose board, underlying moisture and possible hidden utilities before cutting.','For tiny holes clean and apply suitable filler; for medium holes use an appropriately sized reinforced patch. Larger damage needs backing, cut replacement and tape.','Apply thin coats and feather the edge. Respect drying times between coats; sand with dust control when cured.','Prime and paint only when dry, and discuss any additional return visit with the customer.'],
  tools:['Utility knife and putty knives','Suitable spackle/patch and joint compound','Tape and backing material when needed','Sanding equipment with dust control','Primer and finish paint'],
  stop:'Water intrusion, suspected lead-containing coatings, asbestos-containing material, unknown wiring or substantial wall damage requires specialist review before disturbance.'
 },
 'shelf-anchors':{
  steps:['Ask where the customer wants the shelf and what it will hold. Confirm planned maximum loaded weight.','Identify wall material and locate studs; scan the drilling zone for known electrical/plumbing hazards.','Check shelf/bracket instructions and appropriate fasteners for the actual substrate; prioritize studs for significant loads.','Mark a level reference, drill safe pilot holes, mount brackets and secure the shelf.','Check stability within manufacturer load limits; explain restrictions to the customer.'],
  tools:['Stud finder and utility detector','Level and tape','Appropriate rated anchors and screws','Drill/driver with suitable bits','Protective eyewear'],
  stop:'Uncertain support, hidden utilities, large loads or required access above the approved five-foot limit means stop and refer.'
 },
 'hang-artwork':{
  steps:['Confirm actual frame weight, hanging points, wall type, target placement and child/pet exposure.','Locate studs or select suitable manufacturer-rated hanging hardware for the wall.','Measure placement and spacing; check hidden utility risks before drilling.','Install securely without overtightening, hang carefully and check alignment.'],
  tools:['Scale or known documented picture weight','Tape measure and level','Stud finder','Correct rated hangers/anchors','Small hammer or drill if applicable'],
  stop:'Overhead, exceptionally heavy, valuable or breakable items and uncertain substrates need separate handling and approval.'
 },

 'smart-lock-triage':{
  steps:['Identify manufacturer and exact model. Ask about the symptom and whether a physical key and backup entry are available.','Check manufacturer-approved battery type, polarity and fresh batteries before removing anything.','With the door open, compare manual bolt movement with electronic operation. Inspect bolt/strike friction.','Follow only the model-specific calibration or handing instructions. Get permission before resets that may erase access codes.','After the first diagnostic window, explain the findings and obtain approval before extending work or ordering a replacement.'],
  tools:['Manufacturer model manual','Fresh manufacturer-approved batteries','Flashlight','Small screwdriver','Non-marring protective pad'],
  stop:'Smart-lock installation is on hold in the YNSG catalog until compliance approval. This is training, not authorization to offer it.'
 },
 'remove-caulk':{
  steps:['Identify whether the surround is acrylic, plastic, tile or another material. Protect the surfaces.','Cut and remove old caulk with a compatible tool, avoiding scratches.','Remove residue with surface-appropriate methods, clean and fully dry the joint.','Inspect moisture and damage; refer if water has penetrated behind the finish.'],
  tools:['Plastic scraper for acrylic/plastic','Caulk removal tool','Surface-compatible cleaner','Rags','Gloves'],
  stop:'Do not seal over moisture damage or use harsh removers without confirming compatibility.'
 },
 'apply-caulk':{
  steps:['Identify joint movement, surface and correct sealant; follow the sealant label.','Clean and completely dry the joint. Install backer rod when appropriate.','Cut a modest tip opening, apply a continuous bead and tool it promptly.','Follow manufacturer cure time before water exposure.'],
  tools:['Correct sealant','Caulk gun','Backer rod when required','Cleaning supplies','Tooling tool'],
  stop:'Avoid claims of waterproofing until substrate condition and full cure are verified.'
 },
 'miter-cuts-video':{
  steps:['Watch the source video for the cut type; distinguish a regular corner miter from specialty crown molding.','Measure the actual corner rather than assuming every wall is 90 degrees.','Set the measured angle on the correct saw and check blade guard, clamp and work support.','Cut a scrap test piece before any final finish stock.'],
  tools:['Tape measure','Angle finder or sliding bevel','Pencil','Scrap stock','Clamps','Guarded miter saw'],
  stop:'Review manufacturer safety procedures and refer cuts outside your competence or approved work scope.'
 },
 'caulking-video':{
  steps:['Watch the referenced demonstration for removal and application; confirm the surface and caulk differ from the demonstration if applicable.','Remove all failing material without damaging the surface.','Clean and dry thoroughly; protect adjoining finishes.','Apply compatible caulk and follow its own printed cure time rather than assuming the video timing applies.'],
  tools:['Surface-safe scraper','Painter tape','Cleaning supplies','Caulk gun','Compatible sealant','Gloves'],
  stop:'Visible hidden water damage or unresolved leaks need separate assessment; do not cover the problem with caulk.'
 },
 'miter-saw':{
  steps:['Read the exact saw manual. Inspect guard, blade condition and stable work surface.','Mark and measure stock, support and clamp it so hands stay outside the danger zone.','Set and lock the angle, check the cut line, and keep all guards in place.','Wait until the blade stops fully before repositioning work.'],
  tools:['Guarded miter saw','Work supports/clamps','Tape measure','Eye and hearing protection'],
  stop:'Do not cut unsupported stock, bypass guards or proceed without competent training.'
 }
};
const lessonGuidance:Record<string,{where:string;when:string;tip:string;attribution:string}>={
 'smart-lock-triage':{where:'At the exact model of the authorized entry lock, with a reliable way back inside.',when:'When keypad or bolt behavior changes, before buying hardware or attempting a reset.',tip:'When the bolt moves with the door open but binds when closed, investigate strike alignment before blaming the motor.',attribution:'Manufacturer troubleshooting principle — confirm model-specific guide'},
 'drywall-small-and-medium':{where:'A dry, accessible interior wall with a known nonhazardous finish.',when:'After diagnosing why the wall was damaged and ensuring there is no moisture or concealed utility hazard.',tip:'Feather multiple thin coats beyond the patch; allow full cure before sanding.',attribution:'Trade technique — follow compound manufacturer times'},
 'shelf-anchors':{where:'A surveyed wall with known substrate and suitable rated mounting hardware.',when:'Only after checking the object weight, stud position and utility risks.',tip:'Mark your bracket hole centers before drilling and test the level against the installed shelf.',attribution:'Practical field technique; verify hardware instructions'},
 'remove-caulk':{where:'A surface confirmed compatible with the removal tool and cleaner.',when:'Once the cause of the failed joint and any water intrusion has been addressed.',tip:'A plastic scraper is often less likely to damage acrylic than a metal blade.',attribution:'Practical trade tip; verify surface compatibility'},
 'apply-caulk':{where:'A clean, dry joint with the correct sealant chosen for its materials.',when:'After removing failed caulk and allowing the surface to dry fully.',tip:'A small nozzle opening makes a neat bead easier to control; do not skip the cure time.',attribution:'Practical trade tip; verify product label'}
};
export default function OwnerLearningToolkit({onNetwork,organization}:{onNetwork?:(tasks:string[])=>void;organization?:string}={}){
 const [service,setService]=useState(examplePlanningStandards[0]!.service+'::'+examplePlanningStandards[0]!.task);
 const [minutes,setMinutes]=useState(60);
 const [factor,setFactor]=useState(1);
 const [topic,setTopic]=useState<string>(allTrainingTopics[0]!.id);
 const [actual,setActual]=useState(120),[diagnostic,setDiagnostic]=useState(20);
 const [corner,setCorner]=useState(90),[hole,setHole]=useState(1);
 const rule=examplePlanningStandards.find(x=>x.service+'::'+x.task===service)??examplePlanningStandards[0]!;
 const estimate=useMemo(()=>{
  const work:TaskStandard={...rule,plannedMinutes:minutes,typicalMinutes:Math.min(rule.typicalMinutes,minutes)};
  return estimateVisit([{service:work.service,task:work.task,sizeFactor:factor}],[work],30);
 },[rule,minutes,factor]);
 const selected=allTrainingTopics.find(t=>t.id===topic)??allTrainingTopics[0]!;
 const lesson=lessonDetails[selected.id]!;
 return <section className="card" aria-labelledby="learning-heading">
  <h2 id="learning-heading">Field guide & job planner</h2>
  <p>Practical preparation, sourced trade references, and a planning worksheet. References are not a guarantee of results and don't approve held services.</p>
  {onNetwork&&<aside className="note"><strong>Choose the right next step.</strong><p>Use the guide to prepare work within your skills and approved scope. For a specialist, find someone in your private network.</p><button type="button" className="secondary" onClick={()=>onNetwork([rule.task,selected.title])}>Find a referral for this task</button>{organization&&<p><a target="_blank" rel="noopener noreferrer" href={"/task-time?"+new URLSearchParams({organization})}>Review actual job time &amp; improve your next estimate ↗</a></p>}</aside>}
  <details open><summary>Estimate time before accepting a job</summary>
   <p>This worksheet is temporary; it does not save company settings, book time or create a customer charge. Examples must be adjusted for the actual property and your skill level.</p>
   <label>Job type<select value={service} onChange={e=>{setService(e.target.value);const next=examplePlanningStandards.find(x=>x.service+'::'+x.task===e.target.value);if(next)setMinutes(next.plannedMinutes);}}>
    {examplePlanningStandards.map(item=><option key={item.service+'::'+item.task} value={item.service+'::'+item.task}>{item.service} — {item.task}</option>)}
   </select></label>
   <label>Time allocated to this job (minutes)<input type="number" min={60} max={1440} step={15} value={minutes} onChange={e=>setMinutes(Math.max(60,Math.min(1440,Math.round(Number(e.target.value)/15)*15||60)))}/></label>
   <label>Job size / difficulty adjustment<select value={factor} onChange={e=>setFactor(Number(e.target.value))}>
     <option value={0.5}>Smaller / straightforward</option><option value={1}>Typical</option><option value={1.5}>Larger / less familiar</option><option value={2}>Complex / larger scope</option>
    </select></label>
   <p role="status"><strong>Estimated job time: {estimate.taskMinutes} minutes.</strong> Combined visit capacity with the existing two-hour minimum and a sample 30-minute travel buffer: {estimate.visitMinutes} minutes.</p>
   <p>{rule.notes}</p><p>Visit planning and billing are separate. Owner-approved customer pricing is confirmed before work; independently priced services may not use the hourly minimum.</p>
  </details>
  <details><summary>Quick measurement helpers</summary>
   <p>These calculations are for planning only. Confirm actual measurements and tooling before making a cut or repair.</p>
   <h3>Flat-trim miter angle</h3>
   <label>Measured inside corner (degrees)<input type="number" min={45} max={135} step={0.5} value={corner} onChange={e=>setCorner(Number(e.target.value))}/></label>
   {corner>=45&&corner<=135&&<p role="status">For two equal pieces of flat trim, set a conventional miter saw to about <strong>{flatTrimMiterSetting(corner).sawDegrees}°</strong> off square on each piece. Half the actual corner is {flatTrimMiterSetting(corner).halfCornerDegrees}°. Test on scrap; compound crown molding and unusual profiles need separate setup.</p>}
   <h3>Drywall repair size guide</h3>
   <label>Approximate hole diameter (inches)<input type="number" min={0.1} max={48} step={0.1} value={hole} onChange={e=>setHole(Number(e.target.value))}/></label>
   {hole>0&&hole<=48&&<p role="status"><strong>{drywallRepairGuide(hole).approach}.</strong> {drywallRepairGuide(hole).planning} This usually requires drying/curing time not counted as hands-on labor.</p>}
  </details>
  <details><summary>Learn from a completed job</summary>
   <p>Private worksheet only. No customer information is saved, and this does not change an invoice or automatically reset a future time estimate.</p>
   <label>Actual work time (minutes)<input type="number" min={1} max={1440} step={5} value={actual} onChange={e=>setActual(Math.max(1,Math.min(1440,Number(e.target.value)||1)))}/></label>
   <label>Of that time, diagnosing the problem (minutes)<input type="number" min={0} max={actual} step={5} value={diagnostic} onChange={e=>setDiagnostic(Math.max(0,Math.min(actual,Number(e.target.value)||0)))}/></label>
   {actual>=1&&diagnostic<=actual&&<p role="status">{(()=>{
    const result=reviewTaskTime(estimate.taskMinutes,actual,diagnostic);
    return 'Actual versus planned: '+(result.differenceMinutes>=0?'+':'')+result.differenceMinutes+' minutes ('+(result.variancePercent>=0?'+':'')+result.variancePercent+'%). Diagnosis used '+result.diagnosisSharePercent+'% of the job. '+result.nextAction;
   })()}</p>}
  </details>
  <details><summary>Trade learning library</summary>
   <label>Topic<select value={topic} onChange={e=>setTopic(e.target.value)}>{allTrainingTopics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
   <h3>{selected.title}</h3>{("checkedOn" in selected)&&<p className="tiny">Reference checked: {selected.checkedOn}. Verify current manufacturer instructions before starting.</p>}<p><strong>Before starting:</strong> {selected.safety}</p>
   <p className="note"><strong>Training reference, not a certified procedure.</strong> Identify the exact equipment/model and read its current manufacturer instructions first. These notes do not expand YNSG's approved services.</p>
   {lessonGuidance[selected.id]&&<div className="account-card"><p><strong>Where this applies:</strong> {lessonGuidance[selected.id].where}</p><p><strong>When to use it:</strong> {lessonGuidance[selected.id].when}</p></div>}
   <h4>Before you start</h4><p>Confirm the model, customer permission, actual materials and your ability to use the tools safely. Stop when anything differs from the reference.</p>
   <h4>Step-by-step field checklist</h4><ol>{lesson.steps.map((s,i)=><li key={s}><strong>Step {i+1}.</strong> {s}</li>)}</ol>
   <div className="account-card" role="note"><h4>Watch out — stop and reassess</h4><p>{lesson.stop}</p></div>
   {lessonGuidance[selected.id]&&<div className="account-card" role="note"><h4>Pro tip</h4><p>{lessonGuidance[selected.id].tip}</p><small>{lessonGuidance[selected.id].attribution}</small></div>}
   <h4>Useful tools and materials</h4><ul>{lesson.tools.map(s=><li key={s}>{s}</li>)}</ul>
   <p><strong>Stop / refer:</strong> {lesson.stop}</p>
   <p><a href={selected.url} target="_blank" rel="noopener noreferrer">Read the {selected.source} reference ↗</a></p>
  </details>
 </section>;
}
