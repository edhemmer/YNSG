import { z } from "zod";
const line = z
  .object({
    description: z.string().trim().min(2).max(1000),
    recordedMinutes: z.number().int().min(0).max(1440),
    chargedCents: z.number().int().min(0).max(999999999),
    waiverReason: z.string().max(1000),
  })
  .strict()
  .refine((v) => v.chargedCents > 0 || v.waiverReason.trim().length >= 2);
const draft = z
  .object({
    organization: z.uuid(),
    job: z.uuid(),
    revision: z.number().int().positive(),
    lines: z.array(line).min(1).max(50),
    key: z.string().min(16).max(128),
  })
  .strict();
export const MAX_INVOICE_DRAFT_BYTES = 120000;
export function parseInvoiceDraft(raw: string) {
  if (new TextEncoder().encode(raw).byteLength > MAX_INVOICE_DRAFT_BYTES)
    throw new Error("DRAFT_TOO_LARGE");
  return draft.parse(JSON.parse(raw));
}
