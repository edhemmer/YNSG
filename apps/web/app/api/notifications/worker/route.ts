import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverDatabase } from "../../../../lib/google-server";
import { dispatchGoogleMail } from "../../../../lib/google-mail";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function run(request: Request) {
  const secret =
    request.method === "GET"
      ? process.env.CRON_SECRET
      : process.env.GOOGLE_WORKER_SECRET || process.env.CRON_SECRET;
  const provided = request.headers
    .get("authorization")
    ?.replace(/^Bearer /, "");
  const headers = { "Cache-Control": "private, no-store" };
  if (
    !secret ||
    secret.length < 32 ||
    !provided ||
    Buffer.byteLength(secret) !== Buffer.byteLength(provided) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(provided))
  )
    return NextResponse.json(
      { error: "Access is required." },
      { status: 401, headers },
    );
  if (process.env.GOOGLE_GMAIL_DELIVERY_ENABLED !== "true")
    return NextResponse.json(
      { error: "Email delivery is paused." },
      { status: 503, headers },
    );
  let db: ReturnType<typeof serverDatabase>;
  let claimed;
  try {
    db = serverDatabase();
    claimed = await db.rpc("claim_mail_company");
  } catch {
    return NextResponse.json(
      { error: "This connection needs setup." },
      { status: 503, headers },
    );
  }
  if (claimed.error)
    return NextResponse.json(
      { error: "This service is temporarily unavailable." },
      { status: 503, headers },
    );
  if (!claimed.data) return NextResponse.json({ processed: 0 }, { headers });
  const company = claimed.data;
  try {
    const results = await dispatchGoogleMail(company.organization, db);
    return NextResponse.json(
      {
        processed: results.length,
        needsAttention: results.filter((r) => r.status !== "accepted").length,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Email delivery needs attention." },
      { status: 503, headers },
    );
  } finally {
    await db.rpc("finish_mail_company", {
      p_org: company.organization,
      p_lease: company.lease,
    });
  }
}
export const POST = run;
export const GET = run;
