import {z} from 'zod';
export const MAX_NOTE_BYTES=17000;
export const noteTarget=z.object({organization:z.uuid(),type:z.enum(['request','customer']),target:z.uuid()}).strict();
export const noteCommand=noteTarget.extend({body:z.string().trim().min(1).max(4000).regex(/^[^\u0000]*$/),key:z.string().min(16).max(128).regex(/^[^\u0000]*$/)}).strict();
export const noteSaved=z.object({id:z.uuid(),saved:z.literal(true)}).strict();
export const relationshipNote=z.object({id:z.uuid(),body:z.string().min(1).max(4000),created_at:z.iso.datetime({offset:true}),request_id:z.uuid().nullable()}).strict();
export const noteRead=z.object({notes:z.array(relationshipNote).max(51),page:z.number().int().min(0).max(100000)}).strict();
export const noteList=z.object({notes:z.array(relationshipNote).max(50),page:z.number().int().min(0).max(100000),hasMore:z.boolean()}).strict();
