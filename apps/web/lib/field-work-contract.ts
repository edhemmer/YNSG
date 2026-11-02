import {z} from 'zod';
const id=z.uuid(),stamp=z.iso.datetime({offset:true}),cents=z.number().int().min(0).max(999999999),status=z.enum(['approved','scheduled','en_route','arrived','working','paused','completed']);
export const fieldWorkQuery=z.object({organization:id,job:id.optional()}).strict();
export const fieldInvoice=z.object({id,number:z.number().int().positive(),totalCents:cents,paidCents:cents,creditedCents:cents,balanceCents:cents,issuedAt:stamp,lines:z.array(z.object({description:z.string().max(1000),recordedMinutes:z.number().int().min(0).max(1440),chargedCents:cents,unitRateCents:cents.optional(),billingMinutes:z.number().int().min(0).max(1440).optional(),crewPerson:z.number().int().min(1).max(6).optional(),waiverReason:z.string().max(1000),billingBasis:z.enum(['fixed','hourly']).optional()}).strict()).max(50)}).strict().refine(v=>v.totalCents===v.paidCents+v.creditedCents+v.balanceCents);
export const fieldJob=z.object({id,revision:z.number().int().positive(),status,customer:z.string().min(1).max(254),start:stamp.nullable(),end:stamp.nullable(),arrival:stamp.nullable(),invoice:fieldInvoice.nullable()}).strict();
const common={organization:id,actor:id,timezone:z.string().max(100),checkedAt:stamp};
export const fieldWorkList=z.object({...common,items:z.array(fieldJob).max(100)}).strict();
export const fieldWorkDetail=z.object({...common,job:fieldJob,scope:z.string().max(5000),address:z.string().max(1000),notes:z.array(z.object({id,body:z.string().min(2).max(3000),at:stamp,actor:id}).strict()).max(100)}).strict();
const base={organization:id,key:id};
export const fieldWorkCommand=z.discriminatedUnion('action',[
 z.object({...base,action:z.literal('timer'),job:id,revision:z.number().int().positive(),operation:z.enum(['start','pause','resume'])}).strict(),
 z.object({...base,action:z.literal('note'),job:id,body:z.string().trim().min(2).max(3000).regex(/^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f]*$/)}).strict(),
 z.object({...base,action:z.literal('payment'),invoice:id,cents:cents.positive(),method:z.enum(['cash','zelle']),reference:z.string().trim().min(1).max(300),receivedAt:stamp,confirmed:z.literal(true)}).strict()
]);
export const fieldWorkRecovery=z.object({...base,action:z.literal('resolve'),operation:z.enum(['timer','note','payment']),target:id,fingerprint:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const result=z.union([z.object({id,revision:z.number().int().positive(),status:z.enum(['working','paused'])}).strict(),z.object({id,job:id}).strict(),z.object({id,balanceCents:cents}).strict()]);
export const fieldWorkReceipt=z.object({...base,target:id,action:z.enum(['timer','note','payment']),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),outcome:z.enum(['saved','not_applied']),result:result.nullable()}).strict().refine(v=>v.outcome==='not_applied'?v.result===null:!!v.result&&(v.action==='timer'?'revision'in v.result:v.action==='note'?'job'in v.result:'balanceCents'in v.result));
