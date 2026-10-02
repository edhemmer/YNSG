import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, sameOrigin, failure } from "../../../lib/session";
const schema = z
  .object({
    organization: z.uuid(),
    id: z.uuid().nullable(),
    revision: z.number().int().positive().nullable(),
    start: z.iso.datetime({ offset: true }).nullable(),
    end: z.iso.datetime({ offset: true }).nullable(),
    remove: z.boolean(),
    key: z.string().min(16).max(128),
  })
  .strict();
export async function GET(request: Request) {
  try {
    const org = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("organization"));
    const { db } = await authenticated();
    const r = await db.rpc("owner_calendar_blocks", { p_org: org });
    if (r.error) throw r.error;
    return NextResponse.json(
      { blocks: r.data },
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
    const v = schema.parse(await request.json());
    const { db } = await authenticated();
    const r = await db.rpc("manage_calendar_block", {
      p_org: v.organization,
      p_id: v.id,
      p_revision: v.revision,
      p_start: v.start,
      p_end: v.end,
      p_remove: v.remove,
      p_key: v.key,
    });
    if (r.error)
      return NextResponse.json(
        {
          error:
            r.error.message === "CAPACITY_CONFLICT"
              ? "An appointment or its buffer overlaps this time. Move it before blocking this time."
              : r.error.message === "STALE_REVISION"
                ? "This block changed. Reload and try again."
                : "This time could not be blocked. Check your access and dates.",
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
