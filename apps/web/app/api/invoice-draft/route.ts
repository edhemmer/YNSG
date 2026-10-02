import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, sameOrigin, failure } from "../../../lib/session";
const line = z
  .object({
    description: z.string().trim().min(2).max(1000),
    recordedMinutes: z.number().int().min(0).max(1440),
    chargedCents: z.number().int().min(0).max(999999999),
    waiverReason: z.string().max(1000),
  })
  .strict()
  .refine((v) => v.chargedCents > 0 || v.waiverReason.trim().length >= 2);
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const { db } = await authenticated();
    const r = await db.rpc("invoice_labor_draft", {
      p_org: z.uuid().parse(q.get("organization")),
      p_job: z.uuid().parse(q.get("job")),
    });
    if (r.error) throw r.error;
    return NextResponse.json(
      { draft: r.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Request not accepted." },
      { status: 403 },
    );
  try {
    const v = z
      .object({
        organization: z.uuid(),
        job: z.uuid(),
        revision: z.number().int().positive(),
        lines: z.array(line).min(1).max(50),
        key: z.string().min(16).max(128),
      })
      .strict()
      .parse(await request.json());
    const { db } = await authenticated();
    const r = await db.rpc("save_invoice_labor", {
      p_org: v.organization,
      p_job: v.job,
      p_revision: v.revision,
      p_lines: v.lines,
      p_key: v.key,
    });
    if (r.error)
      return NextResponse.json(
        {
          error:
            r.error.message === "CHANGE_ORDER_REQUIRED"
              ? "Charges exceed the approved labor amount. A change order is required."
              : "The draft was not saved. Reload the job and check the recorded work.",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.json(
      { result: r.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
