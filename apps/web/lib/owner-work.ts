import {z} from 'zod';
export const ownerWorkQuery=z.object({organization:z.uuid(),page:z.coerce.number().int().min(0).max(100000).default(0)}).strict();
export const ownerWorkResponse=z.object({checkedAt:z.iso.datetime(),page:z.number().int().nonnegative(),hasMore:z.boolean(),total:z.number().int().nonnegative(),items:z.array(z.object({job:z.uuid(),request:z.uuid(),name:z.string(),address:z.string(),tasks:z.array(z.string()),status:z.enum(['working','paused','completed'])}).strict()).max(20)}).strict();
export type OwnerWork=z.infer<typeof ownerWorkResponse>;
