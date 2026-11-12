import { googleRequest, GoogleFailure, hash } from "./google-core.ts";
export type Projection = {
  organization: string;
  appointment: string;
  revision: number;
  start: string;
  end: string;
  timezone: string;
  status: string;
  calendar: string;
  customer?:{name:string;address:string;phone:string;services:string[];orderUrl:string};
};
type Event = {
  id: string;
  etag: string;
  summary?: string;
  location?:string;description?:string;
  status?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  reminders?: { useDefault?: boolean; overrides?: { method?: string; minutes?: number }[] };
  extendedProperties?: { private?: Record<string, string> };
};
export type ProjectionResult = {
  state: "synced" | "needs_review";
  eventId: string;
  etag: string | null;
  reason?: string;
};
// Google only accepts event ids made of 0-9 and a-v (base32hex); "ynsg" contained an invalid "y",
// so every new visit was rejected with HTTP 400.
export function eventId(p: Projection) {
  return "vnsg" + hash(p.organization + ":" + p.calendar + ":" + p.appointment);
}
// Phone alerts for every visit: the evening before (24 h) and an hour ahead.
const REMINDERS = [
  { method: "popup", minutes: 1440 },
  { method: "popup", minutes: 60 },
];
function remindersMatch(e: Event) {
  const o = e.reminders?.overrides ?? [];
  return (
    e.reminders?.useDefault === false &&
    o.length === REMINDERS.length &&
    REMINDERS.every((r) => o.some((x) => x.method === r.method && x.minutes === r.minutes))
  );
}
function desired(p: Projection) {
  return {
    id: eventId(p),
    summary: (p.customer ? p.customer.name+' — '+p.customer.services.join(', ')+' — ' : '') + (
      p.status === "reserved"
        ? "Your Neighborhood Service Guy — Confirmed"
        : "Your Neighborhood Service Guy — Awaiting Confirmation"),
    ...(p.customer?{location:p.customer.address,description:'Phone: '+p.customer.phone+'\nServices: '+p.customer.services.join('; ')+'\nService order: '+p.customer.orderUrl}:{}),
    status: p.status === "reserved" ? "confirmed" : "tentative",
    start: { dateTime: p.start, timeZone: p.timezone },
    end: { dateTime: p.end, timeZone: p.timezone },
    transparency: "opaque",
    visibility: "private",
    reminders: { useDefault: false, overrides: REMINDERS },
    extendedProperties: {
      private: {
        ynsgOrganization: p.organization,
        ynsgAppointment: p.appointment,
        ynsgRevision: String(p.revision),
      },
    },
  };
}
function same(e: Event, p: Projection) {
  const d = desired(p);
  return (
    e.summary === d.summary &&
    (!p.customer||(e.location===d.location&&e.description===d.description)) &&
    e.status === d.status &&
    remindersMatch(e) &&
    Date.parse(e.start?.dateTime || "") === Date.parse(p.start) &&
    Date.parse(e.end?.dateTime || "") === Date.parse(p.end) &&
    e.extendedProperties?.private?.ynsgRevision === String(p.revision)
  );
}
export async function projectEvent(
  token: string,
  p: Projection,
  known: { etag: string | null; eventId: string | null },
  transport: typeof fetch = fetch,
): Promise<ProjectionResult> {
  const id = eventId(p),
    base =
      "/calendar/v3/calendars/" + encodeURIComponent(p.calendar) + "/events",
    path = base + "/" + id;
  let existing: Event | null = null;
  try {
    existing = await googleRequest<Event>(token, path, {}, transport);
  } catch (e) {
    if (!(e instanceof GoogleFailure) || ![404, 410].includes(e.status))
      throw e;
  }
  const terminal = !["held", "proposal", "reserved", "needs_review"].includes(
    p.status,
  );
  if (!existing) {
    if (terminal) return { state: "synced", eventId: id, etag: null };
    if (known.eventId)
      return {
        state: "needs_review",
        eventId: id,
        etag: null,
        reason: "Google event was removed; owner review required.",
      };
    try {
      const created = await googleRequest<Event>(
        token,
        base + "?sendUpdates=none",
        { method: "POST", body: JSON.stringify(desired(p)) },
        transport,
      );
      return { state: "synced", eventId: id, etag: created.etag };
    } catch (e) {
      if (e instanceof GoogleFailure && e.status === 409) {
        const recovered = await googleRequest<Event>(
          token,
          path,
          {},
          transport,
        );
        if (same(recovered, p))
          return { state: "synced", eventId: id, etag: recovered.etag };
        return {
          state: "needs_review",
          eventId: id,
          etag: recovered.etag,
          reason: "Existing event differs from the queued CRM revision.",
        };
      }
      throw e;
    }
  }
  const ownership = existing.extendedProperties?.private;
  if (
    ownership?.ynsgOrganization !== p.organization ||
    ownership?.ynsgAppointment !== p.appointment
  )
    return {
      state: "needs_review",
      eventId: id,
      etag: existing.etag,
      reason: "Event ownership mismatch.",
    };
  if (!terminal && same(existing, p))
    return { state: "synced", eventId: id, etag: existing.etag };
  if (Number(ownership.ynsgRevision) > p.revision)
    return {
      state: "needs_review",
      eventId: id,
      etag: existing.etag,
      reason: "A newer CRM event revision already exists.",
    };
  if (!known.etag || existing.etag !== known.etag)
    return {
      state: "needs_review",
      eventId: id,
      etag: existing.etag,
      reason:
        "Google event changed outside the CRM; review before applying changes.",
    };
  try {
    if (terminal) {
      await googleRequest<void>(
        token,
        path + "?sendUpdates=none",
        { method: "DELETE", headers: { "If-Match": existing.etag } },
        transport,
      );
      return { state: "synced", eventId: id, etag: null };
    }
    const updated = await googleRequest<Event>(
      token,
      path + "?sendUpdates=none",
      {
        method: "PUT",
        headers: { "If-Match": existing.etag },
        body: JSON.stringify(desired(p)),
      },
      transport,
    );
    return { state: "synced", eventId: id, etag: updated.etag };
  } catch (e) {
    if (e instanceof GoogleFailure && e.status === 412)
      return {
        state: "needs_review",
        eventId: id,
        etag: existing.etag,
        reason: "Google changed during sync; review required.",
      };
    throw e;
  }
}
