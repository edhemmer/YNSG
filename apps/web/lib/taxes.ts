import {z} from 'zod';
export const taxSources={
 federal:'https://www.irs.gov/pub/irs-pdf/f1040es.pdf',
 federalPayment:'https://www.irs.gov/payments/direct-pay-with-bank-account',
 selfEmployment:'https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes',
 illinois:'https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/incometax/documents/currentyear/individual/il-1040-es.pdf',
 illinoisPayment:'https://mytax.illinois.gov/',
 illinoisSales:'https://tax.illinois.gov/research/publications/pubs/overview-of-service-occupation-tax.html',
 illinoisRates:'https://tax.illinois.gov/research/taxrates.html',
 illinoisFiling:'https://tax.illinois.gov/forms/sales/salesandusetax/st-1-instructions.html',
 quickbooks:'https://quickbooks.intuit.com/learn-support/en-us/help-article/import-export-data-files/import-multiple-invoices/L7E9Xrd8l_US_en_US',
};
const text=z.string().trim().min(2).max(500),cents=z.number().int().min(0).max(999999999);
// These values are reviewed government/accountant inputs, never inferred from CRM revenue.
export const taxKind=z.enum(['federal_estimated','state_income','sales_tax','use_tax','other']);
export const sourceUrl=z.url().max(1000).refine(s=>{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password;});
export const taxRuleSchema=z.object({id:z.uuid(),label:text,state:z.string().regex(/^[A-Z]{2}$/),county:text,city:text,
 jurisdictionEvidence:text,scope:text,effectiveFrom:z.iso.date(),effectiveTo:z.iso.date(),reviewedOn:z.iso.date(),sourceUrl,
 components:z.array(z.object({kind:z.enum(['state','county','city','district']),label:text,ratePpm:z.number().int().min(0).max(250000)}).strict()).min(1).max(8),
 rounding:z.literal('component_half_up'),reviewed:z.literal(true)}).strict().refine(r=>r.effectiveFrom<=r.effectiveTo,'Check effective dates').refine(r=>r.components.reduce((s,c)=>s+c.ratePpm,0)<=250000,'Combined rate must not exceed 25%');
export const taxProfileSchema=z.object({year:z.number().int().min(2026).max(2100),state:z.string().regex(/^[A-Z]{2}$/),
 entity:z.enum(['individual_calendar','other']),federalAnnualPaymentCents:cents.nullable(),stateAnnualPaymentCents:cents.nullable(),
 federalSource:sourceUrl,stateSource:sourceUrl,reviewedOn:z.iso.date(),reviewNote:text,rules:z.array(taxRuleSchema).max(50)}).strict().superRefine((p,ctx)=>{
 if(new Set(p.rules.map(r=>r.id)).size!==p.rules.length)ctx.addIssue({code:'custom',message:'Rule IDs must be unique'});
 if(p.rules.some(r=>r.state!==p.state))ctx.addIssue({code:'custom',message:'A rule must match this business state'});
});
export type TaxProfile=z.infer<typeof taxProfileSchema>;
export type TaxRule=z.infer<typeof taxRuleSchema>;
export type TaxComponent={kind:string;label:string;ratePpm:number;baseCents:number;taxCents:number};
export function ratePpm(value:string):number|null{
 if(!/^\d{1,2}(\.\d{1,4})?$/.test(value))return null;
 const [whole,fraction='']=value.split('.');const result=Number(whole)*10000+Number(fraction.padEnd(4,'0'));return result<=250000?result:null;
}
export function salesTax(baseCents:number,rule:TaxRule){
 cents.parse(baseCents);taxRuleSchema.parse(rule);
 const components:TaxComponent[]=rule.components.map(c=>({...c,baseCents,taxCents:Number((BigInt(baseCents)*BigInt(c.ratePpm)+500000n)/1000000n)}));
 const taxCents=components.reduce((s,c)=>s+c.taxCents,0);if(baseCents+taxCents>999999999)throw Error('TAX_TOTAL_TOO_LARGE');
 return {subtotalCents:baseCents,taxCents,totalCents:baseCents+taxCents,components};
}
export function estimatedInstallments(profile:TaxProfile){
 // 2026 dates verified from the individual calendar-year forms. Other years/entities need reviewed explicit deadlines.
 if(profile.year!==2026||profile.entity!=='individual_calendar')return [];
 return [profile.federalAnnualPaymentCents===null?null:{kind:'federal_estimated',label:'Federal estimated tax (income + applicable self-employment)',annual:profile.federalAnnualPaymentCents,source:profile.federalSource,payment:taxSources.federalPayment},profile.stateAnnualPaymentCents===null?null:{kind:'state_income',label:'State estimated income tax',annual:profile.stateAnnualPaymentCents,source:profile.stateSource,payment:profile.state==='IL'?taxSources.illinoisPayment:''}].flatMap(item=>{
  if(!item||item.annual===0)return [];
  // State calendars differ. Automatic dates currently supported only for verified Illinois 2026.
  if(item.kind==='state_income'&&profile.state!=='IL')return [];
  return ['2026-04-15','2026-06-15','2026-09-15','2027-01-15'].map((due,i)=>({id:`${item.kind}:${profile.year}:${i+1}`,kind:item.kind,label:item.label,period:`${profile.year} installment ${i+1}`,dueDate:due,amountCents:item.kind==="state_income"&&profile.state==="IL"?Math.floor((item.annual+200)/400)*100:Math.floor(item.annual/4)+(i<item.annual%4?1:0),sourceUrl:item.source,paymentUrl:item.payment}));
 });
}
// A limited Illinois worksheet helper; the owner supplies net Illinois income after exemptions, surcharges,
// withholding and all applicable credits. Never uses gross business sales or assumes federal income equals state income.
export function illinoisEstimate2026(netIncomeCents:number,surchargesCents:number,withholdingAndCreditsCents:number){
 [netIncomeCents,surchargesCents,withholdingAndCreditsCents].forEach(n=>cents.parse(n));
 const liability=Number((BigInt(netIncomeCents)*49500n+500000n)/1000000n)+surchargesCents;
 const net=Math.max(0,liability-withholdingAndCreditsCents);
 return {liabilityCents:liability,netTaxCents:net,annualPaymentCents:net>100000?net:0};
}
export function taxCsv(rows:Record<string,string|number|null>[],columns:string[]){
 const cell=(v:string|number|null|undefined)=>{if(typeof v==='number'){if(!Number.isSafeInteger(v))throw Error('INVALID_EXPORT');return String(v);}
 const s=v??'';return '"'+(/^[\s]*[=+@\-]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';};
 return '\uFEFF'+[columns.map(cell).join(','),...rows.map(row=>columns.map(k=>cell(row[k])).join(','))].join('\r\n')+'\r\n';
}
