import {z} from 'zod';
export const jobClockQuery=z.object({organization:z.uuid(),job:z.uuid()}).strict();
export const jobClock=z.object({organization:z.uuid(),job:z.uuid(),actor:z.uuid(),revision:z.number().int().positive(),status:z.enum(['approved','scheduled','en_route','arrived','working','paused','completed','canceled']),checkedAt:z.iso.datetime({offset:true}),closedSeconds:z.number().int().min(0).max(315360000),runningSince:z.iso.datetime({offset:true}).nullable()}).strict().refine(v=>(v.status==='working')===(v.runningSince!==null)&&(!v.runningSince||Date.parse(v.runningSince)<=Date.parse(v.checkedAt)));
export type JobClock=z.infer<typeof jobClock>;
export function clockSeconds(clock:JobClock,elapsedAfterReadMs:number){return clock.closedSeconds+(clock.runningSince?Math.max(0,Math.floor((Date.parse(clock.checkedAt)-Date.parse(clock.runningSince)+Math.max(0,elapsedAfterReadMs))/1000)):0);}
export function clockLabel(seconds:number){const value=Math.max(0,Math.floor(seconds));return Math.floor(value/3600)+':'+String(Math.floor(value/60)%60).padStart(2,'0')+':'+String(value%60).padStart(2,'0');}
