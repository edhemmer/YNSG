import {z} from 'zod';
// Business accounts (landlords, property managers, offices, churches and other organizations):
// one optional profile per customer with billing details, default payment terms, an approval limit
// and the account's place in the business pipeline. SQL re-validates every field.
const line=(max:number)=>z.string().trim().min(2).max(max).regex(/^[^\x00-\x1f\x7f<>]*$/);
export const ACCOUNT_TYPES=['landlord','property_manager','office','church_nonprofit','builder','farm','other_business'] as const;
export const STAGES=['prospect','contacted','walkthrough','estimate','won','repeat','not_now','lost'] as const;
export const LOST_REASONS=['price','timing','has_vendor','no_need','other'] as const;
export const ACCOUNT_TYPE_LABEL:Record<typeof ACCOUNT_TYPES[number],string>={landlord:'Landlord or building owner',property_manager:'Property manager',office:'Office or small business',church_nonprofit:'Church or nonprofit',builder:'Builder or developer',farm:'Farm',other_business:'Other organization'};
export const STAGE_LABEL:Record<typeof STAGES[number],string>={prospect:'Prospect',contacted:'Contacted',walkthrough:'Walkthrough booked',estimate:'Estimate sent',won:'First job won',repeat:'Repeat account',not_now:'Not now',lost:'Lost'};
export const LOST_LABEL:Record<typeof LOST_REASONS[number],string>={price:'Price',timing:'Timing',has_vendor:'Has someone',no_need:'No need',other:'Other'};
export const businessAccountValue=z.object({
 accountType:z.enum(ACCOUNT_TYPES),
 companyName:line(160).nullable(),
 billingName:line(160).nullable(),
 billingEmail:z.email().max(254).nullable(),
 paymentTermsDays:z.union([z.literal(0),z.literal(15),z.literal(30)]),
 approvalLimitCents:z.number().int().min(0).max(10000000).nullable(),
 stage:z.enum(STAGES),
 nextAction:line(200).nullable(),
 followUpOn:z.iso.date().nullable(),
 lostReason:z.enum(LOST_REASONS).nullable()
}).strict().refine(v=>(v.stage==='lost')===(v.lostReason!==null),'Pick a reason when an account is lost (and only then).');
export const businessAccountCommand=z.object({organization:z.uuid(),key:z.uuid(),customer:z.uuid(),revision:z.number().int().positive().max(2147483647).nullable(),value:businessAccountValue,reason:z.string().trim().max(500).regex(/^[^\x00-\x1f\x7f<>]*$/)}).strict();
export const businessAccountQuery=z.object({organization:z.uuid(),customer:z.uuid().optional(),stage:z.enum([...STAGES,'open','due']).optional(),page:z.coerce.number().int().min(0).max(10000).default(0)}).strict();
const account=z.object({
 customerId:z.uuid(),displayName:z.string().optional(),accountType:z.enum(ACCOUNT_TYPES),companyName:z.string().nullable(),billingName:z.string().nullable(),billingEmail:z.string().nullable(),
 paymentTermsDays:z.union([z.literal(0),z.literal(15),z.literal(30)]),approvalLimitCents:z.number().int().nullable(),stage:z.enum(STAGES),nextAction:z.string().nullable(),
 followUpOn:z.string().nullable(),lostReason:z.enum(LOST_REASONS).nullable(),revision:z.number().int().positive(),updatedAt:z.string()
}).strict();
export const businessAccountDetail=z.object({account:account.nullable()}).strict();
export const businessPipeline=z.object({items:z.array(account).max(20),hasMore:z.boolean(),page:z.number().int().nonnegative(),counts:z.object({open:z.number().int().nonnegative(),due:z.number().int().nonnegative(),won:z.number().int().nonnegative(),total:z.number().int().nonnegative()}).strict()}).strict();
export const businessAccountSaved=z.object({saved:z.literal(true),customerId:z.uuid(),revision:z.number().int().positive()}).strict();
export type BusinessAccount=z.infer<typeof account>;
export type BusinessPipeline=z.infer<typeof businessPipeline>;
