import { NextResponse } from "next/server";
import { emailClient, saveEmailVerifier } from "../../../lib/email-auth";
import { sameOrigin, failure } from "../../../lib/session";
import {
  ownerGoogleEnabled,
  ownerAuthorizationUrl,
} from "../../../lib/owner-google-auth";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Request not accepted." },
      { status: 403 },
    );
  try {
    if (
      !(await ownerGoogleEnabled(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_PUBLISHABLE_KEY,
      ))
    )
      return NextResponse.json(
        {
          error:
            "Google sign-in needs the Google provider enabled in Supabase Authentication. Your existing email sign-in still works.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    const auth = await emailClient();
    const { data, error } = await auth.client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: process.env.APP_ORIGIN + "/auth/confirm",
        scopes: "openid email profile",
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data.url || !auth.currentVerifier())
      throw Error("GOOGLE_SIGN_IN_FAILED");
    const response = saveEmailVerifier(
      NextResponse.json(
        { url: ownerAuthorizationUrl(data.url, process.env.SUPABASE_URL!) },
        { headers: { "Cache-Control": "no-store" } },
      ),
      auth.currentVerifier(),
    );
    response.cookies.set("ynsg-auth-destination", "google-owner", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
    return response;
  } catch (e) {
    return failure(e);
  }
}
