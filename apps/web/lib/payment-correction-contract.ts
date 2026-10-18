import {z} from 'zod';
export const paymentCorrection=z.object({organizationId:z.uuid(),key:z.string().min(16).max(128),command:z.literal('ReverseRecordedPayment'),id:z.uuid(),paymentId:z.uuid(),reason:z.string().trim().min(10).max(300).regex(/^[^\u0000]*$/),reviewed:z.literal(true)}).strict();
export const paymentCorrectionSaved=z.object({id:z.uuid(),paymentId:z.uuid(),invoiceId:z.uuid(),reversed:z.literal(true),cents:z.number().int().negative(),balanceCents:z.number().int().nonnegative()}).strict();
export function verifyPaymentCorrection(value:unknown,input:z.infer<typeof paymentCorrection>){const r=paymentCorrectionSaved.parse(value);if(r.invoiceId!==input.id||r.paymentId!==input.paymentId)throw Error('UNVERIFIED');return r;}
