import {z} from 'zod';
export const MAX_CALENDAR_BLOCK_BYTES=4096;
const instant=z.iso.datetime({offset:true}).regex(/^(?!0000-)/),revision=z.number().int().positive().max(2147483646);
const range=(v:{start:string|null;end:string|null})=>Boolean(v.start&&v.end&&Date.parse(v.end)>Date.parse(v.start)&&Date.parse(v.end)-Date.parse(v.start)<=366*86400000);
export const calendarBlockCommand=z.object({organization:z.uuid(),id:z.uuid().nullable(),revision:revision.nullable(),start:instant.nullable(),end:instant.nullable(),remove:z.boolean(),key:z.string().min(16).max(128).regex(/^[^\u0000]*$/)}).strict().superRefine((v,ctx)=>{
 if((v.id===null)!==(v.revision===null)|| (v.remove?(!v.id||v.start!==null||v.end!==null):!range(v)))ctx.addIssue({code:'custom',message:'Review the selected block and date range.'});
});
export const calendarBlock=z.object({id:z.uuid(),startsAt:instant,endsAt:instant,revision}).strict().refine(v=>range({start:v.startsAt,end:v.endsAt}),'Invalid saved block range.');
export const calendarBlockList=z.object({blocks:z.array(calendarBlock).max(10000)}).strict().refine(v=>new Set(v.blocks.map(b=>b.id)).size===v.blocks.length,'Duplicate saved block.');
export const calendarBlockSaved=z.object({id:z.uuid(),revision:z.number().int().positive().max(2147483647),removed:z.boolean()}).strict();
export type CalendarBlock=z.infer<typeof calendarBlock>;
export type CalendarBlockCommand=z.infer<typeof calendarBlockCommand>;
export function validateCalendarBlockReceipt(command:CalendarBlockCommand,raw:unknown){const saved=calendarBlockSaved.parse(raw);if(saved.removed!==command.remove||(command.id&&saved.id!==command.id)||saved.revision!==(command.remove?command.revision:command.id?command.revision!+1:1))throw Error('UNVERIFIED');return saved;}
const messages:Record<string,string>={UNAUTHORIZED:'Sign in to continue.',FORBIDDEN:'Your account cannot open or change these time blocks.',CAPACITY_CONFLICT:'An appointment or its buffer overlaps this time. Move the appointment or choose another time.',STALE_REVISION:'This block changed. Your entries are kept. Refresh and review the saved dates.',NOT_FOUND:'This block is no longer available. Refresh the saved blocks.',SETUP_REQUIRED:'Company scheduling setup is required.',VALIDATION:'Choose a valid time range of up to 366 days.',IDEMPOTENCY_CONFLICT:'This retry has different details. Check the original saved attempt.'};
export const calendarBlockRejection=z.object({error:z.enum(Object.values(messages))}).strict();
export function calendarBlockFailure(error:unknown){const code=error instanceof Error?error.message:'';return {status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:messages[code]?409:503,error:messages[code]||'The saved time-block result could not be verified. Check the same saved attempt before changing anything else.'};}
