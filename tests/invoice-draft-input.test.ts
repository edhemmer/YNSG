import test from "node:test";
import assert from "node:assert/strict";
import {
  parseInvoiceDraft,
  MAX_INVOICE_DRAFT_BYTES,
} from "../apps/web/lib/invoice-draft-input.js";
const value = {
  organization: "11111111-1111-4111-8111-111111111111",
  job: "22222222-2222-4222-8222-222222222222",
  revision: 1,
  key: "retry-key-123456789",
  lines: [
    {
      description: "Pull weeds",
      recordedMinutes: 120,
      chargedCents: 9000,
      waiverReason: "",
    },
  ],
};
test("invoice draft preserves exact cents and documented waived work", () => {
  assert.equal(
    parseInvoiceDraft(JSON.stringify(value)).lines[0]!.chargedCents,
    9000,
  );
  const waived = structuredClone(value);
  waived.lines[0]!.chargedCents = 0;
  waived.lines[0]!.waiverReason = "Courtesy";
  assert.equal(
    parseInvoiceDraft(JSON.stringify(waived)).lines[0]!.chargedCents,
    0,
  );
});
test("invoice draft rejects undocumented waiver, fractional money and malformed body", () => {
  const bad = structuredClone(value);
  bad.lines[0]!.chargedCents = 0;
  assert.throws(() => parseInvoiceDraft(JSON.stringify(bad)));
  bad.lines[0]!.chargedCents = 1.5;
  assert.throws(() => parseInvoiceDraft(JSON.stringify(bad)));
  assert.throws(() => parseInvoiceDraft("{"));
  assert.throws(
    () => parseInvoiceDraft(" ".repeat(MAX_INVOICE_DRAFT_BYTES + 1)),
    /DRAFT_TOO_LARGE/,
  );
});
