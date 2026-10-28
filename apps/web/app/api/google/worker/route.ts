import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { syncGoogleCalendar } from "../../../../lib/google-sync";
import {verifyRoutesConnection} from '../../../../lib/routes-health';
import {store,accessToken} from '../../../../lib/google-server';
import {busyTimes} from '../../../../lib/google-core';
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
      readConnection:async()=>{
        const connection=await store(org.data,'read');
        if(!connection.encrypted_tokens || !connection.calendar_id)return false;
        const {token,account}=await accessToken(org.data);
        try {
          await busyTimes(token,account.calendar_id!,new Date().toISOString(),new Date(Date.now()+3600000).toISOString());
          await store(org.data,'health',{revision:account.revision,health:'healthy'});
          return true;
        }catch(error){
          const health=error instanceof Error&&['RECONNECT_REQUIRED','PERMISSION_OR_API_REQUIRED'].includes(error.message)?error.message.toLowerCase():'provider_error';
          await store(org.data,'health',{revision:account.revision,health});
          throw error;
        }
      },
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
