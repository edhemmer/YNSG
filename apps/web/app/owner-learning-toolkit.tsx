'use client';
import {useMemo,useState} from 'react';
import {estimateVisit,examplePlanningStandards,trainingTopics,reviewTaskTime,type TaskStandard} from '../lib/owner-job-standards';

const lessonDetails:Record<string,{steps:string[];tools:string[];stop:string}>={
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
export default function OwnerLearningToolkit(){
 const [service,setService]=useState(examplePlanningStandards[0]!.service+'::'+examplePlanningStandards[0]!.task);
 const [minutes,setMinutes]=useState(60);
 const [factor,setFactor]=useState(1);
 const [topic,setTopic]=useState<string>(trainingTopics[0]!.id);
 const [actual,setActual]=useState(120),[diagnostic,setDiagnostic]=useState(20);
 const rule=examplePlanningStandards.find(x=>x.service+'::'+x.task===service)??examplePlanningStandards[0]!;
 const estimate=useMemo(()=>{
  const work:TaskStandard={...rule,plannedMinutes:minutes,typicalMinutes:Math.min(rule.typicalMinutes,minutes)};
  return estimateVisit([{service:work.service,task:work.task,sizeFactor:factor}],[work],30);
 },[rule,minutes,factor]);
 const selected=trainingTopics.find(t=>t.id===topic)??trainingTopics[0]!;
 const lesson=lessonDetails[selected.id]!;
 return <section className="card" aria-labelledby="learning-heading">
  <h2 id="learning-heading">Field guide & job planner</h2>
  <p>Practical preparation, sourced trade references, and a planning worksheet. References are not a guarantee of results and don't approve held services.</p>
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
   <label>Topic<select value={topic} onChange={e=>setTopic(e.target.value)}>{trainingTopics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
   <h3>{selected.title}</h3><p><strong>Before starting:</strong> {selected.safety}</p>
   <h4>Checklist</h4><ol>{lesson.steps.map(s=><li key={s}>{s}</li>)}</ol>
   <h4>Useful tools and materials</h4><ul>{lesson.tools.map(s=><li key={s}>{s}</li>)}</ul>
   <p><strong>Stop / refer:</strong> {lesson.stop}</p>
   <p><a href={selected.url} target="_blank" rel="noopener noreferrer">Read the {selected.source} reference ↗</a></p>
  </details>
 </section>;
}
