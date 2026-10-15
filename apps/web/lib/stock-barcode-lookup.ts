import {z} from 'zod';
import {parseProductBarcode} from './barcode-receipt-parser.js';
import {materialPurchaseLot} from './material-lot-accounting.js';

const uuid=z.uuid();
export const stockedProduct=z.object({
 organizationId:uuid,
 barcode:z.string(),
 name:z.string().trim().min(2).max(200),
 packageSize:z.string().trim().min(2).max(100),
 itemUnit:z.string().trim().min(1).max(50),
}).strict();
export const stockLookupRequest=z.object({organizationId:uuid,barcode:z.string()}).strict();

/** No network, no database access. The future iOS API must query by authorized company. */
export function lookupPurchasedItem(rawRequest:unknown,rawProducts:unknown,rawLots:unknown){
 const request=stockLookupRequest.parse(rawRequest);
 const code=parseProductBarcode(request.barcode).gtin14;
 const products=z.array(stockedProduct).max(10000).parse(rawProducts);
 const lots=z.array(materialPurchaseLot).max(10000).parse(rawLots);
 // Never let a caller-supplied list mix another company's private receipts or costs.
 if(products.some(p=>p.organizationId!==request.organizationId)||lots.some(l=>l.organizationId!==request.organizationId))throw Error('CROSS_TENANT_MATERIAL');
 const matchingProducts=products.filter(p=>parseProductBarcode(p.barcode).gtin14===code);
 if(matchingProducts.length!==1)throw Error(matchingProducts.length?'PRODUCT_DUPLICATE':'PRODUCT_NOT_FOUND');
 const item=matchingProducts[0]!;
 const available=lots.filter(l=>l.productBarcode!==undefined&&parseProductBarcode(l.productBarcode).gtin14===code&&l.quantityRemaining>0&&l.returnStatus==='none');
 // A barcode is not a receipt or purchase price. Multiple lots may differ in price.
 // Avoid selecting the wrong historical cost without a lot scan/selection.
 return {
  barcode:code,name:item.name,packageSize:item.packageSize,itemUnit:item.itemUnit,
  lots:available.map(l=>({
   lotId:l.id,quantityRemaining:l.quantityRemaining,purchasedUnits:l.purchasedUnits,
   unitName:l.unitName,pretaxCents:l.pretaxCents,taxPaidCents:l.taxPaidCents,
   totalPaidCents:l.pretaxCents+l.taxPaidCents,receiptId:l.receiptId,
  })),
  needsLotSelection:available.length!==1,
  foundInInventory:available.length>0,
  priceSource:'recorded-purchase' as const,
  receiptSource:'private-company-record' as const,
  invoiceUpdated:false as const,
 };
}
