/** Classify saved owner RPC results without treating network or database uncertainty as a rejection. */
const definiteErrors = new Set([
 'TAX_REVIEW_REQUIRED','TAX_JURISDICTION_MISMATCH','CARD_PAYMENT_PENDING',
 'INVOICE_REVIEW_REQUIRED','INVOICE_DRAFT_REQUIRED','INVOICE_TOTAL_CHANGED',
 'INVOICE_ALREADY_ISSUED','APPOINTMENT_DECISION_REQUIRED','STALE_REVISION',
 'SETUP_REQUIRED','SERVICE_REVIEW_REQUIRED','ELIGIBILITY_REVIEW_REQUIRED',
 'CHANGE_ORDER_REQUIRED','TRANSITION','FORBIDDEN','OVERPAYMENT_REQUIRES_REVIEW',
 'IDEMPOTENCY_CONFLICT','VALIDATION','NOT_FOUND'
]);
export function ownerRpcFailure(value:unknown){
 const error=(value&&typeof value==='object')?value as {code?:unknown;message?:unknown}:null;
 const code=typeof error?.code==='string'?error.code:'';
 const message=typeof error?.message==='string'?error.message:'';
 if(code==='42501'||message==='FORBIDDEN')return {status:403 as const,uncertain:false as const};
 if(definiteErrors.has(message))return {status:409 as const,uncertain:false as const};
 return {status:503 as const,uncertain:true as const};
}
export function ownerRpcResultConfirmed(data:unknown){return data!==null&&data!==undefined;}
