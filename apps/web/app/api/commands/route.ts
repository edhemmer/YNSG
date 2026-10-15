import { NextResponse } from "next/server";
import { z } from "zod";
import {ownerCommandSchema} from "../../../lib/owner-command-contract";
import { authenticated, sameOrigin, failure } from "../../../lib/session";
import {validateExpenseReceipt,expenseFailure} from '../../../lib/expense-contract';
const expenseHeaders={'Cache-Control':'private, no-store'};
const messages: Record<string, string> = {
  TAX_REVIEW_REQUIRED:"Review the applicable tax rule and customer-approved total before issuing this invoice.",
  TAX_JURISDICTION_MISMATCH:"This tax rule does not match the service location.",
  CARD_PAYMENT_PENDING:"A card checkout is pending. Resolve or cancel it before recording cash or Zelle.",
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
  let isExpense=false;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 12000)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 },
      );
    const c = ownerCommandSchema.parse(JSON.parse(raw));
    isExpense=c.command==='RecordBusinessExpense'||c.command==='ReverseBusinessExpense';
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
        name = c.taxRuleId ? "approve_taxed_invoice" : "approve_invoice";
        args = {
          p_org: c.organizationId,
          p_job: c.id,
          p_revision: c.revision,
          p_total: c.totalCents,
          ...(c.taxRuleId ? {p_rule:c.taxRuleId,p_evidence:c.taxEvidence||""} : {p_reviewed:c.reviewed}),
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
    if(c.command==='RecordBusinessExpense'||c.command==='ReverseBusinessExpense'){
      if(error)throw Error(error.code==='42501'?'FORBIDDEN':error.message);
      return NextResponse.json({ok:true,result:validateExpenseReceipt(c,data)},{headers:expenseHeaders});
    }
    if(c.command==='RecordPayment'){
      const headers={'Cache-Control':'private, no-store'};
      if(error){
        const denied=error.code==='42501';
        const known=denied||['OVERPAYMENT_REQUIRES_REVIEW','CARD_PAYMENT_PENDING','IDEMPOTENCY_CONFLICT','INVOICE_ALREADY_ISSUED','STALE_REVISION','FORBIDDEN','VALIDATION','NOT_FOUND'].includes(error.message);
        return NextResponse.json({error:denied?'This account cannot record the payment.':known?(messages[error.message]||'The payment was rejected. Review the invoice before retrying.'):'The payment result could not be confirmed. Check the same saved attempt before entering another payment.'},{status:denied?403:known?409:503,headers});
      }
      const receipt=z.object({id:z.uuid()}).passthrough().safeParse(data);
      if(!receipt.success)return NextResponse.json({error:'The payment result could not be confirmed. Check the same saved attempt before entering another payment.'},{status:503,headers});
      return NextResponse.json({ok:true,result:data},{headers});
    }
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
    if(isExpense){const result=expenseFailure(error);return NextResponse.json({error:result.error},{status:result.status,headers:expenseHeaders});}
    return failure(error);
  }
}
