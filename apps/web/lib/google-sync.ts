import { accessToken, store,serverDatabase } from "./google-server";
import { projectEvent } from "./google-calendar";
type Claim = {
  suppressed?: boolean;
  item: { id: string; lease_token: string };
  appointment: {
    id: string;
    request_id: string;
    revision: number;
    start_at: string;
    end_at: string;
    timezone: string;
    status: string;
    expires_at: string | null;
  };
  projection: { event_id: string | null; etag: string | null } | null;
  calendar: string;
  connectionRevision: number;
};
export async function syncGoogleCalendar(org: string) {
  const { token } = await accessToken(org);
  await store(org, "reconcile_queue");
  const results: string[] = [];
  const deadline = Date.now() + 20000;
  for (let i = 0; i < 10 && Date.now() < deadline; i++) {
    const c = await store<Claim | null>(org, "projection_claim");
    if (!c) break;
    if (c.suppressed) {
      results.push("obsolete intent suppressed");
      continue;
    }
    const a = c.appointment;
    let result;
    try {
      const request=await serverDatabase().from('service_requests').select('id,original_submission').eq('organization_id',org).eq('id',a.request_id).single();
      if(request.error)throw new Error('REQUEST_DETAILS_REQUIRED');
      const submission=request.data.original_submission;
      const services=Array.isArray(submission.services)?submission.services.map((s:{service:string;task:string})=>s.service+(s.task?': '+s.task:'')):[submission.service||'Service'];
      const orderUrl=new URL('/',process.env.APP_ORIGIN!);orderUrl.searchParams.set('googleOrganization',org);orderUrl.searchParams.set('request',request.data.id);
      result = await projectEvent(
        token,
        {
          organization: org,
          appointment: a.id,
          revision: a.revision,
          start: a.start_at,
          end: a.end_at,
          timezone: a.timezone,
          status:
            a.expires_at &&
            Date.parse(a.expires_at) <= Date.now() &&
            ["held", "proposal"].includes(a.status)
              ? "expired"
              : a.status,
          calendar: c.calendar,
          customer:{name:submission.name||'Customer',address:[submission.street,submission.city].filter(Boolean).join(', '),phone:submission.phone||'Not recorded',services,orderUrl:orderUrl.toString()},
        },
        {
          etag: c.projection?.etag || null,
          eventId: c.projection?.event_id || null,
        },
      );
    } catch {
      result = {
        state: "failed",
        reason:
          "Google request failed; retry is queued with the same event identity.",
      };
    }
    await store(org, "projection_finish", {
      id: c.item.id,
      lease: c.item.lease_token,
      connectionRevision: c.connectionRevision,
      result: result.state,
      ...("eventId" in result
        ? { eventId: result.eventId, etag: result.etag }
        : {}),
      reason: result.reason,
    });
    results.push(result.state);
  }
  return { results, status: await store(org, "sync_status") };
}
