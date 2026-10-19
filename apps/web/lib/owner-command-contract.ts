import {z} from "zod";
import {recordExpenseCommand,reverseExpenseCommand} from './expense-contract.ts';
import {paymentCorrection} from './payment-correction-contract.ts';
const base = { organizationId: z.uuid(), key: z.string().min(16).max(128) };
export const ownerCommandSchema = z.discriminatedUnion("command", [
  z.object({
    ...base,
    command: z.literal("ReviewRequest"),
    id: z.uuid(),
    revision: z.number().int().positive(),
    status: z.enum(["reviewing", "declined", "canceled"]),
    reason: z.string().trim().min(2).max(1000).optional(),
  }).strict(),
  z.object({
    ...base,
    command: z.literal("PublishQuote"),
    id: z.uuid(),
    revision: z.number().int().positive(),
    scope: z.string().min(10).max(5000),
    minutes: z.number().int().min(120).max(1440).multipleOf(30),
    community: z.boolean(),
    eligibilityReviewed: z.boolean(),
    customerId: z.uuid().nullable(),
  }).strict(),
  z.object({
    ...base,
    command: z.literal("ApproveQuote"),
    id: z.uuid(),
    version: z.number().int().positive(),
    evidence: z.string().min(10).max(2000),
  }).strict(),
  z.object({
    ...base,
    command: z.literal("CompleteServiceCall"),
    id: z.uuid(),
    revision: z.number().int().positive(),
  }).strict(),
  z.object({
    ...base,
    command: z.literal("ApproveInvoice"),
    id: z.uuid(),
    revision: z.number().int().positive(),
    totalCents: z.number().int().min(0).max(999999999),
    reviewed: z.literal(true),
    taxRuleId:z.uuid().optional(),
    taxEvidence:z.string().trim().min(2).max(1000).optional(),
  }).strict(),
  z.object({
    ...base,
    command: z.literal("RecordPayment"),
    id: z.uuid(),
    cents: z.number().int().positive().max(999999999),
    method: z.enum(["cash", "zelle"]),
    reference: z.string().min(1).max(300),
    receivedAt: z.iso.datetime(),
    confirmed: z.literal(true),
  }).strict(),
  paymentCorrection,
  recordExpenseCommand,
  reverseExpenseCommand,
]);
