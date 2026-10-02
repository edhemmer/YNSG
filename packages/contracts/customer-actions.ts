import { z } from "zod";
export const customerAction = z
  .object({
    action: z.enum(["confirm", "request_another_time"]),
    appointmentRevision: z.number().int().positive(),
    responseVersion: z.number().int().min(0),
    configurationVersion: z.number().int().positive(),
    preferredLocalStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      .nullable()
      .default(null),
    note: z.string().trim().max(2000).default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action === "request_another_time" && value.note.length < 10)
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Tell us when you can be available.",
      });
    if (
      value.action === "confirm" &&
      (value.note !== "" || value.preferredLocalStart !== null)
    )
      ctx.addIssue({
        code: "custom",
        message: "Confirmation does not change the appointment.",
      });
  });
export const customerRequestCommand = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("open"),
      token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    })
    .strict(),
  z.object({ operation: z.literal("context") }).strict(),
  z
    .object({
      operation: z.literal("action"),
      input: customerAction,
      key: z.string().min(16).max(128),
    })
    .strict(),
]);
