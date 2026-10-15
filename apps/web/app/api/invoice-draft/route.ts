import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, sameOrigin, failure } from "../../../lib/session";
import { parseInvoiceDraft } from "../../../lib/invoice-draft-input";
import {invoiceIssuanceReadiness} from '../../../lib/service-workflow';
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const { db } = await authenticated();
    const r = await db.rpc("invoice_labor_draft", {
      p_org: z.uuid().parse(q.get("organization")),
      p_job: z.uuid().parse(q.get("job")),
    });
    if (r.error) throw r.error;
    const tax=await db.rpc("invoice_tax_context",{p_org:z.uuid().parse(q.get("organization")),p_job:z.uuid().parse(q.get("job"))});
    if(tax.error)throw tax.error;
    const org=z.uuid().parse(q.get('organization')),job=z.uuid().parse(q.get('job'));
    const record=await db.from('jobs').select('quote_id,approved_version').eq('organization_id',org).eq('id',job).single();
    if(record.error)throw record.error;
    const quote=await db.from('quote_versions').select('snapshot').eq('organization_id',org).eq('quote_id',record.data.quote_id).eq('version',record.data.approved_version).single();
    if(quote.error)throw quote.error;
    return NextResponse.json(
      { draft: r.data, tax:tax.data,readiness:invoiceIssuanceReadiness(quote.data.snapshot?.configuration||null,tax.data?.required===true) },
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
    if(r.error){
      const named:Record<string,string>={
        CHANGE_ORDER_REQUIRED:'Charges exceed approved labor. Review the change order.',
        STALE_REVISION:'Work changed. Refresh the saved job before modifying it.',
        TRANSITION:'The work record no longer accepts draft changes.',
        VALIDATION:'Check work descriptions, amounts and waiver reasons.',
        SETUP_REQUIRED:'Finance setup is not ready.',
        IDEMPOTENCY_CONFLICT:'Original retry details differ. Keep the same attempt.',
        NOT_FOUND:'This job is unavailable to this company.'
      };
      const denied=r.error.code==='42501',known=denied||Object.hasOwn(named,r.error.message);
      return NextResponse.json({error:denied?'Your account cannot change this work draft.':known?named[r.error.message]:'The draft save result is unknown. Retry the same saved attempt.'},{status:denied?403:known?409:503,headers:{'Cache-Control':'private, no-store'}});
    }
    const receipt=z.object({revision:z.number().int().positive(),totalCents:z.number().int().nonnegative()}).strict().safeParse(r.data);
    if(!receipt.success||receipt.data.revision!==v.revision+1)
      return NextResponse.json({error:'The draft save result is unknown. Retry the same saved attempt.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
    return NextResponse.json({result:receipt.data},{headers:{'Cache-Control':'private, no-store'}});
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
