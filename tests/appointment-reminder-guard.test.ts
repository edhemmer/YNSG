import test from "node:test";
import assert from "node:assert/strict";
import { appointmentReminderCurrent } from "../apps/web/lib/appointment-reminder-guard.ts";

const now = new Date("2026-10-22T16:00:00.000Z");
const appointment = {
  status: "reserved",
  revision: 4,
  arrival_at: "2026-10-23T15:00:00.000Z",
};
const payload = {
  appointmentRevision: 4,
  arrivalAt: "2026-10-23T10:00:00-05:00",
};

for (const kind of ["appointment.reminder", "appointment.owner_reminder"]) {
  test(`${kind} accepts the current confirmed future visit`, () => {
    assert.equal(appointmentReminderCurrent(kind, payload, appointment, now), true);
    assert.equal(appointmentReminderCurrent(kind, payload, appointment, new Date("2026-10-22T14:59:59Z")), false);
    assert.equal(appointmentReminderCurrent(kind, payload, appointment, new Date("2026-10-22T15:00:00Z")), true);
  });
  test(`${kind} suppresses canceled, rescheduled, stale, and past visits`, () => {
    assert.equal(appointmentReminderCurrent(kind, payload, { ...appointment, status: "canceled" }, now), false);
    assert.equal(appointmentReminderCurrent(kind, payload, { ...appointment, revision: 5 }, now), false);
    assert.equal(appointmentReminderCurrent(kind, { ...payload, appointmentRevision: 3 }, appointment, now), false);
    assert.equal(appointmentReminderCurrent(kind, { ...payload, arrivalAt: "2026-10-24T15:00:00Z" }, appointment, now), false);
    assert.equal(appointmentReminderCurrent(kind, payload, appointment, new Date("2026-10-23T15:00:00Z")), false);
    assert.equal(appointmentReminderCurrent(kind, { ...payload, arrivalAt: "garbage" }, appointment, now), false);
  });
}
test("non-reminder delivery stays governed by its existing database policy", () => {
  assert.equal(appointmentReminderCurrent("appointment.confirmation", {}, appointment, now), true);
});
