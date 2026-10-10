import {dispatchSampleMail} from './sample-mail';
import {delayMessage} from './delay-message';
import {ownerRequestUrl} from './email-links';
import {customerRequestEmail} from '../../../lib/customer-request-email.js';
import {emailIdentity} from '../../../lib/email-layout.js';
import type { SupabaseClient } from "@supabase/supabase-js";
import { accessToken } from "./google-server";
import { emailRaw, sendEmail, GoogleFailure, hash } from "./google-core";
import { customerLinkToken, customerLinkUrl } from "./customer-links";
import {
  appointmentMessage,
  type AppointmentMessageInput,
} from "./appointment-message";
import { invoicePdf } from "./invoice-pdf";
import { invoiceDocument } from "./invoice-document";
import { paidInvoiceMessage } from "./paid-invoice-message";
import { invoiceMessage } from "./invoice-message";
import { requestDeclinedMessage } from "./request-message";
import { ownerRequestEmail } from "../../../lib/owner-request-email.js";
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
  const identity=emailIdentity(config.data.settings,org);
  const { data, error } = await db.rpc("claim_outbox", {
    p_org: org,
    p_limit: 5,
  });
  if (error) throw new GoogleFailure("OUTBOX_UNAVAILABLE");
  const results = [];
  for (const item of (data || []) as Intent[]) {
    let to: string, subject: string, body: string;
    let html: string | undefined, replyTo: string | undefined = config.data.settings.notificationRecipient;
    let attachment: {filename:string;bytes:Uint8Array} | undefined;
    if (item.kind === "request.owner_notification") {
      to = config.data.settings.notificationRecipient;
      subject = config.data.settings.displayName + " New Request";
      const request = await db.from("service_requests").select("original_submission")
        .eq("organization_id", org).eq("id", item.object_id).single();
      if (request.error || !request.data?.original_submission) continue;
      const submission = request.data.original_submission;
      const selections = submission.services?.length ? submission.services
        : [{ service: submission.service || "Work details require review", task: submission.task || "Not sure yet" }];
      const ownerUrl = ownerRequestUrl(process.env.APP_ORIGIN!,item.object_id,org);
      const rendered = ownerRequestEmail(submission, selections, item.object_id,
        config.data.settings.displayName, "", ownerUrl,identity);
      body = rendered.text;
      html = rendered.html;
      replyTo = submission.email;
    } else if (item.kind === "request.customer_receipt") {
      const request=await db.from("service_requests").select("original_submission").eq("organization_id",org).eq("id",item.object_id).single();
      if(request.error||!request.data?.original_submission||request.data.original_submission.email!==item.payload.recipient)continue;
      ({to,subject,body,html}=customerRequestEmail(config.data.settings.displayName,request.data.original_submission,identity));
    } else if (item.kind === "invoice.delivery" || item.kind === "invoice.paid") {
      const invoice = await db.from("invoices").select("number,issued_at,total_cents,snapshot,payments(cents)")
        .eq("organization_id", org).eq("id", item.object_id).single();
      if(invoice.error) continue;
      try {
        const document = invoiceDocument(invoice.data);
        const administration=await db.rpc("invoice_mail_admin",{p_org:org,p_invoice:item.object_id});if(administration.error)throw Error("INVOICE_ADMIN_UNAVAILABLE");document.dueDate=administration.data?.dueDate||null;
        const rendered = item.kind === "invoice.paid" ? paidInvoiceMessage(document,item.payload.review,identity) : invoiceMessage(document,identity);
        if(rendered.to !== item.payload.recipient) continue;
        ({to,subject,body,html} = rendered);
        if(item.kind === "invoice.delivery") attachment = {filename:`invoice-${document.number}.pdf`,bytes:await invoicePdf(document)};
      } catch { continue; }
    } else if (item.kind === "request.declined") {
      const request = await db.from("service_requests").select("original_submission")
        .eq("organization_id", org).eq("id", item.object_id).single();
      if (request.error || request.data.original_submission.email !== item.payload.recipient) continue;
      ({ to, subject, body, html } = requestDeclinedMessage(config.data.settings.displayName, request.data.original_submission,identity));
    } else if(item.kind==='appointment.delay_notice'){
      const appointment=await db.from('appointments').select('request_id,timezone,status,revision').eq('organization_id',org).eq('id',item.object_id).single();
      if(appointment.error||appointment.data.status!=='reserved'||appointment.data.revision!==item.payload.appointmentRevision)continue;
      const request=await db.from('service_requests').select('original_submission').eq('organization_id',org).eq('id',appointment.data.request_id).single();
      if(request.error||request.data.original_submission.email!==item.payload.recipient)continue;
      try{({to,subject,body,html}=delayMessage(config.data.settings.displayName,request.data.original_submission.email,request.data.original_submission.name,String(item.payload.eta),appointment.data.timezone,identity));}catch{continue;}
    } else {
      const supported = [
        "appointment.owner_approval",
        "appointment.confirmation",
        "appointment.reminder",
        "appointment.owner_reminder",
        "appointment.owner_confirmation",
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
        "appointment.owner_confirmation",
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
      const ownerUrl = ownerRequestUrl(process.env.APP_ORIGIN!,appointment.data.request_id,org);
      const rendered = appointmentMessage({
        kind: item.kind as AppointmentMessageInput["kind"],
        company: config.data.settings.displayName,
        identity,
        recipient,
        notificationRecipient: config.data.settings.notificationRecipient,
        request: request.data.original_submission,
        arrivalAt: appointment.data.arrival_at,
        timezone: appointment.data.timezone,
        ownerUrl,
        ...(link || {}),
        ...(preference ? { preference } : {}),
        ...(typeof item.payload.reason === "string"
          ? { reason: item.payload.reason }
          : {}),
      });
      ({ to, subject, body, html } = rendered);
    }
    let raw: string;
    try {
      raw = emailRaw(account.email!, to, subject, body, "ynsg-" + item.id, {
        fromName: config.data.settings.displayName,
        ...(html === undefined ? {} : { html }),
        ...(replyTo === undefined ? {} : { replyTo }),
        ...(attachment === undefined ? {} : { attachment }),
      });
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
  results.push(...await dispatchSampleMail(org,db,token,account.email!,config.data.settings,results.length?1:3));
  return results;
}
