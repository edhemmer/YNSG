import {z} from 'zod';
import {requestService} from './index.ts';
export const repeatRequest=z.object({organization:z.uuid(),contact:z.uuid(),property:z.uuid(),key:z.string().min(16).max(128),input:z.object({services:z.array(requestService).min(1).max(15),description:z.string().trim().max(3000),preferredTime:z.string().trim().max(180),communityRate:z.enum(['Yes','No'])}).strict().superRefine((v,ctx)=>{
 if(new Set(v.services.map(s=>s.service+'::'+s.task)).size!==v.services.length)ctx.addIssue({code:'custom',message:'Choose each job once'});
 if(v.services.some(s=>s.service==='Something else')&&v.description.length<10)ctx.addIssue({code:'custom',message:'Describe the other work'});
})}).strict();
