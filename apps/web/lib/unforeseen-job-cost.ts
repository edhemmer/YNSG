import {z} from 'zod';

export const unforeseenType=z.enum(['supply_line','shutoff_valve','damaged_connection','wrong_part','hidden_damage','additional_small_task','other']);
export const unforeseenInput=z.object({
 kind:unforeseenType,
 description:z.string().trim().min(5).max(500),
 expectedHandsOnMinutes:z.number().int().min(0).max(1440),
 supplyRunMinutes:z.number().int().min(0).max(480),
 minutesBeforeNextCommitment:z.number().int().min(0).max(720),
 ownerLaborCostCentsPerHour:z.number().int().positive().max(100000),
 businessMaterialCostCents:z.number().int().min(0).max(10000000),
 additionalApprovedChargeCents:z.number().int().min(0).max(10000000),
 customerApprovedExtra:z.boolean(),
 materialCompatibilityConfirmed:z.boolean(),
 safeConditionsConfirmed:z.boolean(),
 permittedByLicenseAndScope:z.boolean(),
}).strict();
export type UnforeseenInput=z.infer<typeof unforeseenInput>;
export type UnforeseenReview={
 decision:'stop-refer'|'reschedule'|'approval-required'|'review-before-proceed';
 extraMinutes:number;
 laborOpportunityCostCents:number;
 estimatedIncrementalContributionCents:number;
 flags:string[];
};
export function reviewUnforeseenJob(raw:unknown):UnforeseenReview{
 const v=unforeseenInput.parse(raw);
 const extraMinutes=v.expectedHandsOnMinutes+v.supplyRunMinutes;
 const laborOpportunityCostCents=Math.ceil(extraMinutes*v.ownerLaborCostCentsPerHour/60);
 const estimatedIncrementalContributionCents=v.additionalApprovedChargeCents-laborOpportunityCostCents-v.businessMaterialCostCents;
 const flags:string[]=[];
 // Plumbing is regulated in Illinois. Being present at the customer's home does not confer license or permission.
 const plumbing=['supply_line','shutoff_valve','damaged_connection'].includes(v.kind);
 const hazardous=plumbing||v.kind==='hidden_damage';
 if(plumbing)flags.push('Supply lines, valves, and connected plumbing repairs require licensed-scope review; do not perform this work under an ordinary handyman authorization.');
 if(v.kind==='hidden_damage')flags.push('Hidden moisture, structural, wiring, or other damage requires professional assessment before disturbing or concealing it.');
 if(!v.safeConditionsConfirmed)flags.push('The site is not confirmed safe for the proposed work.');
 if(!v.permittedByLicenseAndScope)flags.push('Required licensing and approved service scope have not been confirmed.');
 if(!v.materialCompatibilityConfirmed)flags.push('Part/model/size/material compatibility is not confirmed. Avoid a blind store trip.');
 if(!v.customerApprovedExtra)flags.push('Customer has not approved the additional scope and price. Do not start additional work or purchase parts.');
 if(extraMinutes>v.minutesBeforeNextCommitment)flags.push('The additional work would conflict with the next commitment.');
 if(v.supplyRunMinutes>0)flags.push('Supplier trip time is included as an owner cost; group purchases and confirm stock before driving.');
 if(estimatedIncrementalContributionCents<0)flags.push('The extra work has negative estimated incremental contribution at these assumptions. Review price and options.');
 const decision:UnforeseenReview['decision']=hazardous||!v.safeConditionsConfirmed||!v.permittedByLicenseAndScope
  ?'stop-refer':extraMinutes>v.minutesBeforeNextCommitment?'reschedule':!v.customerApprovedExtra||!v.materialCompatibilityConfirmed?'approval-required':'review-before-proceed';
 return {decision,extraMinutes,laborOpportunityCostCents,estimatedIncrementalContributionCents,flags};
}
// These are scenario numbers, not authoritative quotes, material orders, invoice lines or licensed-trade determinations.
// The owner must verify actual territory licensing, approved services, materials, site conditions, and customer consent.
