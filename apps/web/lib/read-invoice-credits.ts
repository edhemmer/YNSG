import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {invoiceCreditContext,verifiedCreditContext} from './invoice-credit-contract.ts';
export async function readInvoiceCredits(db:SupabaseClient,organization:string,ids:string[]){
 z.uuid().parse(organization);z.array(z.uuid()).max(1000).parse(ids);if(new Set(ids).size!==ids.length)throw Error('UNVERIFIED_CREDIT');
 if(!ids.length)return new Map<string,ReturnType<typeof verifiedCreditContext>>();
 const r=await db.rpc('invoice_credit_contexts',{p_org:organization,p_invoices:ids});if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':'UNAVAILABLE');
 const rows=z.array(invoiceCreditContext).max(1000).parse(r.data);if(rows.reduce((n,c)=>n+c.credits.length,0)>10000||rows.length!==ids.length||new Set(rows.map(c=>c.invoiceId)).size!==ids.length||rows.some(c=>!ids.includes(c.invoiceId)))throw Error('UNVERIFIED_CREDIT');
 return new Map(rows.map(c=>[c.invoiceId,verifiedCreditContext(c)]));
}
