import {z} from 'zod';
import {weeklyDates} from '../../../lib/appointment-window.js';
import {localInstant,localMinute} from '../../../packages/domain/timezone.ts';
export const recurringInput=z.object({organization:z.uuid(),firstAppointment:z.uuid(),agreement:z.string().trim().min(10).max(1500),travelBeforeMinutes:z.number().int().min(0).max(360),travelAfterMinutes:z.number().int().min(0).max(360),reviewed:z.literal(true)}).strict();
export type RecurringInput=z.infer<typeof recurringInput>;
export const recurringContext=z.object({first:z.object({id:z.uuid(),revision:z.number().int().positive(),requestId:z.uuid(),requestRevision:z.number().int().positive(),jobId:z.uuid(),jobRevision:z.number().int().positive(),quoteId:z.uuid(),quoteVersion:z.number().int().positive(),startAt:z.iso.datetime({offset:true}),endAt:z.iso.datetime({offset:true}),arrivalAt:z.iso.datetime({offset:true}),timezone:z.string(),scope:z.string(),laborCents:z.number().int().nonnegative(),durationMinutes:z.number().int().min(120)}),configurationVersion:z.number().int().positive(),scheduleRevision:z.number().int().positive(),scopeFingerprint:z.string(),resources:z.array(z.uuid()).min(1).max(30),settings:z.record(z.string(),z.unknown())});
export type RecurringContext=z.infer<typeof recurringContext>;
export type Series={id:string;revision:number;status:'active'|'stopped';requestId:string;name:string;timezone:string;firstDate:string;endExclusive:string;scope:string;laborCents:number;durationMinutes:number;visits:{requestId:string;plannedDate:string;startAt:string;endAt:string;status:string;jobStatus:string}[]};
export function recurringDates(first:{startAt:string;endAt:string;arrivalAt:string;timezone:string}){
 const local=localMinute(Date.parse(first.startAt),first.timezone),duration=Date.parse(first.endAt)-Date.parse(first.startAt),arrivalOffset=Date.parse(first.arrivalAt)-Date.parse(first.startAt);
 if(!Number.isFinite(duration)||duration<7200000||duration%1800000||arrivalOffset<0||arrivalOffset>=duration)throw Error('FIRST_VISIT_REQUIRED');
 const weekly=weeklyDates(local.slice(0,10));
 return {endExclusive:weekly.end,visits:weekly.dates.map(date=>{const start=localInstant(date+'T'+local.slice(11),first.timezone);return {date,start:new Date(start).toISOString(),end:new Date(start+duration).toISOString(),arrival:new Date(start+arrivalOffset).toISOString()};})};
}
export const recurringErrors:Record<string,string>={
 FIRST_VISIT_REQUIRED:'Confirm an upcoming first visit and record the customer’s scope and price agreement. Its time window must cover the agreed work.',
 SERIES_EXISTS:'This first visit already has a weekly schedule. Review it below.',
 REVIEW_REQUIRED:'The weekly review expired or changed. Check the dates again. No new visits were booked.',
 STALE_REVISION:'The calendar, first visit or agreement changed. Refresh and check all weekly dates again.',
 CAPACITY_CONFLICT:'A weekly date conflicts with another reservation or travel time. No part of the new series was booked.',
 OWNER_BLOCK:'A weekly date overlaps blocked time or its travel buffer. No part of the new series was booked.',
 OUTSIDE_OPERATING_HOURS:'A weekly date does not fit your working hours. No new visits were booked.',
 RESOURCE_UNAVAILABLE:'The assigned person or equipment is unavailable. Review the first visit and check again.',
 SETUP_REQUIRED:'Weekly schedules use the business calendar. Review calendar authority, working hours and travel buffer in Settings.',
 SERVICE_REVIEW_REQUIRED:'A service is on hold. Review the actual work before booking a weekly agreement.',
 WORK_STARTED:'A repeat visit already has recorded work. Review that visit before stopping the series. No visits were changed.',
 IDEMPOTENCY_CONFLICT:'This retry has different details. Refresh the saved schedule before continuing.',
 ROUTE_UNAVAILABLE:'Travel could not be verified for a weekly date. No visits were booked. Check Day routes and try again.',
};
