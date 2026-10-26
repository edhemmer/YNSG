import {invoiceCredit,creditTotal,verifiedCreditHistory} from './invoice-credit-contract.ts';
import {z} from 'zod';
const id=z.uuid(),text=z.string(),instant=z.iso.datetime({offset:true});
const timezone=z.string().refine(value=>{try{new Intl.DateTimeFormat("en-US",{timeZone:value});return true;}catch{return false;}});
const record=z.object({id,status:text,created_at:instant.optional()}).strict();
const payment=z.object({cents:z.number().int().min(-999999999).max(999999999)}).strict();
export const portalAccess=z.object({
 email:z.email(),
 access:z.array(z.object({organization_id:id,customer_id:id,can_view_billing:z.boolean(),can_approve:z.boolean()}).strict()).max(1000),
 companies:z.array(z.object({id,display_name:text,timezone}).strict()).max(1000)
}).strict().superRefine((v,ctx)=>{
 if(new Set(v.companies.map(c=>c.id)).size!==v.companies.length||new Set(v.access.map(a=>a.organization_id+':'+a.customer_id)).size!==v.access.length||v.access.some(a=>!v.companies.some(c=>c.id===a.organization_id)))ctx.addIssue({code:'custom',message:'Unverified account relationships'});
});
export const portalPage=z.object({
 organization:id,
 company:z.object({id,display_name:text,timezone}).strict(),
 customers:z.array(z.object({id,display_name:text}).strict()).max(1000),
 properties:z.array(z.object({id,street:text,city:text,region:text,postal_code:text.nullable()}).strict()).max(1000),
 requests:z.array(record.extend({services:z.array(z.object({service:z.string().max(80),task:z.string().max(120)}).strict()).max(15).nullable().optional()})).max(20),jobs:z.array(record).max(20),
 invoices:z.array(z.object({id,number:z.union([text,z.number().int().safe()]),total_cents:z.number().int().min(0).max(999999999),issued_at:instant,credits:z.array(invoiceCredit).max(10000),payments:z.array(payment).max(10000)}).strict()).max(20),
 appointments:z.array(z.object({id,start_at:instant,end_at:instant,arrival_at:instant.nullable(),status:text,timezone,customer_response:text.nullable()}).strict()).max(20),
 page:z.number().int().min(0).max(10000),hasMore:z.boolean()
}).strict().superRefine((v,ctx)=>{
 if(v.company.id!==v.organization)ctx.addIssue({code:'custom',message:'Company mismatch'});
 for(const rows of [v.customers,v.properties,v.requests,v.jobs,v.invoices,v.appointments])if(new Set(rows.map(r=>r.id)).size!==rows.length)ctx.addIssue({code:'custom',message:'Duplicate records'});
 for(const a of v.appointments)if(Date.parse(a.end_at)<=Date.parse(a.start_at)||(a.arrival_at!==null&&(Date.parse(a.arrival_at)<Date.parse(a.start_at)||Date.parse(a.arrival_at)>=Date.parse(a.end_at))))ctx.addIssue({code:"custom",message:"Unverified appointment window"});
 for(const invoice of v.invoices){try{verifiedCreditHistory(invoice.credits,invoice.id);}catch{ctx.addIssue({code:'custom',message:'Unverified credit history'});}const paid=invoice.payments.reduce((n,p)=>n+p.cents,0);if(!Number.isSafeInteger(paid)||paid<0||paid+creditTotal(invoice.credits)>invoice.total_cents||creditTotal(invoice.credits)<0||invoice.credits.some(c=>c.invoiceId!==invoice.id))ctx.addIssue({code:'custom',message:'Unverified payment amount'});}
});
export function verifiedPortalPage(raw:unknown,organization:string,page:number){const data=portalPage.parse(raw);if(data.organization!==organization||data.page!==page)throw Error('Account history did not match the selected business and page.');return data;}
