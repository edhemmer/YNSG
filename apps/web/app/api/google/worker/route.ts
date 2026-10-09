import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { syncGoogleCalendar } from "../../../../lib/google-sync";
import {verifyRoutesConnection} from '../../../../lib/routes-health';
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
    return NextResponse.json({ error: "Access is required." }, { status: 401 });
  if (process.env.GOOGLE_CALENDAR_WORKER_ENABLED !== "true")
    return NextResponse.json({ error: "Calendar updates are paused." }, { status: 503 });
  const org = z.uuid().safeParse(process.env.GOOGLE_WORKER_ORGANIZATION_ID);
  if (!org.success)
    return NextResponse.json(
      { error: "This connection needs setup." },
      { status: 503 },
    );
  try {
    const result = await syncGoogleCalendar(org.data);
    let maps='verification_unavailable';
    try{maps=await verifyRoutesConnection(org.data);}catch{console.error('routes_health_unavailable');}
    return NextResponse.json(
      { processed: result.results.length,maps },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Calendar updates need attention." },
      { status: 503 },
    );
  }
}
