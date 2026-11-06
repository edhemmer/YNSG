export const ownerCommandMessages: Record<string, string> = {
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
    "Hourly estimating is not enabled for one of these services. Review its scope and pricing in Settings before saving an estimate.",
  ELIGIBILITY_REVIEW_REQUIRED:
    "Confirm the customer’s Community Rate eligibility.",
  CHANGE_ORDER_REQUIRED: "An accepted quote requires a change order.",
  TRANSITION: "This action is not available at the current stage.",
  FORBIDDEN: "Your account cannot perform this action.",
  OVERPAYMENT_REQUIRES_REVIEW: "This amount exceeds the outstanding balance.",
  IDEMPOTENCY_CONFLICT:
    "This retry contains different information. Refresh before continuing.",
  ERASE_HAS_BILLING:"This request has an invoice, so it cannot be deleted. Billing records are kept.",
  ERASE_HAS_MILEAGE:"Mileage is recorded against this job. Reverse or move that mileage before deleting.",
  ERASE_WORK_ACTIVE:"A work timer is still running on this job. Stop it before deleting.",
  ERASE_MESSAGE_BUSY:"A message for this request is being sent right now. Try again in a minute.",
  ERASE_RECURRING:"This request is part of a recurring series. Cancel the series instead of deleting it.",
  ERASE_HAS_RECORDS:"This customer still has requests, quotes, jobs or invoices. Delete those first.",
  ERASE_HAS_FILES:"This customer has uploaded files. Remove the files first.",
  ALREADY_REVERSED: "This expense has already been reversed. Refresh the report.",
};