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
  ?'stop-refer':extraMinutes>v.minutesBeforeNextCommitment?'reschedule':!v.customerApprovedExtra||!v.materialCompatibilityConfirmed||estimatedIncrementalContributionCents<0?'approval-required':'review-before-proceed';
 return {decision,extraMinutes,laborOpportunityCostCents,estimatedIncrementalContributionCents,flags};
}
// These are scenario numbers, not authoritative quotes, material orders, invoice lines or licensed-trade determinations.
// The owner must verify actual territory licensing, approved services, materials, site conditions, and customer consent.

export function hiddenConditionPreflight(service:string,task:string):{title:string;questions:string[];hold:boolean}|null{
 const name=(service+' '+task).toLowerCase();
 if(/faucet|sink|toilet|water line|supply line|shutoff|valve|plumb/.test(name))return {
  title:'Plumbing-related work: hidden conditions and license review',
  questions:[
   'Confirm which exact part and fixture model is affected. Ask for clear before-visit photos of connections and accessible shutoffs.',
   'Inspect available information about corroded valves, aged supply lines, leaks, damaged fittings and water shutoff access; absence from photos is not proof they are sound.',
   'Confirm the scope requires an appropriately licensed trade professional and refer when needed. Do not promise replacement or include unapproved plumbing work.',
   'If an unforeseen defect is discovered, document it, pause, disclose additional time/materials, and obtain authorization before any separate permissible work.'
  ],hold:true
 };
 if(/door|lock|hinge|strike|latch/.test(name))return {title:'Door and hardware readiness',questions:[
  'Get hardware make/model and photographs of the door edge, strike, hinges and existing fasteners.',
  'Check access, backup entry and whether alignment, dead batteries or old hardware might be the real cause before proposing replacement.',
  'Confirm screw sizes, thickness, backset and installation tools before buying parts; held smart-lock tasks require separate authorization.'
 ],hold:/smart.lock|electronic.lock/.test(name)};
 if(/drywall|shelf|picture|mount|baseboard|miter|caulk|crown.molding|door.trim|window.trim/.test(name))return {title:'Finishing and mounting hidden-condition check',questions:[
  'Ask for photos, measurements, wall type, existing damage and intended load or finished appearance.',
  'Prepare suitable alternative anchors, fasteners, finishes or patch materials after confirming compatibility and approved costs.',
  'Check moisture, utilities, substrate condition and return-visit drying times before promising a one-visit result.'
 ],hold:false};
 return null;
}
