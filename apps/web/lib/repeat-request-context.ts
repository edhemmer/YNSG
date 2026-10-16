import {repeatRequestContext} from '../../../packages/contracts/customer-intake.ts';
import type {z} from 'zod';

export type RepeatContext=z.infer<typeof repeatRequestContext>;

/** Treat private context as untrusted until parsed; never attach a contact
 * belonging to a different saved property/customer. */
export function parseRepeatContext(value:unknown):RepeatContext {
 const parsed=repeatRequestContext.safeParse(value);
 if(!parsed.success)throw Error('Saved customer details were incomplete. Refresh your account before sending another request.');
 const {contacts,properties,services}=parsed.data;
 if(new Set(properties.map(p=>p.id)).size!==properties.length||
    new Set(contacts.map(c=>c.id)).size!==contacts.length||
    new Set(services.map(s=>s.name)).size!==services.length)
  throw Error('Saved customer details were inconsistent. Refresh your account before requesting service.');
 return parsed.data;
}
export function contactForProperty(context:RepeatContext,propertyId:string,contactId:string){
 const property=context.properties.find(p=>p.id===propertyId);
 if(!property)return undefined;
 const allowed=context.contacts.filter(c=>c.customer_id===property.customer_id);
 return allowed.find(c=>c.id===contactId)||(contactId===''&&allowed.length===1?allowed[0]:undefined);
}
