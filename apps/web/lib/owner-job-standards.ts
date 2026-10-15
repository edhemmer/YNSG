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
export const trainingTopics=[
 {id:'smart-lock-triage',title:'Diagnose a smart lock before replacement',source:'Manufacturer-specific troubleshooting',url:'https://www.kwikset.com/support/topics/door-handing-process',safety:'Check make and exact model; do not reset without customer authorization or lockout recovery.'},
 {id:'remove-caulk',title:'Remove failing bathroom caulk',source:'This Old House',url:'https://www.thisoldhouse.com/bathrooms/removing-silicone-caulk',safety:'Protect acrylic/plastic surfaces and follow product cure time.'},
 {id:'apply-caulk',title:'Apply a clean new bead',source:'This Old House',url:'https://www.thisoldhouse.com/bathrooms/laying-down-a-perfect-bead',safety:'Surface must be clean and dry; confirm sealant compatibility.'},
 {id:'miter-saw',title:'Safer miter saw setup and cuts',source:'OSHA',url:'https://www.osha.gov/etools/machine-guarding/saws/miter',safety:'Guard, clamp and support the work; wear eye protection and follow saw manual.'},
] as const;
export const examplePlanningStandards:TaskStandard[]=ownerTaskStandards.parse([
 {service:'Lawn care',task:'Mow, trim and blow-off',plannedMinutes:60,typicalMinutes:45,difficulty:'routine',setupMinutes:10,pickupMinutes:0,notes:'Example only; slope, acreage, obstacles and access change the time.'},
 {service:'Yard & garden',task:'Pulling weeds by hand',plannedMinutes:120,typicalMinutes:120,difficulty:'variable',setupMinutes:15,pickupMinutes:0,notes:'Measure beds and weed density before committing.'},
 {service:'Yard & garden',task:'Bulk or bagged mulch pickup, delivery & spreading',plannedMinutes:240,typicalMinutes:240,difficulty:'variable',setupMinutes:15,pickupMinutes:60,notes:'Example includes pickup, loading, delivery and spreading; supplier materials paid directly.'},
 {service:'Help around the home',task:'Smart-lock troubleshooting',plannedMinutes:120,typicalMinutes:90,difficulty:'complex',setupMinutes:15,pickupMinutes:0,notes:'Training reference only. Smart lock work remains held until compliance and owner scope approval.'},
]);
