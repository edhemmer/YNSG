import {ownerReturnTarget} from '../../../lib/email-links';
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { emailClient, saveEmailVerifier } from "../../../lib/email-auth";
import { signInTarget } from "../../../lib/sign-in-target";
import { authClient, saveSession } from "../../../lib/session";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const tokenType = params.get("type");
  const origin = process.env.APP_ORIGIN;
  if (!origin)
    return new NextResponse("Sign-in is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  const destination = (await cookies()).get("ynsg-auth-destination")?.value;
  let context:unknown=null;try{context=JSON.parse((await cookies()).get('ynsg-owner-request')?.value||'null');}catch{/* Invalid navigation hints never affect authentication. */}
  let target = ownerReturnTarget(signInTarget(destination, []),context);
  const redirect = (failed: boolean) =>
    NextResponse.redirect(
      origin +
        (failed
          ? ["account", "password"].includes(destination || "")
            ? "/account?auth=failed#"
            : "/owner?auth=failed#"
          : target + "#"),
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  // Supabase can send either a PKCE code or a token-hash verification link,
  // depending on the configured email template. Support both so recovery and
  // sign-in links work consistently across production templates.
  if ((!code && !tokenHash) || (code && code.length > 2048) || (tokenHash && tokenHash.length > 2048)) return redirect(true);
  try {
    const auth = await emailClient();
    const result = code
      ? auth.currentVerifier()
        ? await auth.client.auth.exchangeCodeForSession(code)
        : { data: { session: null }, error: new Error("PKCE verifier missing") }
      : await auth.client.auth.verifyOtp({
        token_hash: tokenHash!,
        type: tokenType === "recovery" ? "recovery" : "email",
      });
    const { data, error } = result;
    if (error || !data.session) return saveEmailVerifier(redirect(true), null);
    if (!destination) {
      const membership = await authClient(data.session.access_token).from('memberships')
        .select('role,revoked_at').eq('user_id', data.session.user.id);
      target = ownerReturnTarget(signInTarget(undefined, membership.error ? [] : membership.data || []),context);
    }
    const response = saveEmailVerifier(
      saveSession(redirect(false), data.session),
      null,
    );
    response.cookies.delete("ynsg-auth-destination");
    response.cookies.delete("ynsg-owner-request");
    return response;
  } catch {
    return saveEmailVerifier(redirect(true), null);
  }
}
