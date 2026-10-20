import {ownerReturnTarget} from '../../../lib/email-links';
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { emailClient, saveEmailVerifier } from "../../../lib/email-auth";
import { signInTarget } from "../../../lib/sign-in-target";
import { authClient, saveSession } from "../../../lib/session";
import { recoveryDestination } from "../../../lib/auth-flow";

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
  let destination = (await cookies()).get("ynsg-auth-destination")?.value;
  let context:unknown=null;try{context=JSON.parse((await cookies()).get('ynsg-owner-request')?.value||'null');}catch{/* Invalid navigation hints never affect authentication. */}
  let target = ownerReturnTarget(signInTarget(destination, []),context);
  const redirect = (failed: boolean, code="expired") =>
    NextResponse.redirect(
      origin +
        (failed
          ? destination === "account"
            ? "/account?auth=failed#"
            : "/sign-in?"+new URLSearchParams({...((destination === "password" || tokenType === "recovery")?{mode:"reset"}:{}),error:code})
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
  if ((!code && !tokenHash) || (code && tokenHash) || (code && code.length > 2048) || (tokenHash && (tokenHash.length > 2048 || !['email','recovery'].includes(tokenType || '')))) return redirect(true);
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
    if (error || !data.session) {
      // A stale link or temporary provider failure must not destroy the newer
      // browser verifier. Only successful exchange clears it; it expires itself.
      const status=error && 'status' in error ? Number(error.status) : 0;
      return redirect(true,status===429?'limited':status&&![400,401,403,404,422].includes(status)?'unavailable':'expired');
    }
    destination = recoveryDestination(destination, code ? ('redirectType' in data ? data.redirectType as string | null : null) : tokenType);
    target = ownerReturnTarget(signInTarget(destination, []),context);
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
    return redirect(true,"unavailable");
  }
}
