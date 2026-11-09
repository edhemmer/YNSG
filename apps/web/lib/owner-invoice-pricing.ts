import {z} from 'zod';
import {hourlyCharge} from './invoice-billing.ts';

const amount=z.number().int().min(0).max(999999999);
export const ownerPricingService=z.object({
 description:z.string().trim().min(2).max(160),
 method:z.enum(['fixed','hourly']),
 standardCents:amount,
 billedCents:amount,
 minutes:z.number().int().min(1).max(1440).optional(),
 hourlyRateCents:amount.optional(),
}).strict().superRefine((s,ctx)=>{
 if(s.billedCents>s.standardCents)ctx.addIssue({code:'custom',message:'Billed price cannot exceed standard price.'});
 if(s.method==='hourly'){
  if(s.minutes===undefined||s.hourlyRateCents===undefined||hourlyCharge(s.minutes,s.hourlyRateCents)!==s.standardCents)ctx.addIssue({code:'custom',message:'Hourly standard charge must match the time and rate.'});
 }else if(s.minutes!==undefined||s.hourlyRateCents!==undefined)ctx.addIssue({code:'custom',message:'Fixed charges cannot contain hourly calculation fields.'});
});
export const ownerPricingSchema=z.object({
 services:z.array(ownerPricingService).min(1).max(25),
 reason:z.string().max(500),
}).strict().superRefine((v,ctx)=>{
 const standard=v.services.reduce((s,l)=>s+l.standardCents,0);
 const billed=v.services.reduce((s,l)=>s+l.billedCents,0);
 if(standard>999999999||billed>999999999)ctx.addIssue({code:'custom',message:'Amount exceeds the invoice limit.'});
 if(standard>billed&&v.reason.trim().length<2)ctx.addIssue({code:'custom',message:'Record a private reason for the reduced charge.'});
});
export type OwnerPricing=z.infer<typeof ownerPricingSchema>;
export function pricingTotals(value:OwnerPricing){
 const standardCents=value.services.reduce((sum,item)=>sum+item.standardCents,0);
 const billedCents=value.services.reduce((sum,item)=>sum+item.billedCents,0);
 return {standardCents,billedCents,reductionCents:standardCents-billedCents};
}
export function allocateActualCents(standardCents:number[],totalCents:number){
 if(!standardCents.length||standardCents.some(n=>!Number.isSafeInteger(n)||n<0)||!Number.isSafeInteger(totalCents)||totalCents<0)return null;
 const total=standardCents.reduce((a,b)=>a+b,0);
 if(totalCents>total||total===0)return null;
 const denominator=BigInt(total);
 const pieces=standardCents.map((n,i)=>({i,base:Number(BigInt(n)*BigInt(totalCents)/denominator),remainder:BigInt(n)*BigInt(totalCents)%denominator}));
 let leftover=totalCents-pieces.reduce((sum,p)=>sum+p.base,0);
 for(const p of [...pieces].sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1)){if(leftover<=0)break;p.base+=1;leftover--;}
 return pieces.map(p=>p.base);
}
