import {z} from 'zod';
import {crewTerms} from './crew-billing.ts';
import {invoiceDraftSchema} from './invoice-draft-input.ts';
export const fieldLaborQuery=z.object({organization:z.uuid(),job:z.uuid()}).strict();
export const fieldLaborContext=fieldLaborQuery.extend({crew:crewTerms.nullable(),draft:z.object({lines:invoiceDraftSchema.shape.lines,jobRevision:z.number().int().positive()}).strict().nullable()}).strict();
export const fieldInvoiceWorkContext=fieldLaborContext.extend({canIssue:z.boolean(),configuration:z.record(z.string(),z.json()),tax:z.object({required:z.boolean(),valid:z.boolean(),tax:z.object({taxCents:z.number().int().min(0).max(999999999)}).strict().nullable()}).strict()}).strict();
