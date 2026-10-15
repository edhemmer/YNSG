import {z} from 'zod';

export const taskStandard=z.object({
 service:z.string().trim().min(2).max(80),
 task:z.string().trim().min(2).max(120),
 // The minimum planned allocation per task is one hour, not an extra hourly charge.
 plannedMinutes:z.number().int().min(60).max(1440),
 typicalMinutes:z.number().int().min(15).max(1440),
 difficulty:z.enum(['routine','variable','complex']),
 setupMinutes:z.number().int().min(0).max(240),
 pickupMinutes:z.number().int().min(0).max(480),
 notes:z.string().trim().max(800),
}).strict().refine(x=>x.plannedMinutes>=x.typicalMinutes,{message:'Planning time must cover the task estimate'});
export type TaskStandard=z.infer<typeof taskStandard>;
export const ownerTaskStandards=z.array(taskStandard).max(150).superRefine((values,ctx)=>{
 const found=new Set<string>();
 values.forEach((v,i)=>{const key=(v.service+'::'+v.task).toLocaleLowerCase('en-US');if(found.has(key))ctx.addIssue({code:'custom',path:[i],message:'Duplicate task standard'});found.add(key);});
});
export type VisitTask={service:string;task:string;sizeFactor?:number};
export type EstimateResult={taskMinutes:number;visitMinutes:number;bufferMinutes:number;missing:VisitTask[];breakdown:{service:string;task:string;minutes:number}[]};
export function estimateVisit(tasks:VisitTask[],standards:TaskStandard[],travelBufferMinutes:number,minimumVisitMinutes=120):EstimateResult{
 if(!Number.isInteger(travelBufferMinutes)||travelBufferMinutes<0||travelBufferMinutes>240)throw Error('INVALID_BUFFER');
 if(!Number.isInteger(minimumVisitMinutes)||minimumVisitMinutes<60)throw Error('INVALID_MINIMUM');
 const canonical=ownerTaskStandards.parse(standards),map=new Map(canonical.map(x=>[x.service.toLowerCase()+'::'+x.task.toLowerCase(),x]));
 const missing:VisitTask[]=[],breakdown:EstimateResult['breakdown']=[];let taskMinutes=0;
 for(const work of tasks){
  const factor=work.sizeFactor??1;
  if(!Number.isFinite(factor)||factor<0.5||factor>4)throw Error('INVALID_JOB_SIZE');
  const rule=map.get(work.service.toLowerCase()+'::'+work.task.toLowerCase());
  if(!rule){missing.push(work);continue;}
  // One-hour per-task minimum is an allocation floor, not separately billed line items.
  const minutes=Math.ceil(Math.max(60,rule.plannedMinutes*factor)/15)*15;
  taskMinutes+=minutes;breakdown.push({service:work.service,task:work.task,minutes});
 }
 if(!tasks.length||missing.length)return {taskMinutes,visitMinutes:0,bufferMinutes:travelBufferMinutes,missing,breakdown};
 return {taskMinutes,visitMinutes:Math.max(minimumVisitMinutes,taskMinutes)+travelBufferMinutes,bufferMinutes:travelBufferMinutes,missing,breakdown};
}
export function reviewTaskTime(plannedMinutes:number,actualMinutes:number,diagnosisMinutes=0){
 for(const n of [plannedMinutes,actualMinutes,diagnosisMinutes])if(!Number.isInteger(n)||n<0||n>1440)throw Error('INVALID_WORK_TIME');
 if(plannedMinutes<60||actualMinutes===0||diagnosisMinutes>actualMinutes)throw Error('INVALID_WORK_TIME');
 const difference=actualMinutes-plannedMinutes;
 const variancePercent=Math.round(100*difference/plannedMinutes);
 return {
  differenceMinutes:difference,variancePercent,
  status:variancePercent>25?'review-overrun':variancePercent< -25?'review-underestimate':'within-range',
  nextAction:variancePercent>25?'Review job size, scope, preparation and diagnostic stop point before revising a future time standard.':variancePercent< -25?'Compare similar completed jobs before reducing the future standard.':'Record the result and retain this planning estimate until more jobs confirm it.',
  diagnosisSharePercent:Math.round(100*diagnosisMinutes/actualMinutes)
 };
}
export type FieldPreflight={topicId:string;title:string;questions:string[];tools:string[];stop:string};
export function preflightForWork(service:string,task:string):FieldPreflight|null{
 const name=(service+' '+task).toLowerCase();
 if(/shelf|shelving|bracket/.test(name))return {topicId:'shelf-anchors',title:'Shelf installation preflight',questions:['What is the shelf and loaded weight?','Is the wall drywall, plaster, masonry or another material?','Are suitable anchors/studs and safe drilling clear?'],tools:['Stud finder','Level','Compatible brackets/anchors','Drill and bits'],stop:'Do not assume drywall anchors are suitable for a heavy load or unverified substrate.'};
 if(/picture|photo frame|artwork|mirror/.test(name))return {topicId:'hang-artwork',title:'Wall-hanging preflight',questions:['What is the object weight and hanging hardware?','Where are studs or suitable wall anchors?','Is there a safe area free of known utilities?'],tools:['Tape','Level','Stud finder','Rated hangers'],stop:'Heavy mirrors and valuables require separate scope and handling review.'};
 if(/drywall|patch|spackle/.test(name))return {topicId:'drywall-small-and-medium',title:'Drywall repair preflight',questions:['How big and deep is the hole?','Any water damage or hidden utilities?','Will compound drying require another visit?'],tools:['Patch/filler','Putty knives','Dust protection'],stop:'Do not disturb suspect hazardous wall materials or conceal leaks.'};
 if(/trim|miter|mitre|angle cut|baseboard/.test(name))return {topicId:'cutting-angles',title:'Trim & angle cutting preflight',questions:['Is the corner actually 90 degrees?','What is the trim profile and cut orientation?','Is scrap available for a test fit?'],tools:['Angle finder','Measuring tape','Scrap','Guarded saw'],stop:'No unsafe saw operations or work outside approved height.'};
 if(/caulk|sealant/.test(name))return {topicId:'caulking-video',title:'Caulking preflight',questions:['Is the old bead failing or hiding water damage?','Which surfaces and compatible sealant?','What is the required cure time?'],tools:['Surface-safe scraper','Compatible caulk','Cleaners','Caulk gun'],stop:'Do not caulk over unresolved moisture or unprepared surfaces.'};
 if(/lock|deadbolt/.test(name))return {topicId:'smart-lock-triage',title:'Lock diagnostic preflight',questions:['Exact manufacturer/model and symptom?','Have correct fresh batteries been tested?','Can the customer maintain backup entry?'],tools:['Model guide','Fresh batteries','Flashlight'],stop:'Smart-lock work is held pending approval; training only.'};
 return null;
}
export const verifiedHandymanSources=[
 {id:'cutting-angles',title:'Measure and bisect real-world corners for miter cuts',source:'This Old House (official video)',url:'https://www.youtube.com/watch?v=Idm2bJFFObU',checkedOn:'2026-10-15',safety:'Use actual wall angle, test on scrap and follow the guarded saw manual.'},
 {id:'drywall-small-and-medium',title:'Repair drywall holes by damage size',source:'This Old House (step-by-step video and article)',url:'https://www.thisoldhouse.com/walls/how-to-patch-holes-in-drywall',checkedOn:'2026-10-15',safety:'Inspect for moisture, wiring or unusual wall materials. Compound drying may require a return visit.'},
 {id:'shelf-anchors',title:'Locate studs and install wall-mounted shelving',source:'This Old House (illustrated installation)',url:'https://www.thisoldhouse.com/moving/how-to-install-wall-mounted-shelves',checkedOn:'2026-10-15',safety:'Verify wall structure, hidden utilities, expected load and manufacturer-rated hardware; avoid heavy structural installations.'},
 {id:'hang-artwork',title:'Choose safe hardware for frames and pictures',source:'This Old House (hanger/anchor guide)',url:'https://www.thisoldhouse.com/walls/how-to-choose-the-right-hanging-hardware',checkedOn:'2026-10-15',safety:'Check object weight, anchor working load, wall type and fall/injury risk.'},
] as const;
export const trainingTopics=[
 {id:'smart-lock-triage',title:'Diagnose a smart lock before replacement',source:'Manufacturer-specific troubleshooting',url:'https://www.kwikset.com/support/topics/door-handing-process',safety:'Check make and exact model; do not reset without customer authorization or lockout recovery.'},
 {id:'remove-caulk',title:'Remove failing bathroom caulk',source:'This Old House',url:'https://www.thisoldhouse.com/bathrooms/removing-silicone-caulk',safety:'Protect acrylic/plastic surfaces and follow product cure time.'},
 {id:'apply-caulk',title:'Apply a clean new bead',source:'This Old House',url:'https://www.thisoldhouse.com/bathrooms/laying-down-a-perfect-bead',safety:'Surface must be clean and dry; confirm sealant compatibility.'},
 {id:'miter-saw',title:'Safer miter saw setup and cuts',source:'OSHA',url:'https://www.osha.gov/etools/machine-guarding/saws/miter',safety:'Guard, clamp and support the work; wear eye protection and follow saw manual.'},
 {id:'miter-cuts-video',title:'Video: make more accurate miter cuts',source:'This Old House — illustrated tutorial and video',url:'https://www.thisoldhouse.com/woodworking/how-to-cut-miters',safety:'Confirm saw model, blade guard, work holding and personal protective equipment before using any tutorial.'},
 {id:'caulking-video',title:'Video: remove and replace bathtub caulk',source:'Ask This Old House — tutorial and video',url:'https://www.thisoldhouse.com/bathrooms/how-to-caulk-around-a-bathtub',safety:'Confirm material compatibility, mold/water damage, sealant label and cure time; demonstrated timing is not universal.'},
] as const;
export const allTrainingTopics=[...trainingTopics,...verifiedHandymanSources] as const;
export const examplePlanningStandards:TaskStandard[]=ownerTaskStandards.parse([
 {service:'Lawn care',task:'Mow, trim and blow-off',plannedMinutes:60,typicalMinutes:45,difficulty:'routine',setupMinutes:10,pickupMinutes:0,notes:'Example only; slope, acreage, obstacles and access change the time.'},
 {service:'Yard & garden',task:'Pulling weeds by hand',plannedMinutes:120,typicalMinutes:120,difficulty:'variable',setupMinutes:15,pickupMinutes:0,notes:'Measure beds and weed density before committing.'},
 {service:'Yard & garden',task:'Bulk or bagged mulch pickup, delivery & spreading',plannedMinutes:240,typicalMinutes:240,difficulty:'variable',setupMinutes:15,pickupMinutes:60,notes:'Example includes pickup, loading, delivery and spreading; supplier materials paid directly.'},
 {service:'Help around the home',task:'Smart-lock troubleshooting',plannedMinutes:120,typicalMinutes:90,difficulty:'complex',setupMinutes:15,pickupMinutes:0,notes:'Training reference only. Smart lock work remains held until compliance and owner scope approval.'},
]);
