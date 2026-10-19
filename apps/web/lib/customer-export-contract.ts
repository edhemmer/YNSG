import {z} from 'zod';
import {customerDetail} from './customer-record-contract.ts';
export const customerExportScope='Customer CRM profile, addresses, contacts, linked request summaries and change history. Excludes uploaded document bytes, financial ledgers and third-party messages.';
export const customerExportQuery=z.object({organization:z.uuid(),customer:z.uuid()}).strict();
export const customerExport=customerDetail.omit({requestsMore:true,historyMore:true}).extend({
 format:z.literal('ynsg-customer-record-v1'),exportedAt:z.iso.datetime(),organization:z.uuid(),scope:z.literal(customerExportScope),
 requests:customerDetail.shape.requests.max(5020),history:customerDetail.shape.history.max(5020),
}).strict();
export function verifiedCustomerExport(raw:unknown,query:z.infer<typeof customerExportQuery>){
 const data=customerExport.parse(raw);
 if(data.organization!==query.organization||data.customer.id!==query.customer)throw Error('UNVERIFIED');
 for(const records of [data.contacts,data.properties,data.requests,data.history])if(new Set(records.map(r=>r.id)).size!==records.length)throw Error('UNVERIFIED');
 return data;
}
