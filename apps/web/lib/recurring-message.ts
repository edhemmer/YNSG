import {emailLayout,emailParagraph,emailSignedText} from '../../../lib/email-layout.js';
import {z} from 'zod';
const schema=z.object({status:z.enum(['active','stopped']),name:z.string().max(200),recipient:z.email(),timezone:z.string(),firstAt:z.iso.datetime({offset:true}),lastAt:z.iso.datetime({offset:true}),visits:z.number().int().min(2).max(53),scope:z.string().min(10).max(5000),laborCents:z.number().int().nonnegative(),reason:z.string().nullable(),visitsCanceled:z.number().int().nonnegative().nullable()});
export function recurringMessage(company:string,value:unknown,identity?:{logoUrl?:string|null;ownerName?:string|null}){
 const d=schema.parse(value),date=(v:string)=>new Intl.DateTimeFormat('en-US',{timeZone:d.timezone,dateStyle:'long',timeStyle:'short'}).format(new Date(v)),money=(d.laborCents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
 const title=d.status==='active'?'Your weekly visits are scheduled':'Your repeat visits have been stopped';
 const text=d.status==='active'?
  `Hi ${d.name},\n\nYour weekly schedule is confirmed: ${d.visits} visits, beginning ${date(d.firstAt)} and ending ${date(d.lastAt)}. Times use ${d.timezone} and follow the same local weekday and time through daylight-saving changes.\n\nAgreed work: ${d.scope}\nLabor estimate per visit: ${money}. Each visit has its own work record and invoice; this message does not charge you for the year. Materials and extra work need separate approval.\n\nWe’ll send a reminder before each visit. Contact us if a date needs changing. Any individually confirmed date change takes priority over this regular schedule.`:
  `Hi ${d.name},\n\n${d.visitsCanceled||0} remaining repeat visits have been canceled. ${d.reason||''}\n\nThis stops the repeats; it does not cancel your original visit or erase work already done or under way, invoices or payments. Any changes to those visits are confirmed separately. Contact us if you’d like to arrange another visit.`;
 return {to:d.recipient,subject:company+' — '+title.toLowerCase(),body:emailSignedText(text,identity),html:emailLayout(company,title,title,emailParagraph(text),identity)};
}
