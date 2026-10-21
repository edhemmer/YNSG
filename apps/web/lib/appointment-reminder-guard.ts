// Defense in depth for stale reminder mail. Canonical database leasing and
// begin_delivery remain authoritative for concurrency and final delivery.
type Appointment = { status: string; revision: number; arrival_at: string };
type Payload = Record<string, unknown>;

export function appointmentReminderCurrent(
  kind: string,
  payload: Payload,
  appointment: Appointment,
  now: Date = new Date(),
): boolean {
  if (kind !== "appointment.reminder" && kind !== "appointment.owner_reminder") return true;
  if (appointment.status !== "reserved") return false;
  if (!Number.isInteger(appointment.revision) || payload.appointmentRevision !== appointment.revision) return false;
  if (typeof payload.arrivalAt !== "string" || typeof appointment.arrival_at !== "string") return false;
  const scheduled = Date.parse(appointment.arrival_at);
  const issuedFor = Date.parse(payload.arrivalAt);
  return Number.isFinite(scheduled) &&
    Number.isFinite(issuedFor) &&
    scheduled === issuedFor &&
    scheduled > now.getTime() &&
    now.getTime() >= scheduled - 24 * 60 * 60 * 1000;
}
