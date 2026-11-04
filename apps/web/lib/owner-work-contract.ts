import {z} from 'zod';
const text=(max:number)=>z.string().trim().max(max).regex(/^[^\x00-\x1f\x7f<>]*$/);
export const ownerRequestInput=z.object({name:text(160).min(2),phone:text(35),email:z.union([z.email().max(254),z.literal('')]),street:text(200).min(2),city:text(80).min(2),state:text(80).min(2),postalCode:text(30),serviceId:z.uuid(),description:z.string().trim().min(10).max(1000)}).strict();
export const createOwnerRequest=z.object({organizationId:z.uuid(),command:z.literal('CreateOwnerRequest'),key:z.string().min(16).max(128),input:ownerRequestInput}).strict();
export const recordOwnerWork=z.object({organizationId:z.uuid(),command:z.literal('RecordOwnerWork'),key:z.string().min(16).max(128),id:z.uuid(),revision:z.number().int().positive(),startAt:z.iso.datetime({offset:true}),endAt:z.iso.datetime({offset:true}),description:z.string().trim().min(10).max(1000),totalCents:z.number().int().min(0).max(999999999).nullable(),agreement:z.string().trim().min(10).max(2000).nullable()}).strict().superRefine((v,c)=>{
 const elapsed=Date.parse(v.endAt)-Date.parse(v.startAt);
 if(elapsed<60000||elapsed>86400000||elapsed%60000!==0)c.addIssue({code:'custom',path:['endAt'],message:'Record 1–1440 actual minutes.'});
 if(v.agreement!==null&&v.totalCents===null)c.addIssue({code:'custom',path:['totalCents'],message:'Enter the agreed labor charge.'});
});
