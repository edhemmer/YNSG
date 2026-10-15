import type {WorkItem} from './packing-plan.js';

export type SupplyPrompt={name:string;reason:string;requiresVerification:boolean;category:'tool'|'consumable'|'material'|'measurement'};
export type WorkSupplyReview={work:WorkItem;prompts:SupplyPrompt[];questions:string[];known:boolean;hold:boolean};
const item=(name:string,reason:string,category:SupplyPrompt['category'],requiresVerification=true):SupplyPrompt=>({name,reason,category,requiresVerification});
export function supplyReviewForWork(work:WorkItem):WorkSupplyReview {
 const name=(work.service+' '+work.task).toLowerCase();
 let prompts:SupplyPrompt[]=[],questions:string[]=[],hold=false;
 if(/shelf|shelving|bracket/.test(name)){
  prompts=[item('Stud finder','Locate suitable support','tool'),item('Level and measuring tape','Confirm placement','tool'),item('Bracket and load-rated fastener options','Match actual wall and shelf load','material'),item('Appropriate drill bits and driver','Match fastener/substrate','tool')];
  questions=['Confirm wall material, shelf dimensions, total loaded weight, bracket design and stud locations before selecting anchors.'];
 } else if(/picture|photo frame|artwork|mirror/.test(name)){
  prompts=[item('Level and tape','Mark placement','tool'),item('Manufacturer-rated hanger options','Match object weight, hanging point and wall material','material'),item('Stud finder','Locate safe support','tool')];
  questions=['Confirm object weight, hanging points, wall type and location. Heavy mirrors require separate approval.'];
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
