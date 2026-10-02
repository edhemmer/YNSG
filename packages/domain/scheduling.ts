import {DomainError,type CompanySettings} from '../contracts/index.ts';
export type Interval={start:number;end:number};
export type TravelFact={minutes:number;validUntil:number};
export type FeasibilityInput={start:number;durationMinutes:number;clock:number;timezone:string;rules:Pick<CompanySettings['scheduling'],'weekdays'|'earliestStart'|'latestStart'|'endOfDay'|'bufferMinutes'> & Partial<Pick<CompanySettings['scheduling'],'leadMinutes'|'horizonMinutes'>>;busy:readonly Interval[];previous?:Interval;next?:Interval;fromPrevious?:TravelFact;toNext?:TravelFact;externalBusyVerifiedUntil:number};
const weekdays:Record<string,number>={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
export function feasible(input:FeasibilityInput):{start:number;end:number} {
  const {start,durationMinutes,clock,timezone,rules}=input;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(clock)||!Number.isSafeInteger(durationMinutes)||durationMinutes<120||durationMinutes%30!==0)throw new DomainError('VALIDATION','Reserve at least two hours in half-hour blocks');
  if(rules.bufferMinutes===null||input.externalBusyVerifiedUntil<clock)throw new DomainError('SETUP_REQUIRED','Current calendar facts and travel buffer are required');
  if(start<=clock)throw new DomainError('VALIDATION','Appointment must be in the future');
  if((rules.leadMinutes!==undefined&&start<clock+rules.leadMinutes*60000)||(rules.horizonMinutes!==undefined&&start>clock+rules.horizonMinutes*60000))throw new DomainError('CAPACITY_CONFLICT','Outside configured booking window');
  const end=start+durationMinutes*60_000;
  const fmt=new Intl.DateTimeFormat('en-US',{timeZone:timezone,weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const local=(ts:number)=>Object.fromEntries(fmt.formatToParts(ts).map(p=>[p.type,p.value]));
  const a=local(start),b=local(end);const minute=Number(a.hour)*60+Number(a.minute),finish=Number(b.hour)*60+Number(b.minute);
  if(!rules.weekdays.includes(weekdays[a.weekday!]!)||minute<rules.earliestStart||minute>rules.latestStart||minute%30!==0||a.second!=='00'||start%1000!==0||finish>rules.endOfDay||a.day!==b.day||a.month!==b.month||a.year!==b.year)throw new DomainError('CAPACITY_CONFLICT','Outside configured appointment hours');
  if(input.busy.some(v=>v.start<end&&v.end>start))throw new DomainError('CAPACITY_CONFLICT','Time is already reserved or busy');
  const travel=(fact:TravelFact|undefined)=>{if(!fact||fact.validUntil<clock||!Number.isSafeInteger(fact.minutes)||fact.minutes<0)throw new DomainError('PROVIDER_UNAVAILABLE','Verified travel is unavailable');return (fact.minutes+rules.bufferMinutes!)*60_000;};
  if(input.previous&&input.previous.end+travel(input.fromPrevious)>start)throw new DomainError('CAPACITY_CONFLICT','Insufficient travel time from previous appointment');
  if(input.next&&end+travel(input.toNext)>input.next.start)throw new DomainError('CAPACITY_CONFLICT','Insufficient travel time to next appointment');
  return {start,end};
}
