import { NextResponse } from "next/server";
import { authClient, saveSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") || "email";
  const redirectTo = new URL("/", url.origin);
  try {
    const client = authClient();
    const result = code
      ? await client.auth.exchangeCodeForSession(code)
      : tokenHash
        ? await client.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" })
        : { data: { session: null }, error: new Error("MISSING_CONFIRMATION") };
    if (result.error || !result.data.session) {
      redirectTo.searchParams.set("auth", "failed");
      return NextResponse.redirect(redirectTo);
    }
    const response = NextResponse.redirect(redirectTo);
    return saveSession(response, result.data.session);
  } catch {
    redirectTo.searchParams.set("auth", "failed");
    return NextResponse.redirect(redirectTo);
  }
}
