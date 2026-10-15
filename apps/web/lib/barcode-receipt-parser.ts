import {z} from 'zod';

export const productBarcodeFormat=z.enum(['ean8','upca','ean13','gtin14']);
export type ProductBarcodeFormat=z.infer<typeof productBarcodeFormat>;
/** Scanners may append ASCII line delimiters, but never accept arbitrary text as a product. */
export function parseProductBarcode(value:unknown){
 if(typeof value!=='string')throw Error('BARCODE_INVALID');
 const code=value.trim();
 if(!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(code))throw Error('BARCODE_INVALID');
 const format:ProductBarcodeFormat=code.length===8?'ean8':code.length===12?'upca':code.length===13?'ean13':'gtin14';
 const digits=[...code].map(Number),given=digits.pop()!;
 let sum=0;
 for(let i=digits.length-1,p=0;i>=0;i--,p++)sum+=digits[i]!*(p%2===0?3:1);
 const calculated=(10-(sum%10))%10;
 if(calculated!==given)throw Error('BARCODE_CHECK_DIGIT');
 // GTIN-14 is an identifier, not a retail price or guarantee of model compatibility.
 return {format,code,gtin14:code.padStart(14,'0'),checkDigitValid:true as const};
}
export const scannerCandidate=z.object({
 rawValue:z.string().min(1).max(100),
 format:z.string().min(1).max(64).optional(),
}).strict();
export function parseScannerCandidates(raw:unknown){
 const items=z.array(scannerCandidate).max(25).parse(raw);
 const matches=new Map<string,ReturnType<typeof parseProductBarcode>>();
 for(const item of items){
  try{
   const match=parseProductBarcode(item.rawValue);
   matches.set(match.gtin14,match);
  }catch{/* Ignore other symbologies and invalid detections. */}
 }
 if(matches.size!==1)throw Error(matches.size?'BARCODE_AMBIGUOUS':'BARCODE_NOT_FOUND');
 return [...matches.values()][0]!;
}
const maxCents=z.number().int().min(0).max(999999999);
export const purchaseReceiptLine=z.object({
 productBarcode:z.string().nullable(),
 description:z.string().trim().min(2).max(200),
 quantity:z.number().int().positive().max(100000),
 subtotalCents:maxCents,
 discountCents:maxCents,
 taxPaidCents:maxCents,
}).strict().superRefine((v,ctx)=>{
 if(v.discountCents>v.subtotalCents)ctx.addIssue({code:'custom',message:'Discount exceeds subtotal'});
 if(v.productBarcode!==null){try{parseProductBarcode(v.productBarcode);}catch{ctx.addIssue({code:'custom',message:'Invalid product identifier'});}}
});
export const receiptCapture=z.object({
 merchant:z.string().trim().min(2).max(160),
 purchaseDate:z.iso.date(),
 currency:z.literal('USD'),
 lines:z.array(purchaseReceiptLine).min(1).max(100),
 totalPaidCents:maxCents,
 source:z.enum(['owner-entered','reviewed-document-extraction','verified-retailer-import']),
}).strict();
export function reconcileReceiptCapture(raw:unknown){
 const receipt=receiptCapture.parse(raw);
 const total=receipt.lines.reduce((sum,line)=>sum+line.subtotalCents-line.discountCents+line.taxPaidCents,0);
 if(!Number.isSafeInteger(total)||total!==receipt.totalPaidCents)throw Error('RECEIPT_TOTAL_MISMATCH');
 // Document extraction is untrusted until reviewed; totals still do not prove payment.
 return {...receipt,calculatedTotalCents:total,priceVerifiedByOwner:false as const,receiptImageStored:false as const};
}
