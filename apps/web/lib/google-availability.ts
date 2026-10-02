import { googleRequest, busyTimes, GoogleFailure } from './google-core.ts';
import { localInstant } from '../../../packages/domain/timezone.ts';
type CalendarEvent={id:string;etag:string;status?:string;transparency?:string;start?:{dateTime?:string;date?:string;timeZone?:string};end?:{dateTime?:string;date?:string;timeZone?:string};extendedProperties?:{private?:Record<string,string>}};
export type OwnEvent={id:string;etag:string;organization:string;appointment:string;revision:number;start:string;end:string};
const time=(v:CalendarEvent['start'],timezone:string)=>v?.dateTime?Date.parse(v.dateTime):v?.date?localInstant(v.date+'T00:00',v.timeZone||timezone):NaN;
export async function reviewedBusy(token:string,calendar:string,start:string,end:string,timezone:string,own:OwnEvent|null,transport:typeof fetch=fetch){
 const free=await busyTimes(token,calendar,start,end,transport);
 if(!own)return free;
 let page:string|undefined,found=false,count=0;
 const all:{start:number;end:number;ignore:boolean}[]=[];
 do{
  const query=new URLSearchParams({timeMin:start,timeMax:end,timeZone:timezone,singleEvents:'true',showDeleted:'false',maxResults:'2500',showHiddenInvitations:'true'});
  if(page)query.set('pageToken',page);
  const response=await googleRequest<{items?:CalendarEvent[];nextPageToken?:string;timeZone?:string}>(token,'/calendar/v3/calendars/'+encodeURIComponent(calendar)+'/events?'+query,{},transport);
  if(!Array.isArray(response.items))throw new GoogleFailure('BUSY_DATA_UNAVAILABLE');
  count+=response.items.length;if(count>10000)throw new GoogleFailure('CALENDAR_REVIEW_LIMIT');
  for(const event of response.items){
   let ignore=false;
   if(event.id===own.id){
    const mapping=event.extendedProperties?.private;
    if(event.status==='cancelled'||event.etag!==own.etag||mapping?.ynsgOrganization!==own.organization||mapping?.ynsgAppointment!==own.appointment||mapping?.ynsgRevision!==String(own.revision)||Date.parse(event.start?.dateTime||'')!==Date.parse(own.start)||Date.parse(event.end?.dateTime||'')!==Date.parse(own.end))throw new GoogleFailure('GOOGLE_EVENT_CHANGED');
    ignore=true;found=true;
   }
   if(event.status==='cancelled'||event.transparency==='transparent')continue;
   const a=time(event.start,response.timeZone||timezone),b=time(event.end,response.timeZone||timezone);
   if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)throw new GoogleFailure('INVALID_BUSY_DATA');
   all.push({start:a,end:b,ignore});
  }
  page=response.nextPageToken;
 }while(page);
 if(!found)throw new GoogleFailure('GOOGLE_EVENT_CHANGED');
 // The event list must explain every free/busy interval before exempting only our exact mapped event.
 const sorted=[...all].sort((a,b)=>a.start-b.start);
 for(const interval of free.busy){
  let covered=Date.parse(interval.start);const finish=Date.parse(interval.end);
  for(const i of sorted){if(i.start<=covered&&i.end>covered)covered=i.end;if(covered>=finish)break;}
  if(covered<finish)throw new GoogleFailure('BUSY_DATA_MISMATCH');
 }
 return {...free,busy:all.filter(i=>!i.ignore).map(i=>({start:new Date(i.start).toISOString(),end:new Date(i.end).toISOString()})),checkedAt:new Date().toISOString()};
}
