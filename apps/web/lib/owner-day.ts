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
