import {readInvoiceCredits} from './read-invoice-credits.ts';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {verifiedPaymentContext} from './invoice-payment-context.ts';
const invoiceIdentity=z.object({id:z.uuid(),total_cents:z.number().int().min(0).max(999999999)}).passthrough();
const receipt=z.object({id:z.uuid(),organization_id:z.uuid(),invoice_id:z.uuid(),cents:z.number().int().min(-2147483647).max(2147483647),method:z.string(),reference:z.string(),received_at:z.iso.datetime({offset:true}),reverses_payment_id:z.uuid().nullable()}).strict();
/** Every returned invoice gets a complete, validated receipt set. Never trust an
 * embedded relation: PostgREST row ceilings can truncate it without an error.
 * This is a current read, not an as-of accounting snapshot across invoices. */
export async function completeInvoicePayments<T extends {id:string;total_cents:number}>(db:SupabaseClient,organization:string,invoices:T[]){
 z.uuid().parse(organization);
 const identities=z.array(invoiceIdentity).max(1000).parse(invoices);
 const allIds=new Set(identities.map(i=>i.id));if(allIds.size!==identities.length)throw Error('UNVERIFIED_INVOICE_PAYMENTS');
 const byInvoice=new Map<string,{cents:number}[]>();
 const seenReceipts=new Set<string>();
 let totalRows=0;
 for(let offset=0;offset<identities.length;offset+=100){
  const batch=identities.slice(offset,offset+100),ids=batch.map(i=>i.id);
  const result=await db.from('payments').select('id,organization_id,invoice_id,cents,method,reference,received_at,reverses_payment_id',{count:'exact'}).eq('organization_id',organization).in('invoice_id',ids).order('id').limit(10001);
  const rows=z.array(receipt).max(10000).parse(result.data);
  totalRows+=rows.length;
  if(result.error||result.count!==rows.length||totalRows>10000||new Set(rows.map(p=>p.id)).size!==rows.length||rows.some(p=>p.organization_id!==organization||!ids.includes(p.invoice_id)))throw Error('UNVERIFIED_INVOICE_PAYMENTS');
  for(const row of rows){if(seenReceipts.has(row.id))throw Error('UNVERIFIED_INVOICE_PAYMENTS');seenReceipts.add(row.id);}
  for(const i of batch){
   const payments=rows.filter(p=>p.invoice_id===i.id).map(p=>({id:p.id,cents:p.cents,method:p.method,reference:p.reference,receivedAt:p.received_at,reversesPayment:p.reverses_payment_id}));
   const verified=verifiedPaymentContext({admin:{revision:0,dueDate:null,archived:false},orders:[],payments,canManage:false,cardTransactions:[]});
   if(verified.payments.reduce((sum,p)=>sum+p.cents,0)>i.total_cents)throw Error('UNVERIFIED_INVOICE_PAYMENTS');
   byInvoice.set(i.id,verified.payments.map(p=>({cents:p.cents})));
  }
 }
 // Validate current RLS access after all batches, including a fully empty
 // receipt result. Losing access must not produce a false unpaid invoice.
 for(let offset=0;offset<identities.length;offset+=100){
  const batch=identities.slice(offset,offset+100),ids=batch.map(i=>i.id);
  const current=await db.from('invoices').select('id,total_cents',{count:'exact'}).eq('organization_id',organization).in('id',ids).limit(101);
  const rows=z.array(invoiceIdentity).max(100).parse(current.data);
  if(current.error||current.count!==rows.length||rows.length!==batch.length||new Set(rows.map(i=>i.id)).size!==rows.length||rows.some(i=>!batch.some(b=>b.id===i.id&&b.total_cents===i.total_cents)))throw Error('UNVERIFIED_INVOICE_PAYMENTS');
 }
 const creditContexts=await readInvoiceCredits(db,organization,identities.map(i=>i.id));
 return invoices.map(i=>{const c=creditContexts.get(i.id)!;if(c.totalCents!==i.total_cents||c.paidCents!==byInvoice.get(i.id)!.reduce((n,p)=>n+p.cents,0))throw Error('UNVERIFIED_CREDIT');return {...i,payments:byInvoice.get(i.id)!,credits:c.credits};});
}
