import {z} from 'zod';
const uuid=z.uuid(), key={key:uuid}, org={organization:uuid}, request={request:uuid,revision:z.number().int().positive()};
const reason=z.string().trim().min(10).max(2000);
export const privacyCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('read'),organization:uuid.optional()}).strict(),
 z.object({action:z.literal('fresh')}).strict(),
 z.object({action:z.literal('request'),...key,request:uuid,secret:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({action:z.literal('cancel'),...key,...request}).strict(),
 z.object({action:z.literal('prepare'),...key,...request,confirmation:z.literal('DELETE MY ACCOUNT'),secret:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({action:z.literal('policy'),...key,...org,revision:z.number().int().nonnegative(),recordDays:z.number().int().min(1).max(36500),auditDays:z.number().int().min(1).max(36500),basis:reason,notice:reason,reviewed:z.literal(true)}).strict(),
 z.object({action:z.literal('hold'),...key,...org,hold:uuid,reason,reviewOn:z.iso.date()}).strict(),
 z.object({action:z.literal('release'),...key,...org,hold:uuid,reason}).strict(),
 z.object({action:z.literal('retain'),...key,...org,...request,revision:z.number().int().nonnegative(),reason,reviewOn:z.iso.date()}).strict(),
 z.object({action:z.literal('approve'),...key,...org,...request,policyVersion:z.number().int().positive()}).strict(),
]);
export const recoveryCommand=z.object({action:z.enum(['status','resume']),request:uuid,secret:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const privacyInput=z.union([privacyCommand,recoveryCommand,z.object({action:z.literal('reauthenticate'),password:z.string().min(1).max(128)}).strict()]);
export const privacyState=z.object({
 request:z.object({id:uuid,status:z.enum(['requested','canceled','processing','completed']),revision:z.number().int().positive()}).strict().nullable(),
 scopes:z.array(z.object({organization:uuid,name:z.string(),policy:z.object({version:z.number(),recordDays:z.number(),auditDays:z.number(),notice:z.string()}).nullable(),held:z.boolean(),approved:z.boolean()})),
 policy:z.object({version:z.number(),record_days:z.number(),audit_days:z.number(),basis:z.string(),notice:z.string(),created_at:z.string()}).nullable().optional(),
 holds:z.array(z.object({id:uuid,reason:z.string(),review_on:z.string(),released_at:z.string().nullable()}).passthrough()).optional(),
 queue:z.array(z.object({id:uuid,status:z.string(),revision:z.number(),createdAt:z.string(),account:z.string().nullable(),retentionRevision:z.number().int().nonnegative(),nextReviewOn:z.string().nullable(),approved:z.boolean(),recordReviewOn:z.string().nullable(),auditReviewOn:z.string().nullable()})).optional()
}).strict();
export type PrivacyState=z.infer<typeof privacyState>;
export const privacyMessages:Record<string,string>={REAUTHENTICATION_REQUIRED:'Confirm your password below, or sign out and sign in again using your normal email link. Then retry this action.',SOLE_OWNER:'Another active owner must take responsibility for every company you own before deletion. Arrange ownership with your company administrator.',LEGAL_HOLD:'A company legal hold needs review before deletion can proceed.',REVIEW_REQUIRED:'Each linked company must review this request under its current retention policy before deletion.',POLICY_REQUIRED:'Publish and select the current reviewed retention policy first.',STALE_REVISION:'The request or policy changed. Reload and review its current status.',COMMAND_CONFLICT:'This saved attempt differs from its original details. Reload before making a new attempt.'};
