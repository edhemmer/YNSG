import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, sameOrigin, failure } from "../../../lib/session";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("invite"),
      organization: z.uuid(),
      customer: z.uuid(),
      email: z.email().max(254),
    })
    .strict(),
  z
    .object({
      action: z.literal("claim"),
      token: z
        .string()
        .regex(/^[A-Za-z0-9_-]{43}$/)
        .optional(),
    })
    .strict(),
]);
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Request not accepted." },
      { status: 403 },
    );
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 4096)
      return NextResponse.json({ error: "Invitation request too large." }, { status: 413, headers });
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return NextResponse.json({ error: "Check the invitation details." }, { status: 400, headers });
    const v = parsed.data;
    const { db } = await authenticated();
    if (v.action === "invite") {
      const origin = process.env.APP_ORIGIN;
      if (!origin || !/^https:\/\/[a-z0-9.-]+$/i.test(origin))
        return NextResponse.json({ error: "Invitation link delivery is unavailable. Contact support." }, { status: 503, headers });
      const token = randomBytes(32).toString("base64url");
      const hash = createHash("sha256").update(token).digest("hex");
      const r = await db.rpc("invite_customer_account", {
        p_org: v.organization,
        p_customer: v.customer,
        p_email: v.email,
        p_hash: hash,
      });
      if (r.error) throw r.error;
      const receipt = z.object({ expiresAt: z.iso.datetime({ offset: true }) }).passthrough().safeParse(r.data);
      if (!receipt.success)
        return NextResponse.json({ error: "Invitation status could not be confirmed. Contact support before sending another invitation." }, { status: 503, headers });
      return NextResponse.json(
        {
          url: origin + "/account#invite=" + token,
          expiresAt: receipt.data.expiresAt,
        },
        { headers },
      );
    }
    const token =
      v.token || (await cookies()).get("ynsg-account-invitation")?.value;
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("FAILED");
    const r = await db.rpc("claim_customer_account", {
      p_hash: createHash("sha256").update(token).digest("hex"),
    });
    if (r.error)
      return NextResponse.json(
        {
          error:
            "This invitation could not be connected. Sign in with the invited email, or ask the business for a new invitation.",
        },
        { status: 403, headers },
      );
    const claimed = z.object({ organization: z.uuid(), customer: z.uuid() }).passthrough().safeParse(r.data);
    if (!claimed.success)
      return NextResponse.json({ error: "Account link result could not be confirmed." }, { status: 503, headers });
    const response = NextResponse.json(claimed.data, { headers });
    response.cookies.set("ynsg-account-invitation", "", {
      httpOnly: true,
      path: "/api/account-link",
      maxAge: 0,
    });
    return response;
  } catch (e) {
    return failure(e);
  }
}

export async function GET() {
  try {
    await authenticated();
    return NextResponse.json(
      {
        pending: Boolean(
          (await cookies()).get("ynsg-account-invitation")?.value,
        ),
      },
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}
