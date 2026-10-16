import {z} from 'zod';
import {requestService} from './index.ts';
export const repeatRequest=z.object({organization:z.uuid(),contact:z.uuid(),property:z.uuid(),key:z.string().min(16).max(128),input:z.object({services:z.array(requestService).min(1).max(15),description:z.string().trim().max(3000),preferredTime:z.string().trim().max(180),communityRate:z.enum(['Yes','No'])}).strict().superRefine((v,ctx)=>{
 if(new Set(v.services.map(s=>s.service+'::'+s.task)).size!==v.services.length)ctx.addIssue({code:'custom',message:'Choose each job once'});
 if(v.services.some(s=>s.service==='Something else'||s.task==='Describe below')&&v.description.length<10)ctx.addIssue({code:'custom',message:'Describe the other work'});
})}).strict();

// Only server-approved, currently accessible contacts/properties/catalog entries may be offered.
export const repeatRequestContext=z.object({
 contacts:z.array(z.object({id:z.uuid(),customer_id:z.uuid(),name:z.string(),email:z.string(),phone:z.string()}).strict()),
 properties:z.array(z.object({id:z.uuid(),customer_id:z.uuid(),street:z.string(),city:z.string(),region:z.string()}).strict()),
 services:z.array(z.object({name:z.string().min(2).max(80),scope:z.string()}).strict())
}).strict();
