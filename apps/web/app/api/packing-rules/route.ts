import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, sameOrigin, failure } from "../../../lib/session";
const headers = { "Cache-Control": "private, no-store" };
const item = z
  .object({
    name: z.string().trim().min(1).max(80),
    quantity: z.number().int().min(1).max(1000),
    unit: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z][a-z ]{0,23}$/),
    consumed: z.boolean(),
  })
  .strict();
const command = z
  .object({
    organization: z.uuid(),
    service: z.string().trim().min(2).max(80),
    task: z.string().trim().max(120),
    revision: z.number().int().min(0),
    items: z.array(item).max(40),
    key: z.string().min(16).max(128),
  })
  .strict();
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Request not accepted." },
      { status: 403, headers },
    );
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > 30000)
      return NextResponse.json(
        { error: "Packing list is too large." },
        { status: 413, headers },
      );
    const c = command.parse(JSON.parse(body));
    const { db } = await authenticated();
    const { data, error } = await db.rpc("approve_packing_rule", {
      p_org: c.organization,
      p_service: c.service,
      p_task: c.task,
      p_revision: c.revision,
      p_items: c.items,
      p_key: c.key,
    });
    if (error)
      return NextResponse.json(
        {
          error:
            error.message === "STALE_REVISION"
              ? "This packing list changed. Refresh the call sheet before editing it."
              : error.message === "DUPLICATE_EQUIPMENT"
                ? "List each piece of equipment once."
                : error.message === "IDEMPOTENCY_CONFLICT"
                  ? "This retry changed. Refresh before saving again."
                  : "The packing list was not saved. Check your access and entries.",
        },
        { status: error.code === "42501" ? 403 : 409, headers },
      );
    return NextResponse.json({ ok: true, result: data }, { headers });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error:
            "Check item names, whole-number quantities and units before approving.",
        },
        { status: 400, headers },
      );
    return failure(error);
  }
}
