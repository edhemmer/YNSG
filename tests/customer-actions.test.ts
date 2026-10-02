import test from "node:test";
import assert from "node:assert/strict";
import { customerRequestCommand } from "../packages/contracts/customer-actions.ts";
import {
  customerLinkToken,
  customerLinkUrl,
} from "../apps/web/lib/customer-links.ts";
import { appointmentMessage } from "../apps/web/lib/appointment-message.ts";
const key = Buffer.alloc(32, 7).toString("base64");
test("customer links are stable per communication, tenant/revision/key scoped and never query parameters", () => {
  const token = customerLinkToken("company", "outbox", 2, key);
  assert.equal(token.length, 43);
  assert.equal(token, customerLinkToken("company", "outbox", 2, key));
  for (const altered of [
    customerLinkToken("other", "outbox", 2, key),
    customerLinkToken("company", "other", 2, key),
    customerLinkToken("company", "outbox", 3, key),
    customerLinkToken(
      "company",
      "outbox",
      2,
      Buffer.alloc(32, 8).toString("base64"),
    ),
  ])
    assert.notEqual(token, altered);
  const url = new URL(
    customerLinkUrl("https://example.invalid", token, "confirm"),
  );
  assert.equal(url.search, "");
  assert.equal(url.pathname, "/request/manage");
  assert.equal(new URLSearchParams(url.hash.slice(1)).get("token"), token);
  assert.throws(() => customerLinkUrl("http://example.invalid", token));
  assert.throws(() => customerLinkToken("a", "b", 1, "short"));
});
test("limited customer contract rejects tenant, price, booking and scope changes", () => {
  const input = {
    action: "confirm",
    appointmentRevision: 2,
    responseVersion: 0,
    configurationVersion: 3,
  };
  assert.equal(
    customerRequestCommand.parse({
      operation: "action",
      input,
      key: "customer-key-00001",
    }).operation,
    "action",
  );
  for (const changed of [
    { ...input, organizationId: "another" },
    { ...input, price: 1 },
    { ...input, action: "approve" },
    { ...input, note: "extra work" },
    { ...input, action: "request_another_time", note: "short" },
  ])
    assert.throws(() =>
      customerRequestCommand.parse({
        operation: "action",
        input: changed,
        key: "customer-key-00001",
      }),
    );
});
test("reminder and under-48h confirmation carry intentional actions and correct local arrival", () => {
  const base = {
    company: "Your Neighborhood Service Guy",
    recipient: "customer@example.invalid",
    notificationRecipient: "owner@example.invalid",
    request: {
      name: "Synthetic Customer",
      street: "100 Test Street",
      city: "Test",
      services: [
        { service: "Yard", task: "Mulch" },
        { service: "Home", task: "Door adjustment" },
      ],
    },
    arrivalAt: "2026-11-02T15:00:00Z",
    timezone: "America/Chicago",
    ownerUrl: "https://example.invalid/?request=synthetic",
    manageUrl: "https://example.invalid/request/manage#token=synthetic",
    confirmUrl: "https://example.invalid/request/manage#action=confirm",
    rescheduleUrl: "https://example.invalid/request/manage#action=reschedule",
  };
  for (const kind of [
    "appointment.confirmation",
    "appointment.reminder",
  ] as const) {
    const v = appointmentMessage({ ...base, kind });
    assert.match(v.body, /9:00 AM/);
    assert.match(v.body, /Yard: Mulch/);
    assert.match(v.body, /Home: Door adjustment/);
    assert.ok(v.body.includes(base.confirmUrl));
    assert.ok(v.body.includes(base.rescheduleUrl));
    assert.match(v.body, /Nothing changes until/);
    assert.match(v.body, /stays booked/);
  }
  assert.equal(
    appointmentMessage({ ...base, kind: "appointment.owner_approval" }).subject,
    "Your Neighborhood Service Guy New Request",
  );
  const other = appointmentMessage({
    ...base,
    company: "Other Company",
    kind: "appointment.confirmation",
  });
  assert.match(other.body, /Other Company/);
  assert.doesNotMatch(other.body, /Your Neighborhood Service Guy|770-630/);
  assert.throws(() =>
    appointmentMessage({
      ...base,
      kind: "appointment.reminder",
      manageUrl: undefined,
    } as never),
  );
});
