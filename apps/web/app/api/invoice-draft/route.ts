import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, sameOrigin, failure } from "../../../lib/session";
import { parseInvoiceDraft } from "../../../lib/invoice-draft-input";
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
    const v = parseInvoiceDraft(await request.text());
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
    if (e instanceof z.ZodError || e instanceof SyntaxError ||
        (e instanceof Error && e.message === "DRAFT_TOO_LARGE")) {
      return NextResponse.json({ error: "Check the work descriptions, whole minutes, charges and reasons for no charge. The draft was not saved." },
        { status: e instanceof Error && e.message === "DRAFT_TOO_LARGE" ? 413 : 400,
          headers: { "Cache-Control": "no-store" } });
    }
    return failure(e);
  }
}
