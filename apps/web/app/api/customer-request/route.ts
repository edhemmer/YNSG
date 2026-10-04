import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { customerRequestCommand } from "../../../../../packages/contracts/customer-actions";
import { serverDatabase } from "../../../lib/google-server";
import { hash } from "../../../lib/google-core";
import { sameOrigin } from "../../../lib/session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cookieName = "ynsg-request-access";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
const messages: Record<string, string> = {
  LINK_UNAVAILABLE:
    "This appointment link has expired or changed. Please contact the business for a new link.",
  TRY_LATER: "Please wait a minute before trying again.",
  STALE_REVISION:
    "Your appointment or response changed. Refresh the details before continuing.",
  IDEMPOTENCY_CONFLICT:
    "This retry has different details. Refresh before continuing.",
  RESCHEDULE_PENDING:
    "Your request for another time is already awaiting review.",
  TRANSITION: "This action is no longer available for the appointment.",
};
export function GET() {
  return NextResponse.json(
    { error: "Open your appointment email link to continue." },
    { status: 405, headers: { ...headers, Allow: "POST" } },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Request not accepted." },
      { status: 403, headers },
    );
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 8000)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413, headers },
      );
    const parsed = customerRequestCommand.safeParse(JSON.parse(text));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Check the appointment details and your message." },
        { status: 400, headers },
      );
    const command = parsed.data;
    const jar = await cookies();
    const token =
      command.operation === "open" ? command.token : jar.get(cookieName)?.value;
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
      return NextResponse.json(
        { error: messages.LINK_UNAVAILABLE },
        { status: 401, headers },
      );
    const db = serverDatabase(),
      tokenHash = hash(token);
    const result =
      command.operation === "action"
        ? await db.rpc("customer_request_action", {
            p_hash: tokenHash,
            p_input: command.input,
            p_key: command.key,
          })
        : await db.rpc("customer_request_context", { p_hash: tokenHash });
    if (result.error) {
      const code =
        Object.keys(messages).find((c) => result.error!.message === c) ||
        "UNAVAILABLE";
      return NextResponse.json(
        {
          error:
            messages[code] ||
            "We could not complete this action. Please try again or contact the business.",
        },
        {
          status:
            code === "TRY_LATER"
              ? 429
              : code === "LINK_UNAVAILABLE"
                ? 401
                : 409,
          headers,
        },
      );
    }
    const response = NextResponse.json(
      {
        ok: true,
        ...(command.operation === "action"
          ? { result: result.data }
          : { context: result.data }),
      },
      { headers },
    );
    if (command.operation === "open")
      response.cookies.set(cookieName, token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/api/customer-request",
        maxAge: Math.max(
          1,
          Math.floor((Date.parse(result.data.expiresAt) - Date.now()) / 1000),
        ),
      });
    return response;
  } catch {
    return NextResponse.json(
      {
        error:
          "We could not complete this action. Your appointment has not been canceled.",
      },
      { status: 503, headers },
    );
  }
}
