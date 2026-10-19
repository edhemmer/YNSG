import {z} from 'zod';
import {invoiceRecordState} from './invoice-record-contract.ts';
const cents=z.number().int().min(-2147483647).max(2147483647),positive=cents.positive();
const payment=z.object({id:z.uuid(),cents,method:z.enum(['cash','zelle','stripe','stripe_refund','cash_correction','zelle_correction']),receivedAt:z.iso.datetime({offset:true}),reference:z.string().min(1).max(300),reversesPayment:z.uuid().nullable().optional()}).strict();
const checkout=z.string().url().refine(s=>{try{return new URL(s).origin==='https://checkout.stripe.com'&&new URL(s).username===''&&new URL(s).password==='';}catch{return false;}});
const order=z.object({id:z.uuid(),cents:positive,status:z.enum(['prepared','open','paid','expired','failed']),url:checkout.nullable()}).strict().refine(o=>o.status==='open'||o.url===null);
const transaction=z.object({id:z.string().min(1).max(500),kind:z.enum(['payment','refund','alert']),amountCents:cents,feeCents:cents,netCents:cents,date:z.iso.datetime({offset:true}),details:z.object({status:z.string().max(200).optional(),eventType:z.string().max(200).optional()}).strip()}).strict();
export const invoicePaymentContext=z.object({admin:invoiceRecordState,orders:z.array(order).max(10000),payments:z.array(payment).max(10000),canManage:z.boolean(),cardTransactions:z.array(transaction).max(10000)}).strict();
export const invoicePaymentResponse=invoicePaymentContext.extend({organization:z.uuid(),invoice:z.uuid(),cardConfigured:z.boolean()}).strict();
export const invoicePaymentQuery=z.object({organization:z.uuid(),invoice:z.uuid()}).strict();
export type InvoicePaymentData=z.infer<typeof invoicePaymentResponse>;
export function verifiedPaymentContext(raw:unknown){
 const data=invoicePaymentContext.parse(raw),ids=new Set<string>(),originals=new Map(data.payments.map(p=>[p.id,p])),corrected=new Set<string>();let paid=0;
 for(const p of data.payments){if(ids.has(p.id))throw Error('UNVERIFIED');ids.add(p.id);paid+=p.cents;if(!Number.isSafeInteger(paid))throw Error('UNVERIFIED');
  if(['cash','zelle','stripe'].includes(p.method)){if(p.cents<=0||p.reversesPayment)throw Error('UNVERIFIED');}
  else if(p.method==='stripe_refund'){if(p.cents>=0||p.reversesPayment)throw Error('UNVERIFIED');}
  else{const original=p.reversesPayment&&originals.get(p.reversesPayment);if(!original||original.method!==p.method.replace('_correction','')||original.cents!==-p.cents||p.cents>=0||corrected.has(original.id))throw Error('UNVERIFIED');corrected.add(original.id);}
 }
 if(paid<0)throw Error('UNVERIFIED');
 for(const rows of [data.orders,data.cardTransactions]){const seen=new Set<string>();for(const r of rows){if(seen.has(r.id))throw Error('UNVERIFIED');seen.add(r.id);}}
 if(data.orders.filter(o=>['prepared','open'].includes(o.status)).length>1||!data.canManage&&data.cardTransactions.length)throw Error('UNVERIFIED');
 for(const t of data.cardTransactions)if(t.kind!=='alert'&&t.amountCents-t.feeCents!==t.netCents)throw Error('UNVERIFIED');
 return data;
}
export function verifiedInvoicePayments(raw:unknown,organization:string,invoice:string,totalCents:number){
 const response=invoicePaymentResponse.parse(raw);if(response.organization!==organization||response.invoice!==invoice||!Number.isSafeInteger(totalCents)||totalCents<0)throw Error('UNVERIFIED');
 const {organization:_org,invoice:_invoice,cardConfigured:_card,...context}=response;verifiedPaymentContext(context);
 const paid=response.payments.reduce((sum,p)=>sum+p.cents,0);if(paid>totalCents)throw Error('UNVERIFIED');return response;
}
