import {z} from 'zod';
const id=z.uuid(),stamp=z.iso.datetime({offset:true}),line=(max:number)=>z.string().trim().max(max).regex(/^[^\x00-\x1f\x7f<>]*$/),note=(max:number)=>z.string().trim().max(max).regex(/^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f]*$/);
const url=z.string().trim().max(2048).refine(v=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}},'Use a complete http or https website link.');
const phone=line(35).refine(v=>!v||(/^[+\d() .x#-]{7,35}$/i.test(v)&&v.replace(/\D/g,'').length>=7),'Use a phone number with at least seven digits.');
export const networkVetting=z.enum(['not_vetted','referred','known_work']);
export const networkProfile=z.object({name:line(160).min(2),businessName:line(160),title:line(100),phone,alternatePhone:phone,email:z.union([z.email().max(254),z.literal('')]),website:z.union([url,z.literal('')]),address:note(500),referralSource:line(160),notes:note(4000),social:z.array(z.object({label:line(40).min(2),url}).strict()).max(8),categories:z.array(line(60).min(2)).max(12).refine(a=>new Set(a.map(s=>s.toLowerCase().replace(/\s+/g,' '))).size===a.length,'Remove duplicate categories.'),vettingStatus:networkVetting,vettingBasis:note(1000)}).strict().superRefine((v,c)=>{if(v.vettingStatus==='known_work'&&v.vettingBasis.length<10)c.addIssue({code:'custom',path:['vettingBasis'],message:'Record the work you know firsthand.'});});
const base={organization:id,id,key:id,revision:z.number().int().min(0).max(2147483647)};
export const networkMutation=z.discriminatedUnion('action',[
 z.object({...base,action:z.literal('save'),profile:networkProfile,attestVetting:z.boolean()}).strict(),
 z.object({...base,revision:z.number().int().positive(),action:z.literal('archive')}).strict(),
 z.object({...base,revision:z.number().int().positive(),action:z.literal('restore')}).strict()
]);
export const networkResolve=z.object({organization:id,id,key:id,action:z.literal('resolve'),operation:z.enum(['save','archive','restore']),revision:z.number().int().min(0),fingerprint:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const networkQuery=z.object({organization:id,id:id.optional(),query:line(100).default(''),category:z.union([id,z.literal('uncategorized')]).optional(),vetting:z.union([networkVetting,z.literal('all')]).default('all'),status:z.enum(['active','archived','all']).default('active'),page:z.coerce.number().int().min(0).max(10000).default(0)}).strict();
export const networkReceipt=z.object({organization:id,id,key:id,fingerprint:z.string().regex(/^[a-f0-9]{64}$/),operation:z.enum(['save','archive','restore']),outcome:z.enum(['saved','not_applied']),revision:z.number().int().positive().nullable()}).strict().refine(v=>v.outcome==='saved'?v.revision!==null:v.revision===null);
export const networkContact=networkProfile.safeExtend({id,revision:z.number().int().positive(),vettedAt:stamp.nullable(),vettedBy:id.nullable(),updatedAt:stamp,archivedAt:stamp.nullable(),cardCount:z.number().int().min(0).max(12)}).strict();
export const networkCard=z.object({id,name:line(180).min(1),mime:z.enum(['image/jpeg','image/png']),bytes:z.number().int().min(8).max(4194304),status:z.enum(['pending','ready']),archivedAt:stamp.nullable(),createdAt:stamp}).strict();
const readBase={organization:id,actor:id,canVet:z.boolean(),checkedAt:stamp};
export const networkRead=z.discriminatedUnion('view',[
 z.object({...readBase,view:z.literal('list'),items:z.array(networkContact).max(20),categories:z.array(z.object({id,name:line(60).min(2),count:z.number().int().nonnegative()}).strict()).max(500),categoriesMore:z.boolean(),matching:z.number().int().nonnegative(),page:z.number().int().nonnegative(),hasMore:z.boolean()}).strict(),
 z.object({...readBase,view:z.literal('contact'),contact:networkContact,cards:z.array(networkCard).max(12)}).strict()
]);
export const networkCardUpload=z.object({organization:id,contact:id,key:id}).strict();
export const networkCardQuery=z.object({organization:id,file:id}).strict();
export const networkCardArchive=z.object({organization:id,contact:id,file:id,archived:z.boolean(),key:id}).strict();
export const networkCardTicket=z.object({organization:id,contact:id,id,path:z.string(),ready:z.boolean()}).strict();
export const networkCardReady=z.object({organization:id,contact:id,id,ready:z.literal(true)}).strict();
export type NetworkProfile=z.infer<typeof networkProfile>;
export type NetworkContact=z.infer<typeof networkContact>;
export type NetworkRead=z.infer<typeof networkRead>;
export type NetworkMutation=z.infer<typeof networkMutation>;
