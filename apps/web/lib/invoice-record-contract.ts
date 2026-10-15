import {z} from 'zod';
export const MAX_INVOICE_RECORD_BYTES=4096;
export const invoiceRecordState=z.object({revision:z.number().int().min(0).max(2147483647),dueDate:z.iso.date().regex(/^(?!0000-)/).nullable(),archived:z.boolean()}).strict();
export const invoiceRecordCommand=invoiceRecordState.extend({organization:z.uuid(),invoice:z.uuid(),revision:z.number().int().min(0).max(2147483646),reason:z.string().trim().min(2).max(500).regex(/^[^\u0000]*$/),key:z.string().min(16).max(128).regex(/^[^\u0000]*$/)}).strict();
export const invoiceRecordSaved=invoiceRecordState.extend({revision:z.number().int().positive().max(2147483647),reason:z.string().min(2).max(500)}).strict();
export type InvoiceRecordState=z.infer<typeof invoiceRecordState>;
