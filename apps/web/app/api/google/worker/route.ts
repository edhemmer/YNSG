import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { syncGoogleCalendar } from "../../../../lib/google-sync";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.GOOGLE_WORKER_SECRET,
    provided = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (
    !secret ||
    secret.length < 32 ||
    !provided ||
    Buffer.byteLength(secret) !== Buffer.byteLength(provided) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(provided))
  )
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (process.env.GOOGLE_CALENDAR_WORKER_ENABLED !== "true")
    return NextResponse.json({ error: "WORKER_DISABLED" }, { status: 503 });
  const org = z.uuid().safeParse(process.env.GOOGLE_WORKER_ORGANIZATION_ID);
  if (!org.success)
    return NextResponse.json(
      { error: "WORKER_SETUP_REQUIRED" },
      { status: 503 },
    );
  try {
    const result = await syncGoogleCalendar(org.data);
    return NextResponse.json(
      { processed: result.results.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "SYNC_REQUIRES_ATTENTION" },
      { status: 503 },
    );
  }
}
