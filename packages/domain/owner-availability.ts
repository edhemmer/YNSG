import {DomainError} from '../contracts/index.ts';
import type {AvailabilityInput} from './availability.ts';

// Public booking policy is deliberately absent. This authenticated staff view
// offers capacity suggestions; the canonical save rechecks resources and travel.
export function ownerOpenTimes(input:AvailabilityInput):{start:number;end:number}[]{
 const {clock,durationMinutes,windowEnd}=input;
 const windowStart=Math.max(input.windowStart??clock,clock);
 if(!Number.isSafeInteger(durationMinutes)||durationMinutes<1||durationMinutes>1440||
 !Number.isSafeInteger(clock)||!Number.isSafeInteger(windowStart)||!Number.isSafeInteger(windowEnd)||
 windowEnd<=windowStart||windowEnd-windowStart>7*86400000||input.externalBusyVerifiedUntil<=clock||input.rules.bufferMinutes===null)
 throw new DomainError('VALIDATION','Choose a valid visit length and current calendar window');
 const selected=new Set(input.selectedResources);
 if(!selected.size||selected.size!==input.selectedResources.length||
 [...selected].some(id=>!input.resources.some(r=>r.id===id&&r.status==='available'))||
 !input.resources.some(r=>selected.has(r.id)&&r.kind==='operator'))
 throw new DomainError('VALIDATION','Choose an available operator and equipment');
 const busy=[...input.blocks,...input.externalBusy,...input.reservations.filter(r=>selected.has(r.resourceId))];
 if(busy.some(i=>!Number.isSafeInteger(i.start)||!Number.isSafeInteger(i.end)||i.end<=i.start))throw new DomainError('PROVIDER_UNAVAILABLE','Calendar intervals are invalid');
 const buffer=input.rules.bufferMinutes*60000,result:{start:number;end:number}[]=[];
 for(let start=Math.ceil(windowStart/60000)*60000;start<=windowEnd;start+=60000){
  const end=start+durationMinutes*60000;
  if(!busy.some(i=>i.start<end+buffer&&i.end>start-buffer))result.push({start,end});
 }
 return result;
}
