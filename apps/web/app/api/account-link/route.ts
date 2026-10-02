import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, sameOrigin, failure } from "../../../lib/session";
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
    const v = schema.parse(await request.json());
    const { db } = await authenticated();
    if (v.action === "invite") {
      const token = randomBytes(32).toString("base64url");
      const hash = createHash("sha256").update(token).digest("hex");
      const r = await db.rpc("invite_customer_account", {
        p_org: v.organization,
        p_customer: v.customer,
        p_email: v.email,
        p_hash: hash,
      });
      if (r.error) throw r.error;
      return NextResponse.json(
        {
          url: process.env.APP_ORIGIN + "/account#invite=" + token,
          expiresAt: r.data.expiresAt,
        },
        {
          headers: {
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          },
        },
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
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    const response = NextResponse.json(r.data, {
      headers: { "Cache-Control": "no-store" },
    });
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
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
