import { z } from 'zod';
export const schedulingReview = z.object({
 organizationId:z.uuid(),requestId:z.uuid(),requestRevision:z.number().int().positive(),
 configurationVersion:z.number().int().positive(),scheduleRevision:z.number().int().nonnegative(),
 replacesId:z.uuid().nullable().default(null),
 confirmImmediately:z.boolean().default(false),
 appointmentId:z.uuid().nullable(),appointmentRevision:z.number().int().positive().nullable(),
 localStart:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),durationMinutes:z.number().int().min(120).max(1440).multipleOf(30),
 arrivalOffsetMinutes:z.number().int().min(0).max(1439),resources:z.array(z.uuid()).min(1).max(30),
 travelBeforeMinutes:z.number().int().min(0).max(360),travelAfterMinutes:z.number().int().min(0).max(360),
 scopeReviewed:z.literal(true),equipmentReviewed:z.literal(true),pickupReviewed:z.literal(true),
 reviewNote:z.string().trim().min(10).max(3000),key:z.string().min(16).max(128),
}).strict().superRefine((v,ctx)=>{
 if(new Set(v.resources).size!==v.resources.length)ctx.addIssue({code:'custom',path:['resources'],message:'Choose each resource once'});
 if(v.arrivalOffsetMinutes>=v.durationMinutes)ctx.addIssue({code:'custom',path:['arrivalOffsetMinutes'],message:'Arrival must precede the reserved end'});
 if((v.appointmentId===null)!==(v.appointmentRevision===null))ctx.addIssue({code:'custom',path:['appointmentRevision'],message:'Appointment and revision must be supplied together'});
});
