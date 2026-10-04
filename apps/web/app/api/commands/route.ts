import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, sameOrigin, failure } from "../../../lib/session";
const base = { organizationId: z.uuid(), key: z.string().min(16).max(128) };
const command = z.discriminatedUnion("command", [
  z.object({
    ...base,
    command: z.literal("ReviewRequest"),
    id: z.uuid(),
    revision: z.number().int().positive(),
    status: z.enum(["reviewing", "declined", "canceled"]),
  }),
  z.object({
    ...base,
    command: z.literal("PublishQuote"),
    id: z.uuid(),
    revision: z.number().int().positive(),
    scope: z.string().min(10).max(5000),
    minutes: z.number().int().min(120).max(1440).multipleOf(30),
    community: z.boolean(),
    eligibilityReviewed: z.boolean(),
    customerId: z.uuid().nullable(),
  }),
  z.object({
    ...base,
    command: z.literal("ApproveQuote"),
    id: z.uuid(),
    version: z.number().int().positive(),
    evidence: z.string().min(10).max(2000),
  }),
  z.object({
    ...base,
    command: z.literal("CompleteServiceCall"),
    id: z.uuid(),
    revision: z.number().int().positive(),
  }),
  z.object({
    ...base,
    command: z.literal("ApproveInvoice"),
    id: z.uuid(),
    revision: z.number().int().positive(),
    totalCents: z.number().int().min(0).max(999999999),
    reviewed: z.literal(true),
  }),
  z.object({
    ...base,
    command: z.literal("RecordPayment"),
    id: z.uuid(),
    cents: z.number().int().positive().max(999999999),
    method: z.enum(["cash", "zelle"]),
    reference: z.string().min(1).max(300),
    receivedAt: z.iso.datetime(),
    confirmed: z.literal(true),
  }),
  z.object({
    ...base, command: z.literal("RecordBusinessExpense"),
    date: z.iso.date(), vendor: z.string().trim().min(2).max(160),
    category: z.enum(["tools","fuel","supplies","vehicle","insurance","marketing","software","other"]),
    description: z.string().trim().min(3).max(500),
    cents: z.number().int().positive().max(999999999),
    method: z.enum(["cash","zelle","external_card","external_transfer","other"]),
    reference: z.string().trim().min(1).max(160), confirmed: z.literal(true),
  }),
  z.object({
    ...base, command: z.literal("ReverseBusinessExpense"),
    id: z.uuid(), reason: z.string().trim().min(5).max(500),
  }),
]);
const messages: Record<string, string> = {
  INVOICE_REVIEW_REQUIRED: "Review the saved invoice before approving it.",
  INVOICE_DRAFT_REQUIRED: "Save the invoice draft before approving it.",
  INVOICE_TOTAL_CHANGED:
    "The invoice charges changed. Reload and review the draft.",
  INVOICE_ALREADY_ISSUED: "This job already has an issued invoice.",
  APPOINTMENT_DECISION_REQUIRED:
    "This request has an active appointment. Use its calendar decision controls before declining the request.",
  STALE_REVISION: "This record changed. Refresh it before continuing.",
  SETUP_REQUIRED: "Company setup must be completed before this action.",
  SERVICE_REVIEW_REQUIRED:
    "This service needs compliance approval before quoting.",
  ELIGIBILITY_REVIEW_REQUIRED:
    "Confirm the customer’s Community Rate eligibility.",
  CHANGE_ORDER_REQUIRED: "An accepted quote requires a change order.",
  TRANSITION: "This action is not available at the current stage.",
  FORBIDDEN: "Your account cannot perform this action.",
  OVERPAYMENT_REQUIRES_REVIEW: "This amount exceeds the outstanding balance.",
  IDEMPOTENCY_CONFLICT:
    "This retry contains different information. Refresh before continuing.",
  ALREADY_REVERSED: "This expense has already been reversed. Refresh the report.",
};
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Request not accepted." },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length") || 0) > 12000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 12000)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 },
      );
    const c = command.parse(JSON.parse(raw));
    const { db } = await authenticated();
    let name: string;
    let args: Record<string, unknown>;
    switch (c.command) {
      case "ReviewRequest":
        name = "review_service_request";
        args = {
          p_org: c.organizationId,
          p_id: c.id,
          p_revision: c.revision,
          p_status: c.status,
          p_key: c.key,
        };
        break;
      case "PublishQuote":
        name = "publish_hourly_quote";
        args = {
          p_org: c.organizationId,
          p_request: c.id,
          p_revision: c.revision,
          p_scope: c.scope,
          p_minutes: c.minutes,
          p_community: c.community,
          p_eligibility_reviewed: c.eligibilityReviewed,
          p_customer: c.customerId,
          p_key: c.key,
        };
        break;
      case "ApproveQuote":
        name = "approve_quote";
        args = {
          p_org: c.organizationId,
          p_quote: c.id,
          p_version: c.version,
          p_evidence: c.evidence,
        };
        break;
      case "CompleteServiceCall":
        name = "complete_service_call";
        args = {
          p_org: c.organizationId,
          p_job: c.id,
          p_revision: c.revision,
          p_key: c.key,
        };
        break;
      case "ApproveInvoice":
        name = "approve_invoice";
        args = {
          p_org: c.organizationId,
          p_job: c.id,
          p_revision: c.revision,
          p_total: c.totalCents,
          p_reviewed: c.reviewed,
          p_key: c.key,
        };
        break;
      case "RecordPayment":
        name = "record_payment";
        args = {
          p_org: c.organizationId,
          p_invoice: c.id,
          p_cents: c.cents,
          p_method: c.method,
          p_reference: c.reference,
          p_received_at: c.receivedAt,
          p_confirmed: c.confirmed,
          p_key: c.key,
        };
        break;
      case "RecordBusinessExpense":
        name = "record_business_expense";
        args = {p_org:c.organizationId,p_date:c.date,p_vendor:c.vendor,p_category:c.category,p_description:c.description,p_cents:c.cents,p_method:c.method,p_reference:c.reference,p_confirmed:c.confirmed,p_key:c.key};
        break;
      case "ReverseBusinessExpense":
        name = "reverse_business_expense";
        args = {p_org:c.organizationId,p_expense:c.id,p_reason:c.reason,p_key:c.key};
        break;
    }
    const { data, error } = await db.rpc(name, args);
    if (error)
      return NextResponse.json(
        {
          error:
            messages[error.message] ||
            "The action was not committed. Review the record and try again.",

        },
        { status: error.code === "42501" ? 403 : 409 },
      );
    return NextResponse.json(
      { ok: true, result: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
