import {z} from 'zod';

/** Education is a reviewed knowledge product, never authority to perform restricted work. */
const source=z.object({
 publisher:z.string().min(2).max(120),
 url:z.url().refine(u=>u.startsWith('https://')),
 title:z.string().min(3).max(200),
 checkedOn:z.iso.date(),
 applicability:z.string().min(5).max(250),
}).strict();
const step=z.object({
 title:z.string().min(3).max(100),
 instruction:z.string().min(12).max(1200),
 expected:z.string().min(5).max(500),
 stopIf:z.string().min(5).max(500),
 sourceIndexes:z.array(z.number().int().nonnegative()).min(1).max(6),
}).strict();
export const lesson=z.object({
 id:z.string().regex(/^[a-z0-9-]{4,80}$/),
 title:z.string().min(5).max(150),
 category:z.enum(['home-basics','doors-locks','smart-home','electrical-awareness','tools']),
 audience:z.enum(['beginner','experienced','professional-only']),
 publication:z.enum(['draft','expert-reviewed','published']),
 modelScope:z.string().min(6).max(250),
 whereToUse:z.string().min(12).max(400),
 whenToUse:z.string().min(12).max(400),
 skillPrerequisites:z.array(z.string().min(5)).min(1),
 tools:z.array(z.string().min(2)).max(30),
 beforeStart:z.array(z.string().min(10)).min(1),
 warnings:z.array(z.string().min(10)).min(1),
 tips:z.array(z.object({text:z.string().min(10),attribution:z.enum(['manufacturer','trade-reviewed','owner-experience'])}).strict()).max(10),
 steps:z.array(step).min(1).max(30),
 completionChecks:z.array(z.string().min(10)).min(1),
 referToProfessionalWhen:z.array(z.string().min(10)).min(1),
 sources:z.array(source).min(1),
 reviewer:z.object({name:z.string().min(3),qualification:z.string().min(6),reviewedOn:z.iso.date()}).nullable(),
}).strict().superRefine((v,ctx)=>{
 for(const [i,s] of v.steps.entries())for(const n of s.sourceIndexes)if(n>=v.sources.length)ctx.addIssue({code:'custom',path:['steps',i,'sourceIndexes'],message:'Step refers to missing evidence'});
 if(v.publication!=='draft'&&!v.reviewer)ctx.addIssue({code:'custom',path:['reviewer'],message:'Human technical review required before publication'});
 if(v.audience==='professional-only'&&v.publication==='published')ctx.addIssue({code:'custom',message:'Professional-only lessons require restricted educational display'});
});
export type Lesson=z.infer<typeof lesson>;
export function mayShowPublicly(value:unknown){
 const result=lesson.safeParse(value);
 return result.success&&result.data.publication==='published'&&result.data.audience!=='professional-only';
}
/** An AI may transform checked reference material into a draft; it cannot advance publication. */
export function aiLessonProposal(value:unknown){
 const candidate=lesson.parse(value);
 return {...candidate,publication:'draft' as const,reviewer:null};
}
