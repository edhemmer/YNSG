import type { SupabaseClient } from "@supabase/supabase-js";
import { accessToken } from "./google-server";
import { emailRaw, sendEmail, GoogleFailure } from "./google-core";
type Intent = {
  id: string;
  object_id: string;
  kind: string;
  lease_token: string;
  payload: Record<string, unknown>;
};
export async function dispatchGoogleMail(org: string, db: SupabaseClient) {
  if (process.env.GOOGLE_GMAIL_DELIVERY_ENABLED !== "true")
    throw new GoogleFailure("CUSTOMER_DELIVERY_DISABLED");
  const { token, account } = await accessToken(org);
  if (account.gmail_test !== "accepted")
    throw new GoogleFailure("GMAIL_TEST_REQUIRED");
  const config = await db
    .from("configuration_versions")
    .select("settings")
    .eq("organization_id", org)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  if (
    config.error ||
    config.data.settings.sender?.toLowerCase() !== account.email?.toLowerCase()
  )
    throw new GoogleFailure("APPROVED_SENDER_REQUIRED");
  const { data, error } = await db.rpc("claim_outbox", {
    p_org: org,
    p_limit: 5,
  });
  if (error) throw new GoogleFailure("OUTBOX_UNAVAILABLE");
  const results = [];
  for (const item of (data || []) as Intent[]) {
    let to: string, subject: string, body: string;
    if (item.kind === "request.owner_notification") {
      to = config.data.settings.notificationRecipient;
      subject = "Your Neighborhood Service Guy New Request";
      body =
        "A new service request is saved in your CRM. Sign in to review it.\n" +
        process.env.APP_ORIGIN;
    } else {
      const appointment = await db
        .from("appointments")
        .select("request_id,arrival_at,timezone,status")
        .eq("organization_id", org)
        .eq("id", item.object_id)
        .single();
      if (appointment.error) continue;
      const request = await db
        .from("service_requests")
        .select("original_submission")
        .eq("organization_id", org)
        .eq("id", appointment.data.request_id)
        .single();
      if (request.error) continue;
      const when = new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: appointment.data.timezone,
      }).format(new Date(appointment.data.arrival_at));
      if (item.kind === "appointment.owner_approval") {
        to = config.data.settings.notificationRecipient;
        subject = "Your Neighborhood Service Guy New Request";
        body =
          "A proposed appointment needs your approval: " +
          when +
          ". Review the current request and expiry in the CRM.\n" +
          process.env.APP_ORIGIN;
      } else if (item.kind === "appointment.confirmation") {
        to = request.data.original_submission.email;
        subject = "Your appointment is confirmed";
        body =
          "Your Neighborhood Service Guy has confirmed your appointment for " +
          when +
          ". Call or text 770-630-2094 if you need assistance.";
      } else if (item.kind === "appointment.declined_time") {
        to = request.data.original_submission.email;
        subject = "Please choose another appointment time";
        body =
          "The requested time is unavailable. Your service request remains open. Please call or text 770-630-2094 to choose another time.";
      } else if (item.kind === "appointment.declined_service") {
        to = request.data.original_submission.email;
        subject = "Update on your service request";
        body =
          "We cannot accept the proposed service appointment. Please call or text 770-630-2094 with questions.";
      } else continue; // Reminder action links depend on the separate customer capability workflow.
    }
    let raw: string;
    try {
      raw = emailRaw(account.email!, to, subject, body, "ynsg-" + item.id);
    } catch {
      continue;
    }
    const begin = await db.rpc("begin_delivery", {
      p_org: org,
      p_id: item.id,
      p_lease: item.lease_token,
    });
    if (begin.error || begin.data?.status !== "sending") continue;
    let status = "needs_reconciliation",
      providerId: string | null = null;
    try {
      providerId = await sendEmail(token, raw);
      status = "accepted";
    } catch (e) {
      if (e instanceof GoogleFailure && e.status >= 400 && e.status < 500)
        status = "failed";
    }
    const finish = await db.rpc("finish_delivery", {
      p_org: org,
      p_id: item.id,
      p_lease: item.lease_token,
      p_status: status,
      p_provider_id: providerId,
      p_error: status === "accepted" ? null : "Google delivery requires review",
    });
    results.push({
      id: item.id,
      status: finish.error ? "needs_reconciliation" : status,
    });
  }
  return results;
}
