import {z} from 'zod';

// Canonical private.complete_and_invoice returns the issued invoice identity,
// assigned number and immutable total. A 200 response without these is unknown.
export const invoiceIssuedReceipt=z.object({
 id:z.uuid(),
 number:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
 totalCents:z.number().int().min(0).max(999999999),
}).passthrough();

export function confirmInvoiceIssued(raw:unknown,expectedTotalCents:number){
 const receipt=invoiceIssuedReceipt.parse(raw);
 if(!Number.isSafeInteger(expectedTotalCents)||receipt.totalCents!==expectedTotalCents)
  throw Error('UNVERIFIED_INVOICE_ISSUANCE');
 return receipt;
}
