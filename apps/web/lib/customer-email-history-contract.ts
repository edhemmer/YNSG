import {z} from 'zod';
export const emailHistoryQuery=z.object({organization:z.uuid(),customer:z.uuid()}).strict();
const stamp=z.iso.datetime({offset:true});
export const emailHistory=z.object({items:z.array(z.object({channel:z.enum(['service','marketing']),kind:z.string().min(1).max(60),state:z.enum(['sent','queued','not_sent','not_delivered']),at:stamp,clickedAt:stamp.nullable()}).strict()).max(100),total:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),checkedAt:stamp}).strict();
export type EmailHistory=z.infer<typeof emailHistory>;
// Plain-language names for the service emails a customer can receive.
export const SERVICE_EMAIL_LABELS:Record<string,string>={
 'request.customer_receipt':'Request received','request.declined':'Request declined','quote.published':'Estimate sent',
 'appointment.confirmation':'Appointment confirmed','appointment.reminder':'Appointment reminder','appointment.canceled':'Appointment canceled',
 'appointment.declined_service':'Service declined','appointment.declined_time':'Requested time declined','appointment.reschedule_requested':'Reschedule request',
 'appointment.delay_notice':'Running-late notice','invoice.delivery':'Invoice sent','invoice.issued':'Invoice sent','invoice.paid':'Payment receipt',
 'recurring.confirmation':'Recurring visits confirmed','recurring.stopped':'Recurring visits stopped'};
