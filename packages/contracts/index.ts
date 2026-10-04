import { z } from 'zod';

export const id = z.uuid();
export const money = z.number().int().min(0).max(999_999_999);
export const requestService = z.object({service:z.string().trim().min(2).max(80),task:z.string().trim().max(120)}).strict();
export const requestInput = z.object({
  service: z.string().trim().min(2).max(80).optional(), task: z.string().trim().max(120).optional(),
  services: z.array(requestService).min(1).max(15).optional(),
  description: z.string().trim().max(3000).default(''), name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(35), email: z.email().max(254),
  street: z.string().trim().min(5).max(200), city: z.string().trim().min(2).max(80),
  preferredTime: z.string().trim().max(180).default(''), communityRate: z.enum(['Yes','No']),
  website: z.string().max(200).default(''),
}).strict().superRefine((v,ctx)=>{
  if(!v.services?.length && !v.service)ctx.addIssue({code:'custom',message:'Choose at least one service',path:['services']});
  if(v.services && new Set(v.services.map(x=>`${x.service}:${x.task}`)).size!==v.services.length)ctx.addIssue({code:'custom',message:'Remove duplicate selections',path:['services']});
  if((v.services?.some(x=>x.service==='Something else') || v.service==='Something else') && v.description.length<10)ctx.addIssue({code:'custom',message:'Describe the other work',path:['description']});
});
export type RequestInput = z.infer<typeof requestInput>;
export const commandEnvelope = z.object({schemaVersion:z.literal(1),organizationId:id,idempotencyKey:z.string().min(16).max(128),expectedRevision:z.number().int().positive()}).strict();
export const companySettings = z.object({
  schemaVersion:z.literal(1),displayName:z.string().min(2).max(160),timezone:z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Choose an IANA timezone'),
  currency:z.literal('USD'), region:z.string().min(2).max(80), policyVersion:z.string().min(1).max(80), cities:z.array(z.string().min(2).max(80)).min(1),
  brand:z.object({navy:z.string().regex(/^#[a-fA-F0-9]{6}$/),forest:z.string().regex(/^#[a-fA-F0-9]{6}$/),gold:z.string().regex(/^#[a-fA-F0-9]{6}$/),cream:z.string().regex(/^#[a-fA-F0-9]{6}$/),ownerName:z.string().trim().min(1).max(160).refine(v=>!/[\r\n]/.test(v)).nullable().optional(),logoUrl:z.url().max(2048).refine(v=>{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}).nullable().optional()}).strict(),
  notificationRecipient:z.email(),sender:z.email(),intakeEnabled:z.boolean(),privacyVersion:z.string().min(1),
  hourly:z.object({standardCents:money.refine(v=>v>0),communityCents:money.refine(v=>v>0),minimumMinutes:z.literal(120),incrementMinutes:z.literal(30),partialExtension:z.enum(['ceil','exact']).nullable()}).strict(),
  scheduling:z.object({weekdays:z.array(z.number().int().min(1).max(7)).min(1).max(7),earliestStart:z.number().int().min(0).max(1439),latestStart:z.number().int().min(0).max(1439),endOfDay:z.number().int().min(0).max(1440),bufferMinutes:z.number().int().min(0).max(180).nullable(),selectionMinutes:z.number().int().min(1).max(60),proposalMinutes:z.number().int().min(1).max(10080),leadMinutes:z.number().int().min(0).max(527040),horizonMinutes:z.number().int().min(1).max(527040),pendingLimit:z.number().int().min(1).max(5)}).strict().refine(v=>v.horizonMinutes>v.leadMinutes,{message:'Booking horizon must exceed minimum notice'}),
  sellerLegalName:z.string().min(2).max(160),sellerVerified:z.boolean(),invoiceTerms:z.string().min(1).max(4000).nullable(),taxTreatmentVerified:z.boolean(),laborTaxTreatment:z.enum(['unreviewed','reviewed_non_taxable']),
  review:z.object({enabled:z.boolean(),url:z.url().refine(v=>{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}).nullable()}).strict(),
}).strict().refine(v=>!v.review.enabled||v.review.url!==null,{message:'Review URL required',path:['review','url']});
export type CompanySettings = z.infer<typeof companySettings>;
export type ErrorCode='VALIDATION'|'FORBIDDEN'|'UNAUTHORIZED'|'STALE_REVISION'|'IDEMPOTENCY_CONFLICT'|'TRANSITION'|'SETUP_REQUIRED'|'CAPACITY_CONFLICT'|'PROVIDER_UNAVAILABLE';
export class DomainError extends Error { constructor(public readonly code:ErrorCode,message:string){super(message);this.name='DomainError';} }
