import { DomainError } from '../contracts/index.ts';
export function localMinute(instant: number, timezone: string) {
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(instant).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
// Explicitly reject nonexistent and ambiguous local times rather than choosing an offset silently.
export function localInstant(local: string, timezone: string): number {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw new DomainError('VALIDATION','Choose a valid local date and time');
 const center=Date.parse(local+'Z');
 if(!Number.isFinite(center))throw new DomainError('VALIDATION','Choose a valid local date and time');
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const matches:number[]=[];
 for(let t=center-18*60*60000;t<=center+18*60*60000;t+=60000){
  const p=Object.fromEntries(fmt.formatToParts(t).map(p=>[p.type,p.value]));
  if(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`===local)matches.push(t);
 }
 if(matches.length!==1)throw new DomainError('VALIDATION',matches.length?'This local time occurs twice; choose another time':'This local time does not exist; choose another time');
 return matches[0]!;
}
