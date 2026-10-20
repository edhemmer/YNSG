import {ownerRequestContext} from './email-links';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  authClient,
  sameOrigin,
  saveSession,
  failure,
} from "./session";
import { emailClient, saveEmailVerifier } from "./email-auth";
import { authProviderFailure, passwordSignInFailure, passwordUpdateFailure } from "./auth-flow";
const emailAddress = z.string().trim().toLowerCase().pipe(z.email().max(254));
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), email: emailAddress, destination: z.enum(["owner", "account"]).optional(), requestContext:z.object({request:z.uuid(),organization:z.uuid()}).strict().optional() }),
  z.object({
    action: z.literal("verify"),
    email: emailAddress,
    code: z.string().regex(/^\d{6,10}$/),
  }),
  z.object({
    action: z.literal("password"),
    email: emailAddress,
    password: z.string().min(1).max(128),
  }),
  z.object({
    action: z.literal("signup"),
    email: emailAddress,
    password: z.string().min(10).max(128),
    invitation: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .optional(),
  }),
  z.object({ action: z.literal("recover"), email: emailAddress }),
  z.object({
    action: z.literal("set-password"),
    expectedUser: z.uuid().optional(),
    password: z.string().min(10).max(128),
  }),
  z.object({ action: z.literal("refresh") }),
  z.object({ action: z.literal("logout") }),
]);
export async function handleSessionPost(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Request not accepted.",code:"invalid_form" },
      { status: 403,headers:{"Cache-Control":"no-store"} },
    );
  try {
    const raw=await request.text();
    if(Buffer.byteLength(raw)>16000)return NextResponse.json({error:"Sign-in details are too long.",code:"invalid_form"},{status:413,headers:{"Cache-Control":"no-store"}});
    const value = input.parse(JSON.parse(raw));
    const db = authClient();
    if (value.action === "password") {
      try {
        const { data, error } = await db.auth.signInWithPassword({email:value.email,password:value.password});
        if(error||!data?.session){const failed=passwordSignInFailure(error);return NextResponse.json({error:failed.message,code:failed.code},{status:failed.status,headers:{"Cache-Control":"no-store"}});}
        return saveSession(NextResponse.json({ok:true}),data.session);
      }catch{const failed=passwordSignInFailure();return NextResponse.json({error:failed.message,code:failed.code},{status:failed.status,headers:{"Cache-Control":"no-store"}});}
    }
    if (value.action === "signup" || value.action === "recover") {
      const emailAuth = await emailClient();
      const callback = process.env.APP_ORIGIN + "/auth/confirm";
      const result =
        value.action === "signup"
          ? await emailAuth.client.auth.signUp({
              email: value.email,
              password: value.password,
              options: { emailRedirectTo: callback },
            })
          : await emailAuth.client.auth.resetPasswordForEmail(value.email, {
              redirectTo: callback,
            });
      if (result.error) {
        const failed = authProviderFailure(result.error, value.action === 'recover');
        return NextResponse.json(
          {
            error: failed.message,
            code: failed.status===429?"limited":"unavailable",
          },
          { status: failed.status, headers: { "Cache-Control": "no-store" } },
        );
      }
      const response = saveEmailVerifier(
        NextResponse.json({
          ok: true,
          message: "Check your email and open the newest link in this browser.",
        }),
        emailAuth.currentVerifier(),
      );
      if (value.action === "signup" && value.invitation)
        response.cookies.set("ynsg-account-invitation", value.invitation, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/api/account-link",
          maxAge: 86400,
        });
      response.cookies.set(
        "ynsg-auth-destination",
        value.action === "recover" ? "password" : "account",
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 3600,
        },
      );
      return response;
    }
    if (value.action === "set-password") {
      const jar=await cookies(),access=jar.get("ynsg-access")?.value,refresh=jar.get("ynsg-refresh")?.value;
      if(!refresh)throw new Error("UNAUTHORIZED");
      // setSession refreshes an expired access token. With a missing short-lived
      // access cookie, renew directly from the existing HttpOnly refresh cookie.
      const bound=access?await db.auth.setSession({access_token:access,refresh_token:refresh}):await db.auth.refreshSession({refresh_token:refresh});
      if(bound.error||!bound.data.session){
        if(bound.error&&![400,401,403].includes(bound.error.status||0))throw new Error("AUTH_UNAVAILABLE");
        throw new Error("UNAUTHORIZED");
      }
      const identity=await db.auth.getUser(bound.data.session.access_token);
      if(identity.error&&![400,401,403].includes(identity.error.status||0))throw new Error("AUTH_UNAVAILABLE");
      if(identity.error||!identity.data.user?.email_confirmed_at)throw new Error("UNAUTHORIZED");
      const actor=identity.data.user.id;
      if(value.expectedUser&&actor!==value.expectedUser)throw new Error("UNAUTHORIZED");
      let result;
      try{result=await db.auth.updateUser({password:value.password});}
      catch{const failed=passwordUpdateFailure();return saveSession(NextResponse.json({error:failed.message,code:failed.code},{status:failed.status,headers:{"Cache-Control":"no-store"}}),bound.data.session);}
      if(result.error){const failed=passwordUpdateFailure(result.error);return saveSession(NextResponse.json({error:failed.message,code:failed.code},{status:failed.status,headers:{"Cache-Control":"no-store"}}),bound.data.session);}
      // Never claim a definite failure or automatically repeat a password update
      // after the provider accepted it but the response/session is uncertain.
      let session;try{session=(await db.auth.getSession()).data.session;}catch{session=null;}
      if(!session||session.user.id!==actor||result.data.user?.id!==actor)return NextResponse.json({error:"The password change could not be confirmed. Try signing in with the new password before requesting another reset.",code:"password_uncertain"},{status:503,headers:{"Cache-Control":"no-store"}});
      return saveSession(NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}}),session);
    }
    if (value.action === "send") {
      const emailAuth = await emailClient();
      const { error } = await emailAuth.client.auth.signInWithOtp({
        email: value.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: process.env.APP_ORIGIN + "/auth/confirm",
        },
      });
      if (error) {
        const limited =
          error.status === 429 ||
          error.code === "over_email_send_rate_limit" ||
          error.code === "over_request_rate_limit";
        return NextResponse.json(
          {
            error: limited
              ? "The email provider has temporarily limited sign-in emails. Check your inbox for the newest message already sent and open its link in the browser where you requested it. If it has expired, wait before requesting another email."
              : "Email sign-in is unavailable. Check workspace email setup or try again later.",
          },
          {
            status: limited ? 429 : 503,
            headers: { "Cache-Control": "no-store" },
          },
        );
      }
      const response = saveEmailVerifier(
        NextResponse.json({
          ok: true,
          message:
            "Open the newest email link in this same browser. If your email includes a numeric code, you can enter it here instead.",
        }),
        emailAuth.currentVerifier(),
      );
      response.cookies.set("ynsg-auth-destination", value.destination || "owner", {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "lax", path: "/", maxAge: 3600,
      });
      const context=value.destination==='owner'?ownerRequestContext(value.requestContext):null;
      if(context)response.cookies.set('ynsg-owner-request',JSON.stringify(context),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:3600});
      else response.cookies.delete('ynsg-owner-request');
      return response;
    }
    if (value.action === "verify") {
      const { data, error } = await db.auth.verifyOtp({
        email: value.email,
        token: value.code,
        type: "email",
      });
      if (error || !data.session) {
        return NextResponse.json(
          { error: "That code is invalid or expired. Request a new code." },
          { status: 400 },
        );
      }
      return saveEmailVerifier(
        saveSession(NextResponse.json({ ok: true }), data.session),
        null,
      );
    }
    if (value.action === "refresh") {
      const refresh = (await cookies()).get("ynsg-refresh")?.value;
      if (!refresh) throw new Error("UNAUTHORIZED");
      const { data, error } = await db.auth.refreshSession({
        refresh_token: refresh,
      });
      if (error || !data.session) {
        const rejected = !error || [400, 401, 403].includes(error.status || 0);
        const response = NextResponse.json(
          {
            error: rejected
              ? "Your saved sign-in has expired. Sign in once to continue."
              : "Your sign-in could not be renewed right now. Please try again; no new email is needed.",
          },
          {
            status: rejected ? 401 : 503,
            headers: { "Cache-Control": "no-store" },
          },
        );
        if (rejected) {
          response.cookies.delete("ynsg-access");
          response.cookies.delete("ynsg-refresh");
        }
        return response;
      }
      return saveSession(NextResponse.json({ ok: true }), data.session);
    }
    const jar = await cookies();
    const access = jar.get("ynsg-access")?.value,
      refresh = jar.get("ynsg-refresh")?.value;
    if (access && refresh) {
      await db.auth.setSession({
        access_token: access,
        refresh_token: refresh,
      });
      await db.auth.signOut({ scope: "local" });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.delete("ynsg-access");
    response.cookies.delete("ynsg-refresh");
    return saveEmailVerifier(response, null);
  } catch (error) {
    return failure(error);
  }
}
