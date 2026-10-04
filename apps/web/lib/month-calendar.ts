import { localInstant, localMinute } from '../../../packages/domain/timezone.ts';
export function monthWindow(month: string, timezone: string) {
 if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0,4)) < 2000 || Number(month.slice(0,4)) > 2100) throw Error('Choose a valid month.');
 const next = shiftMonth(month, 1);
 return {start:new Date(localInstant(month+'-01T00:00',timezone)).toISOString(),end:new Date(localInstant(next+'-01T00:00',timezone)).toISOString()};
}
export function shiftMonth(month:string, offset:number) {
 const [year,number]=month.split('-').map(Number);
 const date=new Date(Date.UTC(year!,number!-1+offset,1));
 return date.toISOString().slice(0,7);
}
export function monthCells(month:string): (string|null)[] {
 const [year,number]=month.split('-').map(Number);
 const first=new Date(Date.UTC(year!,number!-1,1)),days=new Date(Date.UTC(year!,number!,0)).getUTCDate();
 const cells:(string|null)[]=Array.from({length:first.getUTCDay()},()=>null);
 for(let day=1;day<=days;day++)cells.push(month+'-'+String(day).padStart(2,'0'));
 while(cells.length%7)cells.push(null);
 return cells;
}
export function spansDay(start:string,end:string,day:string,timezone:string) {
 return day>=localMinute(Date.parse(start),timezone).slice(0,10) && day<=localMinute(Date.parse(end)-1,timezone).slice(0,10);
}
export function serviceTone(categories:string[]) {
 const tones=new Set(categories.map(c=>/lawn/i.test(c)?'lawn':/garden|yard/i.test(c)?'garden':/home/i.test(c)?'home':/snow/i.test(c)?'snow':/pressure|concrete/i.test(c)?'wash':'other'));
 return tones.size===1?[...tones][0]!:'other';
}

export function groupCalendarDays<T>(items:T[],days:(string|null)[],start:(item:T)=>string,end:(item:T)=>string,timezone:string):Record<string,T[]> {
 const result:Record<string,T[]>={};
 for(const day of days)if(day)result[day]=[];
 for(const item of items){
  const first=localMinute(Date.parse(start(item)),timezone).slice(0,10),last=localMinute(Date.parse(end(item))-1,timezone).slice(0,10);
  for(const day of days)if(day&&day>=first&&day<=last)result[day]!.push(item);
 }
 return result;
}

export function activeCalendarVisit(visit:{status:string;expires_at:string|null},now:number) {
 if(!['held','proposal','reserved','needs_review'].includes(visit.status))return false;
 return !['held','proposal'].includes(visit.status)||!visit.expires_at||Date.parse(visit.expires_at)>now;
}
