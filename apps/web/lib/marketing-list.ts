import {z} from 'zod';

// Owner marketing list: read models returned by the marketing_owner_* and campaign_owner_* database
// functions, plus a CSV export that common email tools (MailerLite, Mailchimp, Brevo) import as-is.
export const marketingSummary = z.object({
  organization: z.uuid(),
  total: z.number().int().nonnegative(),
  subscribed: z.number().int().nonnegative(),
  optedOut: z.number().int().nonnegative(),
  byBasis: z.record(z.enum(['opt_in', 'customer', 'lead', 'suppressed']), z.number().int().nonnegative()),
  campaigns: z.array(z.object({campaign: z.string().regex(/^[a-z0-9][a-z0-9-]{2,59}$/), entries: z.number().int().nonnegative(), latest: z.string()})).max(500),
  crmFeedStartsAt: z.string().nullable(),
});
export type MarketingSummary = z.infer<typeof marketingSummary>;

export const marketingContact = z.object({
  email: z.string().min(5).max(254), name: z.string().max(120).nullable(), phone: z.string().max(35).nullable(),
  street: z.string().max(200).nullable(), city: z.string().max(80).nullable(), postalCode: z.string().max(5).nullable(),
  basis: z.enum(['opt_in', 'customer', 'lead']), source: z.string().max(60), since: z.string(), token: z.string().regex(/^[a-f0-9]{64}$/),
});
export const marketingExport = z.array(marketingContact).max(20000);
export type MarketingContact = z.infer<typeof marketingContact>;

export const campaignEntries = z.object({
  campaign: z.string(),
  entries: z.array(z.object({id: z.uuid(), type: z.enum(['self', 'nominate']), name: z.string(), email: z.string(), phone: z.string().nullable(), nominee: z.string().nullable(), relationship: z.string().nullable(), workAddress: z.string(), helpWith: z.string(), story: z.string(), createdAt: z.string()})).max(2000),
  draws: z.array(z.object({round: z.number().int().positive(), entryId: z.uuid(), name: z.string(), nominee: z.string().nullable(), drawnAt: z.string(), eligible: z.number().int().positive()})).max(2000),
});
export type CampaignEntries = z.infer<typeof campaignEntries>;

export const campaignDraw = z.object({campaign: z.string(), round: z.number().int().positive(), entryId: z.uuid(), eligible: z.number().int().positive()});
export const crmFeed = z.object({organization: z.uuid(), crmFeedStartsAt: z.string().nullable()});

export const marketingQuery = z.object({organization: z.uuid(), view: z.enum(['summary', 'export', 'entries']), campaign: z.string().regex(/^[a-z0-9][a-z0-9-]{2,59}$/).optional()});
export const marketingCommand = z.discriminatedUnion('action', [
  z.object({action: z.literal('draw'), organization: z.uuid(), campaign: z.string().regex(/^[a-z0-9][a-z0-9-]{2,59}$/)}),
  z.object({action: z.literal('crmFeed'), organization: z.uuid(), enabled: z.boolean()}),
]);

export const BASIS_LABEL: Record<string, string> = {opt_in: 'Signed up', customer: 'Client', lead: 'Website lead', suppressed: 'Opted out'};
export const UNSUBSCRIBE_BASE = 'https://www.yourneighborhoodserviceguy.com/unsubscribe/?t=';

/** Spreadsheet-safe CSV cell: quoted, and formula-looking text is neutralized. */
export function csvCell(value: string | null | undefined): string {
  let v = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return '"' + v.replace(/"/g, '""') + '"';
}

export function splitName(name: string | null): [string, string] {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ['', ''];
  return [parts[0] ?? '', parts.slice(1).join(' ')];
}

/** Subscribed contacts as CSV. Includes each person's personal one-click unsubscribe link. */
export function marketingCsv(contacts: MarketingContact[]): string {
  const header = ['Email', 'First Name', 'Last Name', 'Phone', 'Street', 'City', 'ZIP', 'Source', 'Subscribed On', 'Unsubscribe Link'];
  const rows = contacts.map(c => {
    const [first, last] = splitName(c.name);
    return [c.email, first, last, c.phone, c.street, c.city, c.postalCode, BASIS_LABEL[c.basis] + ' (' + c.source + ')', c.since.slice(0, 10), UNSUBSCRIBE_BASE + c.token].map(csvCell).join(',');
  });
  return '﻿' + [header.map(csvCell).join(','), ...rows].join('\r\n') + '\r\n';
}
