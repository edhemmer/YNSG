import {replacementAvailability} from '../../../lib/replacement-availability';
import {localInstant} from '../../../../../packages/domain/timezone';
import {addDays} from '../../../../../lib/appointment-window.js';
import {calendarFacts} from "../../../lib/calendar-authority";
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { companySettings, DomainError } from '../../../../../packages/contracts/index';
import { openTimesToReview } from '../../../../../packages/domain/availability';
import { authorizeGoogle, accessToken } from '../../../lib/google-server';
import { busyTimes, GoogleFailure } from '../../../lib/google-core';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const settings = z.object({ timezone: companySettings.shape.timezone, scheduling: companySettings.shape.scheduling });
const snapshotSchema = z.object({
  configurationVersion: z.number().int().positive(), scheduleRevision: z.number().int().nonnegative(),
  settings,
  resources: z.array(z.object({ id: z.uuid(), name: z.string(), kind: z.string(), status: z.string() })),
  reservations: z.array(z.object({ resourceId: z.uuid(), start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }) })),
  blocks: z.array(z.object({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }) })),
});
function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const org = z.uuid().parse(query.get('organization'));
    const { db } = await authorizeGoogle(org);
    const response = await db.rpc('scheduling_snapshot', { p_org: org });
    if (response.error) return json({ error: 'Publish scheduling settings before checking times.' }, 409);
    const snapshot = snapshotSchema.parse(response.data);
    if (!query.has('resources')) return json({ resources: snapshot.resources, timezone: snapshot.settings.timezone });
    const selectedResources = z.array(z.uuid()).min(1).max(30).parse(query.get('resources')!.split(','));
    const durationMinutes = z.coerce.number().int().min(120).max(1440).multipleOf(30).parse(query.get('durationMinutes') || '120');
    const clock = Date.now();
    const replacement=query.get('replacement');
    let originalReservations:{resourceId:string;start:string;end:string}[]=[];
    if(replacement){
      z.uuid().parse(replacement);const requestId=z.uuid().parse(query.get('request'));
      const original=await db.from('appointments').select('id,status,start_at,end_at').eq('organization_id',org).eq('request_id',requestId).eq('id',replacement).eq('status','reserved').gt('end_at',new Date(clock).toISOString()).maybeSingle();
      if(original.error||!original.data)return json({error:'The original appointment changed. Refresh before rescheduling.'},409);
      const resources=await db.from('resource_reservations').select('resource_id').eq('organization_id',org).eq('appointment_id',replacement).eq('active',true).limit(31);
      if(resources.error||!resources.data.length||resources.data.length>30)return json({error:'The original reservation could not be checked. Refresh before rescheduling.'},409);
      // Match canonical appointment bounds, not a client-supplied time range.
      const window=await db.rpc('recurring_replacement_window',{p_org:org,p_appointment:replacement});if(window.error||!window.data)throw Error('ORIGINAL_UNAVAILABLE');
      originalReservations=resources.data.map(r=>({resourceId:r.resource_id,start:window.data.start,end:window.data.end}));
    }
    const rules = snapshot.settings.scheduling;
    const day=query.has('day')?z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(query.get('day')):null;
    const windowStart=day?Math.max(clock,localInstant(day+'T00:00',snapshot.settings.timezone)):clock;
    const windowEnd = Math.min(clock + rules.horizonMinutes * 60000,clock+30*24*60*60000,day?localInstant(addDays(day,1)+'T00:00',snapshot.settings.timezone)-1:clock+7*24*60*60000);
    if(windowEnd<=windowStart)return json({times:[],checkedAt:new Date(clock).toISOString(),validUntil:new Date(clock+60000).toISOString(),configurationVersion:snapshot.configurationVersion,scheduleRevision:snapshot.scheduleRevision,timezone:snapshot.settings.timezone,windowEnd:new Date(windowEnd).toISOString(),reserved:false});
    const buffer = (rules.bufferMinutes ?? 0) * 60000;
    const external = await calendarFacts(org,
      new Date(windowStart).toISOString(), new Date(windowEnd + durationMinutes * 60000 + buffer).toISOString());
    // A response is a short-lived observation, never a claim on capacity. Hold/approval must recheck.
    const checkedAt = Date.parse(external.checkedAt);
    const now = Date.now();
    const times = openTimesToReview({
      clock: now, timezone: snapshot.settings.timezone, durationMinutes, rules,
      resources: snapshot.resources, selectedResources,
      reservations: replacementAvailability(snapshot.reservations,originalReservations).map(r => ({ resourceId: r.resourceId, start: Date.parse(r.start), end: Date.parse(r.end) })),
      blocks: snapshot.blocks.map(r => ({ start: Date.parse(r.start), end: Date.parse(r.end) })),
      externalBusy: external.busy.map(r => ({ start: Date.parse(r.start), end: Date.parse(r.end) })),
      externalBusyVerifiedUntil: checkedAt + 60000, windowStart,windowEnd,
    });
    return json({
      times: times.map(t => ({ start: new Date(t.start).toISOString(), end: new Date(t.end).toISOString() })),
      checkedAt: external.checkedAt, validUntil: new Date(checkedAt + 60000).toISOString(),
      configurationVersion: snapshot.configurationVersion, scheduleRevision: snapshot.scheduleRevision,
      timezone: snapshot.settings.timezone, windowEnd: new Date(windowEnd).toISOString(),
      requiresReview: ['service scope', 'travel between visits', 'equipment', 'supplier pickup and material readiness'],
      reserved: false,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return json({ error: 'Sign in to check times.' }, 401);
    if (error instanceof GoogleFailure) return json({ error: 'Your appointment calendar could not be checked. Review its connection in Settings.' }, error.code === 'OWNER_ACCESS_REQUIRED' ? 403 : 409);
    if (error instanceof DomainError) return json({ error: error.message }, 409);
    if (error instanceof z.ZodError) return json({ error: 'Review the scheduling settings and selected resources.' }, 400);
    return json({ error: 'Times could not be checked. No appointment was created.' }, 503);
  }
}
