import {z} from 'zod';
// IRS 2026 Form 1040-ES, pages 2, 9–10; Illinois 2026 IL-1040-ES, page 2.
// Verified October 13, 2026. No year or state falls back to another rule set.
export const filingStatuses=['single','joint','separate','head','surviving'] as const;
export type FilingStatus=typeof filingStatuses[number];
const brackets:Record<FilingStatus,number[]>={
 single:[12400,50400,105700,201775,256225,640600],
 joint:[24800,100800,211400,403550,512450,768700],
 separate:[12400,50400,105700,201775,256225,384350],
 head:[17700,67450,105700,201750,256200,640600],
 surviving:[24800,100800,211400,403550,512450,768700],
};
export const basicDeduction2026:Record<FilingStatus,number>={single:16100,joint:32200,separate:16100,head:24150,surviving:32200};
const cents=z.number().int().min(0).max(999999999);
export const incomeTaxInput=z.object({year:z.literal(2026),state:z.literal('IL'),status:z.enum(filingStatuses),
 taxableIncomeCents:cents,netProfitCents:cents,socialSecurityWagesCents:cents,medicareWagesCents:cents,
 federalNonrefundableCreditsCents:cents,federalWithholdingAndRefundableCreditsCents:cents,otherFederalTaxesCents:cents,
 stateBaseIncomeCents:cents,stateExemptionsCents:cents,stateSurchargesCents:cents,stateWithholdingAndCreditsCents:cents,
}).strict();
export type IncomeTaxInput=z.infer<typeof incomeTaxInput>;
const percent=(base:number,ppm:number)=>Number((BigInt(base)*BigInt(ppm)+500000n)/1000000n);
export function federalIncome2026(incomeCents:number,status:FilingStatus){
 cents.parse(incomeCents);z.enum(filingStatuses).parse(status);
 const rates=[10,12,22,24,32,35,37],limits=[...brackets[status].map(n=>n*100),Infinity];
 let lower=0,numerator=0n;const bands=[];
 for(let i=0;i<limits.length;i++){
  const base=Math.max(0,Math.min(incomeCents,limits[i]!)-lower);
  if(base>0){numerator+=BigInt(base)*BigInt(rates[i]!);bands.push({rate:rates[i]!,baseCents:base});}
  lower=limits[i]!;
 }
 return {taxCents:Number((numerator+50n)/100n),bands};
}
export function ownerIncomeEstimate(raw:IncomeTaxInput){
 const p=incomeTaxInput.parse(raw),income=federalIncome2026(p.taxableIncomeCents,p.status);
 const adjustedEarnings=percent(p.netProfitCents,923500);
 // Schedule SE's $400 threshold applies to adjusted net earnings, not gross receipts.
 const seEarnings=adjustedEarnings>=40000?adjustedEarnings:0;
 const socialSecurity=percent(Math.min(seEarnings,Math.max(0,18450000-p.socialSecurityWagesCents)),124000);
 const medicare=percent(seEarnings,29000),selfEmploymentCents=socialSecurity+medicare;
 const threshold=(p.status==='joint'?250000:p.status==='separate'?125000:200000)*100;
 const additionalMedicareCents=percent(Math.max(0,p.medicareWagesCents+seEarnings-threshold),9000);
 const federalLiabilityCents=Math.max(0,income.taxCents-p.federalNonrefundableCreditsCents)+selfEmploymentCents+additionalMedicareCents+p.otherFederalTaxesCents;
 const federalNetCents=Math.max(0,federalLiabilityCents-p.federalWithholdingAndRefundableCreditsCents);
 const stateNetIncomeCents=Math.max(0,p.stateBaseIncomeCents-p.stateExemptionsCents);
 const stateLiabilityCents=percent(stateNetIncomeCents,49500)+p.stateSurchargesCents;
 const stateNetCents=Math.max(0,stateLiabilityCents-p.stateWithholdingAndCreditsCents);
 return {income,selfEmploymentCents,additionalMedicareCents,halfSeDeductionCents:percent(selfEmploymentCents,500000),
  federalLiabilityCents,federalNetCents,stateNetIncomeCents,stateLiabilityCents,stateNetCents,
  // Full projected balance, not a minimum safe-harbor calculation. Recorded estimates are allocated separately.
  federalAnnualPaymentCents:federalNetCents>=100000?federalNetCents:0,
  stateAnnualPaymentCents:stateNetCents>100000?stateNetCents:0,
 };
}
