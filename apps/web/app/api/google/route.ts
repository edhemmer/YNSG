import {emailIdentity} from '../../../../../lib/email-layout.js';
import {googleTestMessage} from '../../../lib/google-test-message';
import { publicError } from "../../../lib/public-errors";
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
  calendarCreation,
} from "../../../lib/google-server";
import {
  ownedCalendars,
  busyTimes,
  emailRaw,
  sendEmail,
  GoogleFailure,
  callbackUri,
  createBusinessCalendar,
  CALENDAR_CREATION_SCOPE,
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
  z.object({ action: z.literal("create_calendar"), organization: z.uuid() }).strict(),
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
  z.object({action:z.literal('enable_delivery'),organization:z.uuid(),revision:z.number().int().positive(),configurationVersion:z.number().int().positive(),testKey:z.uuid(),receiptConfirmed:z.literal(true),key:z.string().min(16).max(128)}).strict(),
  z.object({action:z.literal('disable_delivery'),organization:z.uuid(),key:z.string().min(16).max(128)}).strict(),
]);
function json(value: unknown, status = 200) {
  if (value && typeof value === "object" && "error" in value) value = { ...value, error: publicError((value as {error:unknown}).error, "Google could not complete this action. Please try again in Settings.") };
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function failed(error: unknown) {
  if(error instanceof Error&&error.message==='UNAUTHORIZED')return json({error:'UNAUTHORIZED'},401);
  const code =
    error instanceof GoogleFailure ? error.code : "GOOGLE_ACTION_FAILED";
  return json({ error: code }, code === "OWNER_ACCESS_REQUIRED" ? 403 : 400);
}
export async function GET(request: Request) {
  try {
    const org = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("organization"));
    const {db}=await authorizeGoogle(org);
    const missing = missingGoogleConfiguration();
    const account = missing.length ? null : await store(org, "read");
    const maps=await db.from('integration_connections').select('status,last_success_at,last_error').eq('organization_id',org).eq('provider','maps').maybeSingle();
    if(maps.error)throw new GoogleFailure('GOOGLE_ACTION_FAILED');
    return json({
      missing,
      creation: account?.encrypted_tokens ? await calendarCreation(org, "read") : null,
      delivery:(await db.rpc('mail_delivery_status',{p_org:org})).data,
      dispatcherEnabled:process.env.GOOGLE_GMAIL_DELIVERY_ENABLED==='true',
      calendarSyncEnabled:process.env.GOOGLE_CALENDAR_WORKER_ENABLED==='true',
      maps:{keyConfigured:Boolean(process.env.GOOGLE_ROUTES_API_KEY),connection:maps.data},
      redirectUri: process.env.APP_ORIGIN
        ? callbackUri(process.env.APP_ORIGIN)
        : null,
      connection: account ? publicAccount(account) : null,
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
    if(value.action==='enable_delivery'||value.action==='disable_delivery'){
      const enabled=value.action==='enable_delivery';
      const result=await db.rpc('configure_mail_delivery',{p_org:org,p_enable:enabled,p_revision:enabled?value.revision:null,p_test:enabled?value.testKey:null,p_configuration:enabled?value.configurationVersion:null,p_key:value.key});
      if(result.error)return json({error:['STALE_CONNECTION','RECEIPT_REVIEW_REQUIRED','SETUP_REQUIRED'].includes(result.error.message)?result.error.message:'DELIVERY_SETUP_FAILED'},409);
      return json({delivery:(await db.rpc('mail_delivery_status',{p_org:org})).data,dispatcherEnabled:process.env.GOOGLE_GMAIL_DELIVERY_ENABLED==='true'});
    }
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
    if (value.action === "create_calendar") {
      if (!account.scopes.includes(CALENDAR_CREATION_SCOPE)) throw new GoogleFailure("CALENDAR_CREATION_PERMISSION_REQUIRED");
      const intent = await calendarCreation(org, "begin", {revision: account.revision});
      if (!intent) throw new GoogleFailure("CONNECTION_STORAGE_FAILED");
      if (!intent.create) return json({creation: intent});
      let result: "created" | "unknown" | "failed" = "unknown";
      let created: {id: string; summary: string; timeZone: string} | undefined;
      try {
        created = await createBusinessCalendar(token, intent.summary, intent.timeZone!);
        result = "created";
      } catch (error) {
        // Only explicit rejection permits a subsequent creation attempt.
        if (error instanceof GoogleFailure && ((error.status >= 400 && error.status < 500) || ["INVALID_CALENDAR_NAME", "INVALID_TIMEZONE"].includes(error.code))) result = "failed";
      }
      const creation = await calendarCreation(org, "finish", {subject: intent.subject, operationId: intent.operationId, result, calendarId: created?.id});
      return json({creation});
    }
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
      const [config,company]=await Promise.all([
        db.from('configuration_versions').select('settings').eq('organization_id',org).order('version',{ascending:false}).limit(1).maybeSingle(),
        db.from('organizations').select('display_name').eq('id',org).single(),
      ]);
      if(config.error||company.error)throw new GoogleFailure('GOOGLE_SETUP_REQUIRED');
      const companyName=config.data?.settings.displayName||company.data.display_name;
      const rendered=googleTestMessage(companyName,emailIdentity(config.data?.settings,org));
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
            rendered.subject,
            rendered.body,
            "ynsg-test-" + value.key,
            { fromName:companyName, html:rendered.html },
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
