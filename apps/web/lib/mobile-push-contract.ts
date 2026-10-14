import {z} from 'zod';
export const mobileDeviceSchema=z.object({organization:z.uuid(),device:z.uuid(),revision:z.number().int().min(0),token:z.string().regex(/^[a-fA-F0-9]{64,256}$/),environment:z.enum(['sandbox','production']),newRequests:z.boolean(),appointments:z.boolean(),sound:z.boolean(),quietStart:z.number().int().min(0).max(1439),quietEnd:z.number().int().min(0).max(1439),reviewed:z.literal(true),key:z.string().min(16).max(128)}).strict();
export const disableMobileDeviceSchema=z.object({organization:z.uuid(),device:z.uuid(),revision:z.number().int().positive()}).strict();
export function genericPushPayload(kind:'new_request'|'appointment',organization:string,object:string,sound=false){
 const alert=kind==='new_request'?{title:'New service request',body:'Open Requests to review it.'}:{title:'Your next appointment',body:'An appointment is coming up. Open Calendar for the confirmed time.'};
 return {aps:{alert,...(sound?{sound:'default'}:{})},ynsg:{version:1,kind,organization,object}};
}
