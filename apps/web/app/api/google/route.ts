import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin } from "../../../lib/session";
import {
  authorizeGoogle,
  missingGoogleConfiguration,
  publicAccount,
  store,
  startGoogle,
  accessToken,
  disconnectGoogle,
} from "../../../lib/google-server";
import {
  ownedCalendars,
  busyTimes,
  emailRaw,
  sendEmail,
  GoogleFailure,
  callbackUri,
} from "../../../lib/google-core";
import { syncGoogleCalendar } from "../../../lib/google-sync";
import { dispatchGoogleMail } from "../../../lib/google-mail";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect"), organization: z.uuid() }),
  z.object({ action: z.literal("health"), organization: z.uuid() }),
  z.object({ action: z.literal("calendars"), organization: z.uuid() }),
  z.object({
    action: z.literal("calendar"),
    organization: z.uuid(),
    calendarId: z.string().min(1).max(1024),
  }),
  z.object({ action: z.literal("disconnect"), organization: z.uuid() }),
  z.object({
    action: z.literal("test_email"),
    organization: z.uuid(),
    key: z.uuid(),
  }),
  z.object({ action: z.literal("sync"), organization: z.uuid() }),
  z.object({ action: z.literal("send_pending"), organization: z.uuid() }),
]);
function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function failed(error: unknown) {
  if(error instanceof Error&&error.message==='UNAUTHORIZED')return json({error:'UNAUTHORIZED'},401);
  const code =
    error instanceof GoogleFailure ? error.code : "GOOGLE_ACTION_FAILED";
  return json({ error: code }, code === "OWNER_MFA_REQUIRED" ? 403 : 400);
}
export async function GET(request: Request) {
  try {
    const org = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("organization"));
    await authorizeGoogle(org);
    const missing = missingGoogleConfiguration();
    return json({
      missing,
      redirectUri: process.env.APP_ORIGIN
        ? callbackUri(process.env.APP_ORIGIN)
        : null,
      connection: missing.length
        ? null
        : publicAccount(await store(org, "read")),
    });
  } catch (error) {
    return failed(error);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "ORIGIN_REJECTED" }, 403);
  try {
    if (Number(request.headers.get("content-length") || 0) > 8192)
      return json({ error: "REQUEST_TOO_LARGE" }, 413);
    const body = await request.text();
    if (Buffer.byteLength(body) > 8192)
      return json({ error: "REQUEST_TOO_LARGE" }, 413);
    const value = input.parse(JSON.parse(body)),
      org = value.organization,
      { user, db } = await authorizeGoogle(org);
    if (value.action === "connect") {
      const result = await startGoogle(org),
        response = json({ url: result.url });
      response.cookies.set(
        "ynsg-google-oauth",
        result.state + "." + result.nonce,
        {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/api/google/callback",
          maxAge: 600,
        },
      );
      return response;
    }
    if (value.action === "disconnect")
      return json(await disconnectGoogle(org, user.id));
    if (value.action === "sync") return json(await syncGoogleCalendar(org));
    if (value.action === "send_pending")
      return json({ deliveries: await dispatchGoogleMail(org, db) });
    const { token, account } = await accessToken(org);
    if (value.action === "calendars")
      return json({ calendars: await ownedCalendars(token) });
    if (value.action === "calendar") {
      const selected = (await ownedCalendars(token)).find(
        (c) => c.id === value.calendarId,
      );
      if (!selected) throw new GoogleFailure("OWNED_CALENDAR_REQUIRED");
      await busyTimes(
        token,
        selected.id,
        new Date().toISOString(),
        new Date(Date.now() + 3600000).toISOString(),
      );
      return json({
        connection: publicAccount(
          await store(org, "calendar", {
            revision: account.revision,
            calendarId: selected.id,
            actor: user.id,
          }),
        ),
      });
    }
    if (value.action === "health") {
      try {
        const calendars = await ownedCalendars(token);
        if (account.calendar_id) {
          if (!calendars.some((c) => c.id === account.calendar_id))
            throw new GoogleFailure("CALENDAR_ACCESS_LOST");
          await busyTimes(
            token,
            account.calendar_id,
            new Date().toISOString(),
            new Date(Date.now() + 3600000).toISOString(),
          );
        }
        return json({
          connection: publicAccount(
            await store(org, "health", {
              revision: account.revision,
              health: account.calendar_id ? "healthy" : "calendar_required",
            }),
          ),
        });
      } catch (error) {
        await store(org, "health", {
          revision: account.revision,
          health:
            error instanceof GoogleFailure
              ? error.code.toLowerCase()
              : "provider_error",
        });
        throw error;
      }
    }
    if (value.action === "test_email") {
      const sending = await store(org, "test_begin", {
        revision: account.revision,
        key: value.key,
      });
      if (sending.replay)
        return json({ connection: publicAccount(sending), replay: true });
      let result = "unknown";
      try {
        await sendEmail(
          token,
          emailRaw(
            account.email!,
            account.email!,
            "YNSG Gmail connection test",
            "This message tests the CRM Gmail connection. Your existing website email has not been changed.",
            "ynsg-test-" + value.key,
          ),
        );
        result = "accepted";
      } catch (error) {
        if (
          error instanceof GoogleFailure &&
          error.status >= 400 &&
          error.status < 500
        )
          result = "failed";
      }
      const updated = await store(org, "test_finish", {
        revision: sending.revision,
        key: value.key,
        result,
      });
      return json({ connection: publicAccount(updated) });
    }
  } catch (error) {
    return failed(error);
  }
}
