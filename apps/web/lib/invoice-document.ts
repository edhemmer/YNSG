import {invoiceNumber} from "./invoice-number.ts";
import {hourlyCharge} from "./invoice-billing.ts";
export type InvoiceRecipient = {name:string;email:string;phone:string;street:string;city:string;region:string;postalCode:string};
export type InvoiceTaxComponent={label:string;kind:string;ratePpm:number;baseCents:number;taxCents:number};
export type InvoiceDocument = { dueDate?:string|null; subtotalCents?:number; taxCents?:number; taxComponents?:InvoiceTaxComponent[]; sample?:boolean; recipient:InvoiceRecipient|null; businessEmail:string; number:number|string; issuedAt:string; businessName:string; terms:string;timezone:string; lines:{description:string;chargedCents:number;billingBasis?:string;billingMinutes?:number;unitRateCents?:number;recordedMinutes?:number}[]; totalCents:number; paidCents:number; balanceCents:number };
export function invoiceDocument(invoice:{number:number;issued_at:string;total_cents:number;snapshot:Record<string,unknown>;payments:{cents:number}[]}):InvoiceDocument {
 const cents=(n:unknown):number=>{if(typeof n!=="number"||!Number.isSafeInteger(n)||n<0)throw Error("INVALID_INVOICE");return n};
 const total=cents(invoice.total_cents),paid=invoice.payments.reduce((sum,p)=>{if(!Number.isSafeInteger(p.cents))throw Error("INVALID_INVOICE");return sum+p.cents},0);
 if(!Number.isSafeInteger(paid)||paid<0||paid>total||!Number.isSafeInteger(invoice.number)||invoice.number<1||!Number.isFinite(Date.parse(invoice.issued_at)))throw Error("INVALID_INVOICE");
 const cfg=invoice.snapshot.configuration as Record<string,unknown>|undefined;
 const businessName=cfg?.sellerLegalName,terms=cfg?.invoiceTerms;
 if(typeof businessName!=="string"||!businessName.trim()||typeof terms!=="string"||!terms.trim())throw Error("INVOICE_SETUP_REQUIRED");
 const taxCents=cents(invoice.snapshot.taxCents??0),subtotal=total-taxCents;if(subtotal<0)throw Error("INVALID_INVOICE");
 const rawTax=invoice.snapshot.tax as Record<string,unknown>|undefined;
 const taxComponents:InvoiceTaxComponent[]=Array.isArray(rawTax?.components)?rawTax.components.map(c=>{if(!c||typeof c.label!=="string"||typeof c.kind!=="string")throw Error("INVALID_INVOICE");return {label:c.label,kind:c.kind,ratePpm:cents(c.ratePpm),baseCents:cents(c.baseCents),taxCents:cents(c.taxCents)}}):[];
 if(taxComponents.reduce((sum,c)=>sum+c.taxCents,0)!==taxCents)throw Error("INVALID_INVOICE");
 const work=invoice.snapshot.recordedWork;
 const lines=Array.isArray(work)?work.map(l=>{if(!l||typeof l.description!=="string"||!l.description.trim())throw Error("INVALID_INVOICE");if(l.billingBasis!==undefined&&!(["hourly","fixed"].includes(l.billingBasis)))throw Error("INVALID_INVOICE");if(l.billingBasis==="hourly"&&(hourlyCharge(cents(l.billingMinutes),cents(l.unitRateCents))!==l.chargedCents))throw Error("INVALID_INVOICE");return {description:l.description,chargedCents:cents(l.chargedCents),...(l.billingBasis?{billingBasis:l.billingBasis}:{}),...(l.billingBasis==="hourly"?{billingMinutes:cents(l.billingMinutes),unitRateCents:cents(l.unitRateCents)}:{}),...(l.recordedMinutes!==undefined?{recordedMinutes:cents(l.recordedMinutes)}:{})}}):[{description:typeof invoice.snapshot.scope==="string"?invoice.snapshot.scope:"Recorded service",chargedCents:subtotal}];
 if(!lines.length||lines.reduce((sum,l)=>sum+l.chargedCents,0)!==subtotal)throw Error("INVALID_INVOICE");
 const timezone=typeof cfg?.timezone==="string"?cfg.timezone:"UTC";
 new Intl.DateTimeFormat("en-US",{timeZone:timezone});
 const raw=invoice.snapshot.recipient;
 let recipient:InvoiceRecipient|null=null;
 if(raw!==undefined){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("INVALID_INVOICE_RECIPIENT");
  const value=raw as Record<string,unknown>;
  const field=(key:string,required=true)=>{const v=value[key];if(typeof v!=="string"||(required&&!v.trim()))throw Error("INVALID_INVOICE_RECIPIENT");return v};
  recipient={name:field("name"),email:field("email"),phone:field("phone"),street:field("street"),city:field("city"),region:field("region"),postalCode:field("postalCode",false)};
 }
 const businessEmail=typeof cfg?.notificationRecipient==="string"?cfg.notificationRecipient:"";
 return {subtotalCents:subtotal,taxCents,taxComponents,recipient,businessEmail,timezone,number:invoiceNumber(invoice.number),issuedAt:invoice.issued_at,businessName,terms,lines,totalCents:total,paidCents:paid,balanceCents:total-paid};
}
