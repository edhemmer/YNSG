import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { syncGoogleCalendar } from "../../../../lib/google-sync";
import {verifyRoutesConnection} from '../../../../lib/routes-health';
import {store} from '../../../../lib/google-server';
import {calendarExportRun} from '../../../../lib/calendar-export-run';
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
  const org = z.uuid().safeParse(process.env.GOOGLE_WORKER_ORGANIZATION_ID);
  if (!org.success)
    return NextResponse.json(
      { error: "This connection needs setup." },
      { status: 503 },
    );
  try {
    const result=await calendarExportRun(process.env.GOOGLE_CALENDAR_WORKER_ENABLED==='true',{
      readConnection:async()=>Boolean((await store(org.data,'read')).encrypted_tokens),
      sync:()=>syncGoogleCalendar(org.data),
      checkMaps:()=>verifyRoutesConnection(org.data),
    });
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json(
      { error: "Calendar updates need attention." },
      { status: 503 },
    );
  }
}
