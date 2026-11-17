import {z} from 'zod';
import {JOURNEYS} from './marketing-emails.ts';

// Owner controls for automated marketing email. Read model from marketing_automation_owner and the
// bounded update command for marketing_automation_update (caps: 1,500 a month, 60 a day at most).
const journey = z.enum(JOURNEYS);
const count = z.number().int().nonnegative();
export const automationSummary = z.object({
  enabled: z.boolean(), monthlyCap: count.max(1500), dailyCap: count.max(60), journeysOff: z.array(journey).max(6),
  usage: z.object({today: count, month: count, otherToday: count}),
  audiences: z.object({customer: count, prospect: count}),
  queued: z.partialRecord(journey, count),
  nextSend: z.string().nullable(),
  last30: z.object({sent: count, clicked: count}),
  recent: z.array(z.object({journey, audience: z.enum(['customer', 'prospect']), email: z.string().max(254), name: z.string().max(120).nullable(), sentAt: z.string().nullable(), clicked: z.boolean(), status: z.enum(['sent', 'failed'])})).max(25),
});
export type AutomationSummary = z.infer<typeof automationSummary>;
export const automationQuery = z.object({
  organization: z.uuid(), view: z.enum(['summary', 'preview', 'customer']).default('summary'), customer: z.uuid().optional(),
  journey: journey.optional(), audience: z.enum(['customer', 'prospect']).optional(), month: z.coerce.number().int().min(1).max(12).optional(),
});
export const automationCommand = z.object({
  organization: z.uuid(), enabled: z.boolean(), journeysOff: z.array(journey).max(6),
  monthlyCap: z.number().int().min(0).max(1500), dailyCap: z.number().int().min(0).max(60),
}).strict();
export const customerMarketingStatus = z.array(z.object({
  email: z.string().max(254), subscribed: z.boolean(), stage: z.enum(['subscriber', 'lead', 'quoted', 'declined', 'customer']),
  lastSentAt: z.string().nullable(), lastClickedAt: z.string().nullable(), unsubscribedAt: z.string().nullable(),
  last: z.object({journey, sentAt: z.string()}).nullable(), next: z.object({journey, at: z.string()}).nullable(),
})).max(20);
export const STAGE_LABEL = {subscriber: 'Subscriber', lead: 'Lead', quoted: 'Estimate sent', declined: 'Didn’t go ahead', customer: 'Customer'} as const;
