import {z} from 'zod';
export const messageView=z.enum(['attention','recent']);
export const messageQuery=z.object({organization:z.uuid(),page:z.coerce.number().int().min(0).max(100000).default(0),view:messageView.default('attention')}).strict();
export const messageRecord=z.object({id:z.uuid(),kind:z.string().min(1).max(100),status:z.enum(['pending','failed','leased','sending','needs_reconciliation','dead_letter','accepted','suppressed']),object_id:z.uuid(),request_id:z.uuid().nullable(),created_at:z.iso.datetime({offset:true}),next_attempt_at:z.iso.datetime({offset:true}),lease_until:z.iso.datetime({offset:true}).nullable(),attempts:z.number().int().nonnegative()}).strict();
export const messageQueue=z.object({organization:z.uuid(),view:messageView,records:z.array(messageRecord).max(25),total:z.number().int().nonnegative(),page:z.number().int().nonnegative(),hasMore:z.boolean(),enabled:z.boolean(),checkedAt:z.iso.datetime({offset:true})}).strict();
export type MessageQueue=z.infer<typeof messageQueue>;
