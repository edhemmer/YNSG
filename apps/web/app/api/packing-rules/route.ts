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
    if(error){
      const denied=error.code==='42501',stale=error.message==='STALE_REVISION',
        duplicate=error.message==='DUPLICATE_EQUIPMENT',conflict=error.message==='IDEMPOTENCY_CONFLICT',
        validation=['VALIDATION','RULE_LIMIT','SETUP_REQUIRED'].includes(error.message);
      const known=denied||stale||duplicate||conflict||validation;
      return NextResponse.json({error:denied?'This account cannot approve packing rules.':stale?'This list changed. Refresh before revising it.':duplicate?'List each piece of equipment once.':conflict?'The retry details changed. Keep the original attempt.':validation?'Check approved equipment, quantities and company setup.':'The saved result is unknown. Check the same request before changing equipment.'},{status:denied?403:known?409:503,headers});
    }
    const confirmed=z.object({saved:z.literal(true),revision:z.number().int().positive()}).strict().safeParse(data);
    if(!confirmed.success||confirmed.data.revision!==c.revision+1)
      return NextResponse.json({error:'The saved result is unknown. Check the same request before changing equipment.'},{status:503,headers});
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
