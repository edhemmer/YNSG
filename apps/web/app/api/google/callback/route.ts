import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { finishGoogle } from "../../../../lib/google-server";
import { callbackUri } from "../../../../lib/google-core";
export const runtime = "nodejs";
export async function GET(request: Request) {
  // Never render authorization codes, provider errors, or tokens into a page or log.
  if (!process.env.APP_ORIGIN)
    return NextResponse.json(
      { error: "GOOGLE_SETUP_REQUIRED" },
      { status: 503 },
    );
  let destination: URL;
  try {
    destination = new URL("/", callbackUri(process.env.APP_ORIGIN));
  } catch {
    return NextResponse.json({ error: "INVALID_APP_ORIGIN" }, { status: 503 });
  }
  const query = new URL(request.url).searchParams,
    state = query.get("state"),
    code = query.get("code");
  const cookie = (await cookies()).get("ynsg-google-oauth")?.value;
  let outcome = "failed";
  try {
    const [expected, nonce] = cookie?.split(".") || [];
    if (
      !state ||
      !code ||
      query.has("error") ||
      state !== expected ||
      !nonce ||
      state.length > 128 ||
      code.length > 4096
    )
      throw new Error("INVALID_CALLBACK");
    const organization = await finishGoogle(state, nonce, code);
    destination.searchParams.set('googleOrganization', organization);
    outcome = "connected";
  } catch {
    outcome = "failed";
  }
  destination.searchParams.set("google", outcome);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set("ynsg-google-oauth", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/google/callback",
    maxAge: 0,
  });
  return response;
}
