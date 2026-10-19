import {z} from 'zod';
const amount=z.number().int().min(0).max(999999999),signed=z.number().int().min(-999999999).max(999999999),reason=z.string().trim().min(10).max(300).regex(/^[^\u0000]*$/);
export const creditTaxComponent=z.object({kind:z.string().min(1).max(80),label:z.string().min(1).max(500),ratePpm:z.number().int().min(0).max(250000),taxCents:signed}).strict();
export const invoiceCredit=z.object({id:z.uuid(),invoiceId:z.uuid(),subtotalCents:signed,totalCents:signed,taxComponents:z.array(creditTaxComponent).max(8),reason,issuedAt:z.iso.datetime({offset:true}),reversesId:z.uuid().nullable()}).strict().superRefine((c,ctx)=>{if(c.totalCents===0||c.totalCents!==c.subtotalCents+c.taxComponents.reduce((n,t)=>n+t.taxCents,0)||(c.reversesId?(c.totalCents>=0||c.subtotalCents>0||c.taxComponents.some(t=>t.taxCents>0)):(c.totalCents<=0||c.subtotalCents<0||c.taxComponents.some(t=>t.taxCents<0))))ctx.addIssue({code:'custom',message:'Invalid retained credit arithmetic'});});
export type InvoiceCredit=z.infer<typeof invoiceCredit>;
export function verifiedCreditHistory(raw:unknown,invoiceId:string){
 const rows=z.array(invoiceCredit).max(10000).parse(raw),byId=new Map(rows.map(c=>[c.id,c])),corrected=new Set<string>();
 if(byId.size!==rows.length||rows.some(c=>c.invoiceId!==invoiceId))throw Error('UNVERIFIED_CREDIT');
 for(const c of rows){if(c.reversesId){const original=byId.get(c.reversesId);if(!original||original.reversesId||corrected.has(original.id)||c.totalCents!==-original.totalCents||c.subtotalCents!==-original.subtotalCents||c.taxComponents.length!==original.taxComponents.length||c.taxComponents.some((t,i)=>t.taxCents!==-original.taxComponents[i]!.taxCents||t.label!==original.taxComponents[i]!.label||t.kind!==original.taxComponents[i]!.kind||t.ratePpm!==original.taxComponents[i]!.ratePpm))throw Error('UNVERIFIED_CREDIT');corrected.add(original.id);}}
 return rows;
}
export const invoiceCreditContext=z.object({invoiceId:z.uuid(),totalCents:amount,subtotalCents:amount,taxComponents:z.array(creditTaxComponent.extend({taxCents:amount})).max(8),paidCents:amount,revision:z.number().int().min(0).max(10000),canIssue:z.boolean(),credits:z.array(invoiceCredit).max(10000)}).strict();
export function verifiedCreditContext(raw:unknown){
 const d=invoiceCreditContext.parse(raw);verifiedCreditHistory(d.credits,d.invoiceId);const ids=new Set<string>(),reversed=new Set<string>(),byId=new Map(d.credits.map(c=>[c.id,c]));
 let total=0,subtotal=0;const tax=d.taxComponents.map(()=>0);
 if(d.revision!==d.credits.length||d.subtotalCents+d.taxComponents.reduce((n,c)=>n+c.taxCents,0)!==d.totalCents)throw Error('UNVERIFIED_CREDIT');
 for(const c of d.credits){
  if(ids.has(c.id)||c.invoiceId!==d.invoiceId||c.taxComponents.length!==tax.length||c.totalCents!==c.subtotalCents+c.taxComponents.reduce((n,t)=>n+t.taxCents,0)||c.totalCents===0)throw Error('UNVERIFIED_CREDIT');ids.add(c.id);
  if(c.taxComponents.some((t,i)=>t.kind!==d.taxComponents[i]!.kind||t.label!==d.taxComponents[i]!.label||t.ratePpm!==d.taxComponents[i]!.ratePpm))throw Error('UNVERIFIED_CREDIT');
  if(c.reversesId){const original=byId.get(c.reversesId);if(!original||original.reversesId||reversed.has(original.id)||c.totalCents!==-original.totalCents||c.subtotalCents!==-original.subtotalCents||c.taxComponents.some((t,i)=>t.taxCents!==-original.taxComponents[i]!.taxCents))throw Error('UNVERIFIED_CREDIT');reversed.add(original.id);}
  else if(c.totalCents<=0||c.subtotalCents<0||c.taxComponents.some(t=>t.taxCents<0))throw Error('UNVERIFIED_CREDIT');
  total+=c.totalCents;subtotal+=c.subtotalCents;c.taxComponents.forEach((t,i)=>tax[i]!+=t.taxCents);
 }
 if(!Number.isSafeInteger(total)||subtotal<0||subtotal>d.subtotalCents||tax.some((n,i)=>n<0||n>d.taxComponents[i]!.taxCents)||total+d.paidCents>d.totalCents)throw Error('UNVERIFIED_CREDIT');
 return d;
}
const base={organization:z.uuid(),invoice:z.uuid(),revision:z.number().int().min(0).max(9999),key:z.uuid(),reason,reviewed:z.literal(true)};
export const invoiceCreditCommand=z.discriminatedUnion('action',[
 z.object({...base,action:z.literal('issue'),subtotalCents:amount,taxCents:z.array(amount).max(8)}).strict().refine(v=>v.subtotalCents+v.taxCents.reduce((n,c)=>n+c,0)>0),
 z.object({...base,action:z.literal('reverse'),credit:z.uuid()}).strict()
]);
export const invoiceCreditSaved=z.object({revision:z.number().int().positive().max(10000),credit:invoiceCredit}).strict();
export function verifyCreditSaved(raw:unknown,c:z.infer<typeof invoiceCreditCommand>){const r=invoiceCreditSaved.parse(raw);if(r.revision!==c.revision+1||r.credit.invoiceId!==c.invoice||r.credit.reason!==c.reason||(c.action==='issue'&&(r.credit.reversesId!==null||r.credit.subtotalCents!==c.subtotalCents||r.credit.taxComponents.length!==c.taxCents.length||r.credit.taxComponents.some((t,i)=>t.taxCents!==c.taxCents[i])||r.credit.totalCents!==c.subtotalCents+c.taxCents.reduce((n,v)=>n+v,0)))||(c.action==='reverse'&&(r.credit.reversesId!==c.credit||r.credit.totalCents>=0)))throw Error('UNVERIFIED_CREDIT');return r;}
export const creditTotal=(credits:InvoiceCredit[]|undefined)=>credits?.reduce((n,c)=>n+c.totalCents,0)||0;
export function creditAmount(text:string){if(!/^(0|[1-9]\d{0,6})(\.\d{1,2})?$/.test(text))throw Error('Use a nonnegative USD amount with at most two decimal places.');const [whole,fraction='']=text.split('.');const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));return amount.parse(n);}
