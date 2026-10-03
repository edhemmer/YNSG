import type { SupabaseClient } from "@supabase/supabase-js";
import { accessToken } from "./google-server";
import { emailRaw, sendEmail, GoogleFailure, hash } from "./google-core";
import { customerLinkToken, customerLinkUrl } from "./customer-links";
import {
  appointmentMessage,
  type AppointmentMessageInput,
} from "./appointment-message";
import { requestDeclinedMessage } from "./request-message";
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
      subject = config.data.settings.displayName + " New Request";
      body =
        "A new service request is saved in your CRM. Sign in to review it.\n" +
        process.env.APP_ORIGIN;
    } else if (item.kind === "request.declined") {
      const request = await db.from("service_requests").select("original_submission")
        .eq("organization_id", org).eq("id", item.object_id).single();
      if (request.error || request.data.original_submission.email !== item.payload.recipient) continue;
      ({ to, subject, body } = requestDeclinedMessage(config.data.settings.displayName, request.data.original_submission));
    } else {
      const supported = [
        "appointment.owner_approval",
        "appointment.confirmation",
        "appointment.reminder",
        "appointment.owner_reminder",
        "appointment.declined_time",
        "appointment.declined_service",
        "appointment.reschedule_requested",
      ];
      if (!supported.includes(item.kind)) continue;
      const appointment = await db
        .from("appointments")
        .select(
          "request_id,arrival_at,timezone,status,revision,response_version",
        )
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
      let link:
        | { manageUrl: string; confirmUrl: string; rescheduleUrl: string }
        | undefined;
      let recipient = request.data.original_submission.email;
      if (
        ![
          "appointment.owner_approval",
          "appointment.owner_reminder",
          "appointment.reschedule_requested",
        ].includes(item.kind)
      ) {
        const tokenValue = customerLinkToken(
          org,
          item.id,
          appointment.data.revision,
          process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || "",
        );
        const issued = await db.rpc("issue_customer_request_link", {
          p_org: org,
          p_outbox: item.id,
          p_lease: item.lease_token,
          p_hash: hash(tokenValue),
        });
        if (issued.error) continue;
        recipient = issued.data.recipient;
        link = {
          manageUrl: customerLinkUrl(process.env.APP_ORIGIN!, tokenValue),
          confirmUrl: customerLinkUrl(
            process.env.APP_ORIGIN!,
            tokenValue,
            "confirm",
          ),
          rescheduleUrl: customerLinkUrl(
            process.env.APP_ORIGIN!,
            tokenValue,
            "reschedule",
          ),
        };
      }
      let preference: AppointmentMessageInput["preference"];
      if (item.kind === "appointment.reschedule_requested") {
        const saved = await db
          .from("customer_schedule_preferences")
          .select("preferred_local_start,note")
          .eq("organization_id", org)
          .eq("id", item.payload.preferenceId)
          .eq("status", "pending")
          .maybeSingle();
        if (saved.error || !saved.data) continue;
        preference = saved.data;
      }
      const ownerUrl = new URL(process.env.APP_ORIGIN!);
      ownerUrl.searchParams.set("request", appointment.data.request_id);
      const rendered = appointmentMessage({
        kind: item.kind as AppointmentMessageInput["kind"],
        company: config.data.settings.displayName,
        recipient,
        notificationRecipient: config.data.settings.notificationRecipient,
        request: request.data.original_submission,
        arrivalAt: appointment.data.arrival_at,
        timezone: appointment.data.timezone,
        ownerUrl: ownerUrl.toString(),
        ...(link || {}),
        ...(preference ? { preference } : {}),
        ...(typeof item.payload.reason === "string"
          ? { reason: item.payload.reason }
          : {}),
      });
      ({ to, subject, body } = rendered);
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
