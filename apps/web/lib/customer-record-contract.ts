import {z} from 'zod';
export const usStates=['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'] as const;
const line=(max:number)=>z.string().trim().max(max).regex(/^[^\x00-\x1f\x7f<>]*$/);
export const customerValue=z.object({displayName:line(160).min(2)}).strict();
export const contactValue=z.object({name:line(160).min(2),email:z.union([z.email().max(254),z.literal('')]),phone:line(35).refine(v=>!v||(/^[+\d() .x#-]{7,35}$/i.test(v)&&v.replace(/\D/g,'').length>=7),'Use a valid phone number.'),relationship:line(80).min(2)}).strict().refine(v=>Boolean(v.email||v.phone),'Add a phone number or email.');
export const propertyValue=z.object({street:line(200).min(5),city:line(80).min(2),state:z.enum(usStates),postalCode:z.union([z.string().regex(/^\d{5}(?:-\d{4})?$/),z.literal('')])}).strict();
export const ownerAddressCheck=propertyValue.extend({organization:z.uuid()}).strict();
export const addressCheckResult=z.object({status:z.enum(['match','multiple','no_match','unavailable']),candidates:z.array(propertyValue).max(3),unitChecked:z.literal(false)}).strict();
const base={organization:z.uuid(),key:z.uuid(),reason:line(500)},existing={customer:z.uuid(),revision:z.number().int().positive().max(2147483647)};
export const customerCommand=z.discriminatedUnion('action',[
 z.object({...base,action:z.literal('create_customer'),value:customerValue}).strict(),
 z.object({...base,...existing,action:z.literal('update_customer'),value:customerValue}).strict(),
 z.object({...base,...existing,action:z.literal('save_contact'),record:z.uuid().nullable(),recordRevision:z.number().int().positive().max(2147483647).nullable(),value:contactValue}).strict(),
 z.object({...base,...existing,action:z.literal('save_property'),record:z.uuid().nullable(),recordRevision:z.number().int().positive().max(2147483647).nullable(),value:propertyValue}).strict(),
 z.object({...base,...existing,action:z.literal('set_archived'),archived:z.boolean()}).strict()
]).refine(v=>!('record' in v)||(v.record===null)===(v.recordRevision===null),'Record and revision must be supplied together.');
export const customerQuery=z.object({organization:z.uuid(),customer:z.uuid().optional(),query:line(100).default(''),filter:z.enum(['active','archived','all']).default('active'),page:z.coerce.number().int().min(0).max(10000).default(0),requestsPage:z.coerce.number().int().min(0).max(10000).default(0),historyPage:z.coerce.number().int().min(0).max(10000).default(0)}).strict();
const customer=z.object({id:z.uuid(),displayName:z.string(),revision:z.number().int().positive().max(2147483647),archivedAt:z.string().nullable()}).strict();
export const customerList=z.object({items:z.array(customer.extend({contactCount:z.number().int().nonnegative(),addressCount:z.number().int().nonnegative()})).max(20),hasMore:z.boolean(),page:z.number().int().nonnegative()}).strict();
export const customerDetail=z.object({customer,contacts:z.array(z.object({id:z.uuid(),revision:z.number().int().positive().max(2147483647),name:z.string(),email:z.string().nullable(),phone:z.string().nullable(),relationship:z.string()}).strict()).max(100),properties:z.array(z.object({id:z.uuid(),revision:z.number().int().positive().max(2147483647),street:z.string(),city:z.string(),state:z.string(),postalCode:z.string().nullable()}).strict()).max(100),requests:z.array(z.object({id:z.uuid(),status:z.string(),createdAt:z.string(),summary:z.string(),address:z.string()}).strict()).max(20),requestsMore:z.boolean(),history:z.array(z.object({id:z.uuid(),kind:z.enum(['customer','contact','property']),at:z.string(),reason:z.string(),before:z.record(z.string(),z.json()).nullable(),after:z.record(z.string(),z.json())}).strict()).max(20),historyMore:z.boolean()}).strict();
export const customerSaved=z.object({saved:z.literal(true),customerId:z.uuid(),revision:z.number().int().positive().max(2147483647),recordId:z.uuid(),recordRevision:z.number().int().positive().max(2147483647)}).strict();
export type CustomerDetail=z.infer<typeof customerDetail>;
export type CustomerList=z.infer<typeof customerList>;
export type CustomerCommand=z.infer<typeof customerCommand>;
