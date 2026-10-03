import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, sameOrigin, failure } from "../../../lib/session";
export const dynamic = "force-dynamic";
const target = z.object({ organization: z.uuid(), type: z.enum(["request", "customer"]), target: z.uuid() });
const command = target.extend({ body: z.string().trim().min(1).max(4000), key: z.string().min(16).max(128) }).strict();
const headers = { "Cache-Control": "private, no-store" };
function rejected(error: { code?: string; message: string }) {
  return NextResponse.json({ error: error.message === "IDEMPOTENCY_CONFLICT" ? "This retry changed. Reload the notes before saving again." : "Notes could not be saved or opened. Check your company access and try again." }, { status: error.code === "42501" ? 403 : 409, headers });
}
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const input = target.parse(Object.fromEntries(["organization", "type", "target"].map(k => [k, q.get(k)])));
    const page = z.coerce.number().int().min(0).max(100000).parse(q.get("page") || 0);
    const { db } = await authenticated();
    const { data, error } = await db.rpc("read_relationship_notes", { p_org: input.organization, p_type: input.type, p_target: input.target, p_page: page });
    if (error) return rejected(error);
    return NextResponse.json({ notes: data.notes.slice(0, 50), page, hasMore: data.notes.length > 50 }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request not accepted." }, { status: 403, headers });
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 17000) return NextResponse.json({ error: "Note is too long." }, { status: 413, headers });
    const input = command.parse(JSON.parse(text));
    const { db } = await authenticated();
    const { data, error } = await db.rpc("add_relationship_note", { p_org: input.organization, p_type: input.type, p_target: input.target, p_body: input.body, p_key: input.key });
    if (error) return rejected(error);
    return NextResponse.json({ ok: true, result: data }, { headers });
  } catch (error) { return failure(error); }
}
