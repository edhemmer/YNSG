import type {WorkItem,PackingLine} from './packing-plan.js';

export type SupplyPrompt={name:string;reason:string;requiresVerification:boolean;category:'tool'|'consumable'|'material'|'measurement'};
export type WorkSupplyReview={work:WorkItem;prompts:SupplyPrompt[];questions:string[];known:boolean;hold:boolean};
const item=(name:string,reason:string,category:SupplyPrompt['category'],requiresVerification=true):SupplyPrompt=>({name,reason,category,requiresVerification});
export function supplyReviewForWork(work:WorkItem):WorkSupplyReview {
 const name=(work.service+' '+work.task).toLowerCase();
 let prompts:SupplyPrompt[]=[],questions:string[]=[],hold=false;
 if(/shelf|shelving|bracket/.test(name)){
  prompts=[item('Stud finder','Locate suitable support','tool'),item('Level and measuring tape','Confirm placement','tool'),item('Bracket and load-rated fastener options','Match actual wall and shelf load','material'),item('Appropriate drill bits and driver','Match fastener/substrate','tool')];
  questions=['Confirm shelf type (floating, bracket, track, rail), the exact manufacturer mounting diagram, wall material, shelf dimensions, total loaded weight, bracket design and stud locations. Photograph the wall, brackets and supplied hardware before shopping.'];
 } else if(/picture|photo frame|artwork|mirror/.test(name)){
  prompts=[item('Level and tape','Mark placement','tool'),item('Manufacturer-rated hanger options','Match object weight, hanging point and wall material','material'),item('Stud finder','Locate safe support','tool')];
  questions=['Confirm object weight, attachment style (sawtooth clip, D-rings, wire, French cleat or keyhole), hardware rating, mounting-point spacing, wall type and final location. A wire hanger and a fixed clip do not use the same layout or hardware. Heavy mirrors need separate approval.'];
 } else if(/blind|shade|window treatment/.test(name)){
  prompts=[item('Tape measure and level','Measure opening at several positions and identify mounting plane','tool'),item('Exact blind mounting brackets and manufacturer hardware','Match model, headrail, substrate and chosen inside/outside mount','material'),item('Substrate-compatible drill bits and fasteners','Confirm structure, bracket rating and installation instructions','tool'),item('Clearance and obstruction measurements','Check trim, handles, crank, depth and operation','measurement')];
  questions=['Determine inside versus outside mount only after measuring depth, width in three places, window squareness, hardware clearances and manufacturer minimum recess. Inside mount gives a recessed look if depth/clearance permit; outside mount may better cover trim, shallow openings or light gaps. Verify exact product model and bracket placement before buying or drilling.'];
 } else if(/dishwasher/.test(name)){
  prompts=[item('New and existing dishwasher model/installation guides','Identify exact electrical, drain, water supply and clearance requirements','measurement'),item('Photos of existing supply elbow, hose connections, drain routing and shutoff','Identify parts before disconnecting or purchasing','measurement'),item('Manufacturer-approved inlet fitting, seal/washer and hose as required','Check port type, thread, size, sealing method and whether any old component may be reused','material'),item('Appropriate leak-check and floor protection supplies','Check work area and safely identify existing water issues','tool')];
  questions=['Before travel photograph the existing 90-degree inlet elbow and both connection ends; record old/new model numbers and read the new installation manual. Confirm whether the new unit includes an elbow or requires an approved separately purchased fitting, whether the old elbow is compatible/reusable under the new manufacturer instructions and in sound condition, and whether a whole kit is actually required. Inspect shutoff, drain routing, mounting, outlet/junction requirements and local code/licensing. Unknown or regulated plumbing/electrical installation must be referred, not represented as an approved YNSG service.'];
  hold=true;
 } else if(/drywall|patch|spackle/.test(name)){
  prompts=[item('Patch or filler appropriate to measured hole','Match size and substrate','material'),item('Putty knives','Apply and feather finish','tool'),item('Drywall tape/backing if needed','Larger holes need support','material'),item('Dust control and surface protection','Protect occupied spaces','tool'),item('Compatible primer and paint if agreed','Confirm sheen/color before purchase','material')];
  questions=['Measure the hole, inspect for moisture/utilities and confirm finish/color and drying time.'];
 } else if(/trim|miter|mitre|angle cut|baseboard/.test(name)){
  prompts=[item('Angle finder and tape','Measure the actual corner','tool'),item('Scrap piece for test cuts','Avoid wasting finish material','material'),item('Correct trim stock and fasteners','Confirm profile, length, finish and cut orientation','material'),item('Guarded saw and clamps','Work safely with adequate support','tool')];
  questions=['Photograph/measure the profile, corner and finish; calculate cuts and include waste allowance only after measurements.'];
 } else if(/caulk|sealant/.test(name)){
  prompts=[item('Surface-compatible remover and scraper','Remove existing failed bead without damage','tool'),item('Compatible sealant','Select type, color and cure time after identifying the surface','material'),item('Caulk gun and tooling supplies','Apply controlled bead','tool'),item('Surface-safe cleaner and protection','Prepare dry, clean joint','consumable')];
  questions=['Confirm joint length, bead size, substrates, existing sealant and any hidden water damage.'];
 } else if(/mow|trim and blow|lawn care/.test(name)){
  prompts=[item('Working mower/trimmer/blower and charged/fueled power supply','Avoid equipment or power stop','tool'),item('Appropriate trimmer line or spare approved consumables','Avoid interrupted work','consumable'),item('PPE and debris cleanup materials','Complete approved scope','tool')];
  questions=['Confirm acreage, obstacles, slope, gates, weather, parking and equipment readiness.'];
 } else if(/weed|garden/.test(name)&&!/mulch/.test(name)){
  prompts=[item('Manual weeding tools and gloves','Only approved non-herbicide work','tool'),item('Approved debris bags/container','Confirm disposal agreement','consumable')];
  questions=['Measure beds and weed density; confirm disposal, plants to preserve and access. Do not bring herbicide.'];
 } else if(/mulch/.test(name)){
  prompts=[item('Customer-approved mulch order and pickup location','Customer prepays bulk materials','material'),item('Load restraint and suitable transport','Secure load and observe vehicle limits','tool'),item('Wheelbarrow, shovel and rake','Spreading and cleanup','tool'),item('Work gloves and site protection','Protect surface and crew','tool')];
  questions=['Confirm cubic yards/bags from measured area/depth, order paid directly to supplier, supplier hours, access and unloading route.'];
 } else if(/lock|deadbolt/.test(name)){
  prompts=[item('Exact manufacturer and model guide','Do not guess electronic lock steps','measurement'),item('Fresh specified batteries','Diagnose before purchasing replacement','consumable')];
  questions=['Verify access, backup entry and original symptoms before any disassembly. Smart-lock work remains on hold until approved.'];hold=true;
 } else {
  return {work,prompts:[],questions:['Confirm the exact requested task, measurements, approved scope, tools, consumables and permitted work before departure.'],known:false,hold:false};
 }
 return {work,prompts,questions,known:true,hold};
}
export type DaySupplyReview={items:(SupplyPrompt&{tasks:string[]})[];unscoped:WorkItem[];held:WorkItem[];questions:{work:string;question:string}[]};
export function consolidateDaySupplies(workItems:WorkItem[]):DaySupplyReview{
 const map=new Map<string,SupplyPrompt&{tasks:string[]}>(),unscoped:WorkItem[]=[],held:WorkItem[]=[],questions:DaySupplyReview['questions']=[];
 for(const work of workItems){
  const summary=supplyReviewForWork(work),label=work.task?work.service+': '+work.task:work.service;
  if(!summary.known)unscoped.push(work);
  if(summary.hold)held.push(work);
  for(const question of summary.questions)questions.push({work:label,question});
  for(const prompt of summary.prompts){
   const key=prompt.name.toLowerCase(),old=map.get(key);
   if(old){if(!old.tasks.includes(label))old.tasks.push(label);}
   else map.set(key,{...prompt,tasks:[label]});
  }
 }
 return {items:[...map.values()].sort((a,b)=>a.name.localeCompare(b.name)),unscoped,held,questions};
}

export type CombinedSupply=DaySupplyReview['items'][number]&{approved?:{quantity:number;unit:string;consumed:boolean}};
export function mergeApprovedDaySupplies(suggested:DaySupplyReview,approved:PackingLine[]):Omit<DaySupplyReview,'items'>&{items:CombinedSupply[]}{
 const key=(v:string)=>v.trim().toLocaleLowerCase('en-US').replace(/\s+/g,' ');
 const all=new Map<string,CombinedSupply>();
 for(const x of suggested.items)all.set(key(x.name),{...x});
 for(const x of approved){
  if(!x.name.trim()||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>100000||!x.unit.trim())throw Error('INVALID_APPROVED_SUPPLY');
  const k=key(x.name),previous=all.get(k);
  const quantity={quantity:x.quantity,unit:x.unit,consumed:x.consumed};
  if(previous){
   all.set(k,{...previous,approved:quantity,reason:previous.reason+'; approved equipment quantity reviewed separately'});
  }else all.set(k,{name:x.name,category:x.consumed?'consumable':'tool',reason:'Owner-approved equipment list',requiresVerification:true,tasks:['Approved day packing'],approved:quantity});
 }
 return {...suggested,items:[...all.values()].sort((a,b)=>a.name.localeCompare(b.name))};
}
