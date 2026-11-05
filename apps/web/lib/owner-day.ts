import {z} from 'zod';
import {localDate} from './day-plan.ts';
export const ownerDayQuery=z.object({organization:z.uuid()}).strict();
export const ownerDayCall=z.object({id:z.uuid(),requestId:z.uuid(),startAt:z.iso.datetime({offset:true}),arrivalAt:z.iso.datetime({offset:true}),endAt:z.iso.datetime({offset:true}),name:z.string(),address:z.string(),phone:z.string(),tasks:z.array(z.string())}).strict();
export const ownerDayResponse=z.object({checkedAt:z.iso.datetime(),timezone:z.string(),calls:z.array(ownerDayCall).max(12),hasMore:z.boolean()}).strict();
export type OwnerDay=z.infer<typeof ownerDayResponse>;
export function ownerDayLabel(call:OwnerDay['calls'][number],timezone:string,now=new Date()){
 return localDate(new Date(call.arrivalAt),timezone)===localDate(now,timezone)?'Today':'Upcoming';
}

/** Navigation and calling are explicit user actions; never send an empty or unsafe URI. */
export function ownerStopDirections(address:string):string|null{
 const value=address.trim();
 if(!value||value.length>500)return null;
 return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(value);
}
export function ownerStopCall(phone:string):string|null{
 const value=phone.trim();
 const digits=value.replace(/\D/g,'');
 if(digits.length<7||digits.length>15)return null;
 return 'tel:'+(value.startsWith('+')?'+':'')+digits;
}

/** Owner-confirmed public review links, keyed by organization. Only https links are ever used. */
const REVIEW_LINKS:Record<string,string>={'a933d657-14d3-46b6-85e6-21d973e4ed97':'https://g.page/r/CWxW2KabD1UWECE/review'};
export function ownerReviewUrl(organization:string):string|null{const url=REVIEW_LINKS[organization];return url&&url.startsWith('https://')?url:null}
/** One-tap review request from the owner's own phone; nothing is sent until the owner taps send. */
export function ownerReviewText(phone:string,name:string,url:string|null):string|null{
 const call=ownerStopCall(phone);
 if(!call||!url||!url.startsWith('https://'))return null;
 const first=name.trim().split(/\s+/)[0]||'there';
 const body='Hi '+first+', thanks again for having Your Neighborhood Service Guy out. If you were happy with the work, a quick Google review helps our small local business a lot: '+url+' Thank you!';
 return 'sms:'+call.slice(4)+'?&body='+encodeURIComponent(body);
}
/** Opens the owner's own messaging app with a pre-filled note; nothing is sent until the owner taps send. */
export function ownerStopText(phone:string,name:string):string|null{
 const call=ownerStopCall(phone);
 if(!call)return null;
 const first=name.trim().split(/\s+/)[0]||'there';
 const body="Hi "+first+", this is Your Neighborhood Service Guy. I'm on my way to your service visit now.";
 return 'sms:'+call.slice(4)+'?&body='+encodeURIComponent(body);
}
export function ownerInitials(name:string):string{
 return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(w=>(w[0]||'').toUpperCase()).join('')||'•';
}

/** Days since the customer last asked for service; null when unknown. */
export function daysSince(iso:string|null,now:Date=new Date()):number|null{if(!iso)return null;const t=new Date(iso).getTime();if(!Number.isFinite(t))return null;return Math.max(0,Math.floor((now.getTime()-t)/86400000))}
/** A past customer is due for a friendly nudge after 45 days without a request. */
export function rebookDue(lastRequestedAt:string|null,now:Date=new Date(),afterDays=45):boolean{const d=daysSince(lastRequestedAt,now);return d!==null&&d>=afterDays}
/** One-tap "ready for another visit?" text from the owner's own phone; nothing is sent until the owner taps send. */
export function ownerRebookText(phone:string,name:string):string|null{
 const call=ownerStopCall(phone);
 if(!call)return null;
 const first=name.trim().split(/\s+/)[0]||'there';
 const body='Hi '+first+', it\'s Your Neighborhood Service Guy. Want me to get you on the schedule for another visit? Just reply with what you need done and a few days that work.';
 return 'sms:'+call.slice(4)+'?&body='+encodeURIComponent(body);
}
