import {z} from 'zod';
// Owner-only home profile limits mirror private.customer_home_profiles checks.
export const homeProfileLimits=Object.freeze({accessNotes:500,pets:300,parking:300,preferences:1000});
export const homeProfileTarget=z.object({organization:z.uuid(),customer:z.uuid()}).strict();
export const homeProfileFields=z.object({accessNotes:z.string().max(homeProfileLimits.accessNotes),pets:z.string().max(homeProfileLimits.pets),parking:z.string().max(homeProfileLimits.parking),preferences:z.string().max(homeProfileLimits.preferences)}).strict();
export const homeProfileCommand=homeProfileTarget.extend({revision:z.number().int().min(0).max(2147483646),key:z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/),fields:homeProfileFields}).strict();
export const homeProfileRead=homeProfileFields.extend({revision:z.number().int().min(0),updatedAt:z.string().nullable()}).strict();
export const homeProfileSaved=z.object({saved:z.literal(true),revision:z.number().int().min(1)}).strict();
export type HomeProfile=z.infer<typeof homeProfileRead>;
export const emptyHomeProfile:HomeProfile={accessNotes:'',pets:'',parking:'',preferences:'',revision:0,updatedAt:null};
export function hasHomeProfile(p:HomeProfile){return Boolean(p.accessNotes||p.pets||p.parking||p.preferences);}
