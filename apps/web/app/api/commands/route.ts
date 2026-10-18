import { NextResponse } from "next/server";
import { z } from "zod";
import {verifyPaymentCorrection} from '../../../lib/payment-correction-contract';
import {ownerCommandSchema} from "../../../lib/owner-command-contract";
import { authenticated, sameOrigin, failure } from "../../../lib/session";
import {validateExpenseReceipt,expenseFailure} from '../../../lib/expense-contract';
import {ownerRpcFailure,ownerRpcResultConfirmed} from '../../../lib/owner-command-result';
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
      case 'ReverseRecordedPayment':
        name='reverse_recorded_payment';args={p_org:c.organizationId,p_invoice:c.id,p_payment:c.paymentId,p_reason:c.reason,p_key:c.key};break;
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
    if(c.command==='ReverseRecordedPayment'){
      const headers={'Cache-Control':'private, no-store'};
      if(error){const denied=error.code==='42501',known=denied||['PAYMENT_ALREADY_REVERSED','UNSUPPORTED_PAYMENT_CORRECTION','PAYMENT_BALANCE_REVIEW_REQUIRED','CARD_PAYMENT_PENDING','IDEMPOTENCY_CONFLICT','NOT_FOUND','VALIDATION','SETUP_REQUIRED'].includes(error.message);return NextResponse.json({error:denied?'Your account cannot correct this receipt.':known?'The receipt correction was rejected. Refresh the payment history and review the original receipt.':'The correction result is uncertain. Check the same saved attempt before changing another receipt.'},{status:denied?403:known?409:503,headers});}
      try{return NextResponse.json({ok:true,result:verifyPaymentCorrection(data,c)},{headers});}catch{return NextResponse.json({error:'The correction result could not be confirmed. Check the same saved attempt.'},{status:503,headers});}
    }
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
    if(c.command==='ApproveInvoice'){
      const headers={'Cache-Control':'private, no-store'};
      if(error){
        const denied=error.code==='42501';
        const known=denied||['TAX_REVIEW_REQUIRED','TAX_JURISDICTION_MISMATCH','INVOICE_REVIEW_REQUIRED','INVOICE_DRAFT_REQUIRED','INVOICE_TOTAL_CHANGED','INVOICE_ALREADY_ISSUED','STALE_REVISION','SETUP_REQUIRED','CHANGE_ORDER_REQUIRED','TRANSITION','FORBIDDEN','IDEMPOTENCY_CONFLICT'].includes(error.message);
        return NextResponse.json({error:denied?'This account cannot issue the invoice.':known?(messages[error.message]||'Review the invoice and its saved state before issuing.'):'The invoice issuance result is unknown. Check the same saved attempt before issuing another invoice.'},{status:denied?403:known?409:503,headers});
      }
      if(data===null||typeof data!=='object')return NextResponse.json({error:'Invoice issuance could not be confirmed. Check the saved invoice before issuing another.'},{status:503,headers});
      return NextResponse.json({ok:true,result:data},{headers});
    }
    if (error) {
      const outcome=ownerRpcFailure(error);
      return NextResponse.json(
        { error: outcome.uncertain
          ? "The saved result could not be confirmed. Check the same request or job before trying another action."
          : messages[error.message] || "This action was rejected. Review the current record before retrying." },
        { status: outcome.status, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (!ownerRpcResultConfirmed(data))
      return NextResponse.json(
        {error:"The saved result could not be confirmed. Check the same request or job before trying another action."},
        {status:503,headers:{"Cache-Control":"private, no-store"}},
      );
    return NextResponse.json(
      { ok: true, result: data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if(isExpense){const result=expenseFailure(error);return NextResponse.json({error:result.error},{status:result.status,headers:expenseHeaders});}
    return failure(error);
  }
}
