import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, failure, sameOrigin } from "../../../lib/session";
import { schedulingInput } from "../../../../../packages/contracts/scheduling";
const envelope = z
  .object({
    schemaVersion: z.literal(1),
    organizationId: z.uuid(),
    key: z.string().min(16).max(128),
    input: schedulingInput,
  })
  .strict();
const messages: Record<string, string> = {
  STALE_REVISION: "This appointment changed. Refresh before deciding.",
  FEASIBILITY_REVIEW_REQUIRED:
    "Current calendar, route and scope checks are required before reserving or approving this time.",
  SETUP_REQUIRED: "Complete the scheduling setup first.",
  TRANSITION: "This appointment is no longer awaiting this action.",
  PENDING_LIMIT: "Resolve the existing proposed times before adding another.",
  RESOURCE_UNAVAILABLE:
    "A required person or item of equipment is unavailable.",
  OUTSIDE_OPERATING_HOURS:
    "Choose a time within the configured operating hours.",
  REPLACEMENT_REQUIRED:
    "Propose a replacement while keeping the existing appointment.",
  ORIGINAL_UNAVAILABLE:
    "The original appointment changed. Refresh before rescheduling.",
  IDEMPOTENCY_CONFLICT:
    "The retry contains different details. Refresh before continuing.",
};
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Request not accepted." },
      { status: 403 },
    );
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 8000)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 },
      );
    const c = envelope.parse(JSON.parse(text));
    const { db } = await authenticated();
    const { action, ...input } = c.input;
    const { data, error } = await db.rpc("scheduling_command", {
      p_org: c.organizationId,
      p_action: action,
      p_input: input,
      p_key: c.key,
    });
    if (error)
      return NextResponse.json(
        {
          error:
            error.code === "23P01"
              ? "That resource is already reserved for part of this time. Choose another time."
              : messages[error.message] ||
                "The appointment was not changed. Refresh and review your access.",
          code:
            error.code === "23P01"
              ? "CAPACITY_CONFLICT"
              : messages[error.message]
                ? error.message
                : "ACTION_REJECTED",
        },
        { status: error.code === "42501" ? 403 : 409 },
      );
    return NextResponse.json(
      { ok: true, result: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
// No GET handler: links and email scanners never execute a scheduling command.
