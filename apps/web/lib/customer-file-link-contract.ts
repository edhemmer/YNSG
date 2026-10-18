import {z} from 'zod';
import {customerFileRecord} from './customer-file-contract.ts';
export const fileLinkKind=z.enum(['customer','job','invoice','expense']);
export const fileLinkCommand=z.object({organization:z.uuid(),customer:z.uuid(),file:z.uuid(),revision:z.number().int().min(0).max(99),kind:fileLinkKind,target:z.uuid(),reason:z.string().trim().min(10).max(300),reviewed:z.literal(true),key:z.uuid()}).strict().refine(v=>v.kind!=='customer'||v.target===v.customer);
export const fileLinkSaved=z.object({file:z.uuid(),revision:z.number().int().min(1).max(100),kind:fileLinkKind,target:z.uuid()}).strict();
export function verifyFileLinkSaved(input:z.infer<typeof fileLinkCommand>,value:unknown){const r=fileLinkSaved.parse(value);if(r.file!==input.file||r.revision!==input.revision+1||r.kind!==input.kind||r.target!==input.target)throw Error('UNVERIFIED_FILE_LINK');return r;}
export const fileLinkQuery=z.object({organization:z.uuid(),customer:z.uuid(),file:z.uuid().optional(),kind:z.enum(['job','invoice','expense']).optional(),search:z.string().trim().max(80).optional(),page:z.coerce.number().int().min(0).max(10000).optional()}).strict().refine(v=>!(v.file&&v.kind)&&(!(v.search||v.page!==undefined)||!!v.kind));
const event=z.object({revision:z.number().int().min(1).max(100),kind:fileLinkKind,target:z.uuid(),reason:z.string().min(10).max(300),label:z.string().min(1).max(300),linkedAt:z.iso.datetime({offset:true})}).strict();
export const fileLinkWorkspace=z.object({organization:z.uuid(),customer:z.uuid(),complete:z.literal(true),files:z.array(customerFileRecord.extend({link:event.nullable()})).max(250)}).strict();
export const fileLinkHistory=z.object({organization:z.uuid(),customer:z.uuid(),file:z.uuid(),complete:z.literal(true),events:z.array(event).max(100)}).strict();
export const fileLinkTargets=z.object({organization:z.uuid(),customer:z.uuid(),kind:z.enum(['job','invoice','expense']),search:z.string().max(80),page:z.number().int().min(0),hasMore:z.boolean(),rows:z.array(z.object({id:z.uuid(),label:z.string().min(1).max(300)}).strict()).max(50)}).strict();
export type FileLinkInput=z.infer<typeof fileLinkCommand>;
export type LinkedFile=z.infer<typeof fileLinkWorkspace>['files'][number];
