import { z } from "zod";
const id = z.uuid();
const existing = { id, revision: z.number().int().positive() };
export const schedulingInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("hold"),
      requestId: id,
      evidenceId: id,
      replacesId: id.nullable().optional(),
    })
    .strict(),
  z.object({ action: z.literal("submit"), ...existing }).strict(),
  z
    .object({ action: z.literal("approve"), ...existing, evidenceId: id })
    .strict(),
  z
    .object({
      action: z.literal("decline_time"),
      ...existing,
      reason: z.string().min(2).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("decline_service"),
      ...existing,
      reason: z.string().min(2).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("reconfirm"),
      ...existing,
      evidence: z.string().min(10).max(1000),
    })
    .strict(),
]);
export type SchedulingInput = z.infer<typeof schedulingInput>;
export const schedulingPolicy = z
  .object({
    selectionMinutes: z.number().int().min(1).max(60),
    proposalMinutes: z.number().int().min(1).max(10080),
    leadMinutes: z.number().int().min(0),
    horizonMinutes: z.number().int().min(1).max(527040),
    pendingLimit: z.number().int().min(1).max(5),
    bufferMinutes: z.number().int().min(0).max(180),
  })
  .strict()
  .refine((value) => value.horizonMinutes > value.leadMinutes, {
    message: "Booking horizon must extend beyond minimum notice.",
    path: ["horizonMinutes"],
  });
