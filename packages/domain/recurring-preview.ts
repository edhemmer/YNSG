import {weeklyDates,localDay,addDays} from '../../lib/appointment-window.js';
import {localInstant} from './timezone';
import {feasible,type Interval,type FeasibilityInput} from './scheduling';
import {DomainError} from '../contracts';

// A preview is advisory: it does not reserve resources or authorize a booking.
export function recurringPreview(input:{localStart:string;durationMinutes:number;timezone:string;clock:number;rules:FeasibilityInput['rules'];busy:readonly Interval[];verifiedUntil:number;travelBeforeMinutes:number;travelAfterMinutes:number}){
 const day=input.localStart.slice(0,10),time=input.localStart.slice(11),today=localDay(input.clock,input.timezone);
 if(day<today||day>addDays(today,30))throw new DomainError('VALIDATION','Choose the first visit within the next 30 days.');
 const series=weeklyDates(day),buffer=input.rules.bufferMinutes;
 if(buffer===null||input.verifiedUntil<=input.clock)throw new DomainError('SETUP_REQUIRED','Current calendar checks and a travel buffer are required.');
 const before=(buffer+input.travelBeforeMinutes)*60000,after=(buffer+input.travelAfterMinutes)*60000;
 const busy=input.busy.map(v=>({start:v.start-after,end:v.end+before}));
 const occurrences=series.dates.map((date,index)=>{
  const start=localInstant(`${date}T${time}`,input.timezone),end=start+input.durationMinutes*60000;
  try{
   // Only the initial visit uses the one-time booking horizon. Later visits
   // still require the same operating-hours, capacity and provider checks.
   const rules=index===0?input.rules:{...input.rules,horizonMinutes:undefined};
   feasible({start,clock:input.clock,durationMinutes:input.durationMinutes,timezone:input.timezone,rules,busy,externalBusyVerifiedUntil:input.verifiedUntil});
   return {date,start:new Date(start).toISOString(),end:new Date(end).toISOString(),available:true};
  }catch(e){
   if(!(e instanceof DomainError))throw e;
   return {date,start:new Date(start).toISOString(),end:new Date(end).toISOString(),available:false};
  }
 });
 return {occurrences,endExclusive:series.end,timezone:input.timezone,conflicts:occurrences.filter(v=>!v.available).length,reserved:false as const,validUntil:new Date(input.verifiedUntil).toISOString()};
}
