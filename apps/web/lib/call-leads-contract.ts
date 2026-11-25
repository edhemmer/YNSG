import {z} from 'zod';
import {leadSourceOptions} from '../../../packages/contracts/index.ts';
// Call list: website "call me back" requests plus phone calls the owner logs by hand.
const text=(min:number,max:number)=>z.string().trim().min(min).max(max).regex(/^[^\u0000-\u001f\u007f<>]+$/,'Remove special characters.');
export const CALL_STATUSES=['open','called','booked','closed'] as const;
export const callLead=z.object({id:z.uuid(),origin:z.enum(['website','phone']),name:z.string(),phone:z.string(),need:z.string(),leadSource:z.string().nullable(),referredBy:z.string().nullable(),
 status:z.enum(CALL_STATUSES),followUpOn:z.string().nullable(),note:z.string().nullable(),createdAt:z.string(),updatedAt:z.string()});
export type CallLead=z.infer<typeof callLead>;
export const callLeadList=z.object({items:z.array(callLead),counts:z.object({open:z.number().int(),called:z.number().int(),due:z.number().int(),booked30:z.number().int()})});
export type CallLeadList=z.infer<typeof callLeadList>;
const date=z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,'Choose a valid date.');
export const callLeadCommand=z.object({
 organization:z.uuid(),
 id:z.uuid().nullable(),
 name:text(2,120).optional(),phone:text(7,35).optional(),need:text(3,500).optional(),
 leadSource:z.union([z.enum(leadSourceOptions),z.literal('')]).optional(),
 referredBy:z.union([text(2,120),z.literal('')]).optional(),
 status:z.enum(CALL_STATUSES).optional(),
 followUpOn:date.nullable().optional(),
 note:z.union([text(1,1000),z.literal('')]).optional(),
}).strict().superRefine((v,ctx)=>{if(v.id===null&&(!v.name||!v.phone||!v.need))ctx.addIssue({code:'custom',message:'Add a name, phone number and what they need.',path:['name']});});
export const callLeadSaved=z.object({saved:z.literal(true),lead:callLead});
export const siteCounts=z.object({days:z.number().int(),since:z.string(),totals:z.record(z.string(),z.number().int()),
 sources:z.array(z.object({source:z.string(),views:z.number().int().nullable(),actions:z.number().int().nullable()})),
 pages:z.array(z.object({page:z.string(),views:z.number().int().nullable(),actions:z.number().int().nullable()})),
 daily:z.array(z.object({day:z.string(),views:z.number().int().nullable(),actions:z.number().int().nullable()}))});
export type SiteCounts=z.infer<typeof siteCounts>;
// Missing RPC (database update not applied yet) reads as "not set up", never as a failure.
export const notInstalled=(message:string)=>/could not find the function|PGRST202|does not exist/i.test(message);
// Days since a lead came in, for the "waiting" label.
export function daysWaiting(createdAt:string,now=Date.now()){const t=Date.parse(createdAt);return Number.isFinite(t)?Math.max(0,Math.floor((now-t)/86400000)):0;}
