import {z} from 'zod';

export const onSiteExtraInput=z.object({
  work:z.enum(['hang_shelf','hang_picture','small_drywall_patch','trim_cut','replace_caulk','smart_lock','other']),
  expectedMinutes:z.number().int().min(15).max(480),
  remainingMinutes:z.number().int().min(0).max(720),
  additionalMaterialsCents:z.number().int().min(0).max(99999999),
  materialsApproved:z.boolean(),
  scopeReviewed:z.boolean(),
  customerPriceApproved:z.boolean(),
  accessSafe:z.boolean(),
}).strict();
export type OnSiteExtraInput=z.infer<typeof onSiteExtraInput>;
export type ExtraReview={decision:'refer'|'reschedule'|'review-and-record';allocationMinutes:number;reasons:string[];requirements:string[]};
const templates={
  hang_shelf:{min:60,requires:'Confirm shelf load, wall type, stud position and bracket/anchor ratings.'},
  hang_picture:{min:60,requires:'Confirm combined weight, hanger capacity, wall composition and location.'},
  small_drywall_patch:{min:60,requires:'Inspect damaged area and compound dry/cure time; finish may require another visit.'},
  trim_cut:{min:60,requires:'Measure actual corner, verify saw suitability, and make a scrap test cut.'},
  replace_caulk:{min:60,requires:'Confirm substrate, moisture source, compatible sealant and cure time.'},
  smart_lock:{min:60,requires:'Smart-lock installation is held: do not accept this task until its compliance review.'},
  other:{min:60,requires:'Uncatalogued work requires separate scope, safety and price review.'},
} as const;
export function reviewOnSiteExtra(raw:unknown):ExtraReview{
 const v=onSiteExtraInput.parse(raw),template=templates[v.work];
 const allocationMinutes=Math.max(template.min,Math.ceil(v.expectedMinutes/15)*15);
 const requirements=[template.requires,'Confirm the customer agrees to any additional price/materials before starting.','Record the added scope and approval through the existing quote/job workflow; this worksheet does not alter the appointment or invoice.'];
 const reasons:string[]=[];
 if(v.work==='smart_lock'){reasons.push('This service is currently held from the YNSG catalog.');return {decision:'refer',allocationMinutes,reasons,requirements};}
 if(v.work==='other'){reasons.push('The work is not in the approved on-site quick-task list.');return {decision:'refer',allocationMinutes,reasons,requirements};}
 if(!v.accessSafe){reasons.push('Safe access, wall conditions or required equipment are not confirmed.');return {decision:'refer',allocationMinutes,reasons,requirements};}
 if(!v.scopeReviewed)reasons.push('Scope and site conditions still require owner review.');
 if(!v.customerPriceApproved)reasons.push('Customer has not approved the additional price and scope.');
 if(v.additionalMaterialsCents>0&&!v.materialsApproved)reasons.push('Materials have not been approved.');
 if(v.remainingMinutes<allocationMinutes)reasons.push('Not enough available time without risking the next appointment.');
 const decision=reasons.some(s=>/enough available time/.test(s))?'reschedule':'review-and-record';
 return {decision,allocationMinutes,reasons,requirements};
}
