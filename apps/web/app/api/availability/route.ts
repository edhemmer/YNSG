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
    const { token, account } = await accessToken(org);
    if (!account.calendar_id) throw new GoogleFailure('CALENDAR_REQUIRED');
    const clock = Date.now();
    const rules = snapshot.settings.scheduling;
    const windowEnd = Math.min(clock + rules.horizonMinutes * 60000, clock + 7 * 24 * 60 * 60000);
    const buffer = (rules.bufferMinutes ?? 0) * 60000;
    const external = await busyTimes(token, account.calendar_id,
      new Date(clock).toISOString(), new Date(windowEnd + durationMinutes * 60000 + buffer).toISOString());
    // A response is a short-lived observation, never a claim on capacity. Hold/approval must recheck.
    const checkedAt = Date.parse(external.checkedAt);
    const now = Date.now();
    const times = openTimesToReview({
      clock: now, timezone: snapshot.settings.timezone, durationMinutes, rules,
      resources: snapshot.resources, selectedResources,
      reservations: snapshot.reservations.map(r => ({ resourceId: r.resourceId, start: Date.parse(r.start), end: Date.parse(r.end) })),
      blocks: snapshot.blocks.map(r => ({ start: Date.parse(r.start), end: Date.parse(r.end) })),
      externalBusy: external.busy.map(r => ({ start: Date.parse(r.start), end: Date.parse(r.end) })),
      externalBusyVerifiedUntil: checkedAt + 60000, windowEnd,
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
    if (error instanceof GoogleFailure) return json({ error: 'Connect an authorized Google calendar before checking times.' }, error.code === 'OWNER_ACCESS_REQUIRED' ? 403 : 409);
    if (error instanceof DomainError) return json({ error: error.message }, 409);
    if (error instanceof z.ZodError) return json({ error: 'Review the scheduling settings and selected resources.' }, 400);
    return json({ error: 'Times could not be checked. No appointment was created.' }, 503);
  }
}
