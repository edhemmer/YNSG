import {z} from 'zod';
import {postalCodesForCity} from '../../../site/city-postal-codes.js';
export const customerProfile=z.object({
 name:z.string().trim().min(2).max(120),phone:z.string().trim().min(7).max(35),
 street:z.string().trim().min(5).max(200),city:z.enum(['DeKalb','Sycamore','Cortland']),
 postalCode:z.string().regex(/^\d{5}$/)
}).strict().refine(p=>postalCodesForCity(p.city).includes(p.postalCode),'Choose the ZIP code for your city.');
export const customerProfileCommand=z.object({key:z.uuid(),profile:customerProfile}).strict();
export const customerProfileReceipt=z.object({organization:z.uuid(),customer:z.uuid(),contact:z.uuid(),property:z.uuid()}).strict();
