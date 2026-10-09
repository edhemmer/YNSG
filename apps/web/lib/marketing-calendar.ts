import {createHash} from 'node:crypto';
type Input={organization:string;key:string;title:string;draft:string;date:string;timezone:string};
export function marketingCalendarEvent(input:Input){
 const fingerprint=createHash('sha256').update(JSON.stringify([input.organization,input.title,input.draft,input.date,input.timezone])).digest('hex');
 const id=createHash('sha256').update('ynsg-marketing:'+input.organization+':'+input.key).digest('hex');
 return {id,summary:'Marketing: '+input.title,description:input.draft,start:{dateTime:input.date+'T09:00:00',timeZone:input.timezone},end:{dateTime:input.date+'T09:15:00',timeZone:input.timezone},transparency:'transparent',visibility:'private',reminders:{useDefault:false,overrides:[{method:'popup',minutes:0}]},extendedProperties:{private:{ynsgOrganization:input.organization,ynsgMarketingFingerprint:fingerprint,ynsgKind:'marketing-plan'}}};
}
export async function saveMarketingEvent(token:string,calendar:string,input:Input,send:typeof fetch=fetch){
 const event=marketingCalendarEvent(input),url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calendar)+'/events';
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const read=()=>send(url+'/'+event.id,{headers,cache:'no-store',signal:AbortSignal.timeout(8000)});
 const verify=(value:{id?:string;htmlLink?:string;extendedProperties?:{private?:Record<string,string>}})=>{
  if(value.id!==event.id||value.extendedProperties?.private?.ynsgMarketingFingerprint!==event.extendedProperties.private.ynsgMarketingFingerprint)throw Error('MARKETING_RETRY_CHANGED');
  const link=typeof value.htmlLink==='string'?new URL(value.htmlLink):null;
  const safe=link?.protocol==='https:'&&(link.hostname==='calendar.google.com'||link.hostname==='www.google.com'&&link.pathname.startsWith('/calendar/'));
  return {eventId:event.id,url:safe?link!.toString():null};
 };
 const prior=await read();if(prior.ok)return verify(await prior.json());if(prior.status!==404)throw Error('MARKETING_CALENDAR_UNAVAILABLE');
 const saved=await send(url+'?sendUpdates=none',{method:'POST',headers,body:JSON.stringify(event),signal:AbortSignal.timeout(8000)});
 if(saved.ok)return verify(await saved.json());
 if(saved.status===409){const existing=await read();if(existing.ok)return verify(await existing.json());}
 throw Error('MARKETING_CALENDAR_UNAVAILABLE');
}
