import {z} from 'zod';
import {preflightForWork,allTrainingTopics} from './owner-job-standards.ts';
import {referralText,publicReferral,type PublicReferral} from './owner-network-recovery.ts';
const line=(max:number)=>z.string().trim().max(max).regex(/^[^\x00-\x1f\x7f]*$/);
export const companionContext=z.object({request:z.uuid(),customer:line(160),company:line(160).min(2),email:z.union([z.email().max(254),z.literal('')]),phase:z.enum(['confirm','agreement','ready','working','paused','invoice','payment','settled','closed','review']),next:line(180)}).strict();
export type CompanionContext=z.infer<typeof companionContext>;
export {publicReferral,type PublicReferral};
export const updateIntents=[['next','Discuss next steps'],['photo','Ask for a photo'],['access','Check access'],['referral','Share a referral']] as const;
export type UpdateIntent=typeof updateIntents[number][0];
const clean=(value:string,max:number)=>value.replace(/[\x00-\x1f\x7f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export function makeCompanionContext(input:{request:string;customer:string;phase:CompanionContext['phase'];next:string;company?:string;email?:string}){const email=z.email().max(254).safeParse(input.email?.trim());return companionContext.parse({request:input.request,customer:clean(input.customer,160),phase:input.phase,next:clean(input.next,180),company:clean(input.company||'Your service team',160),email:email.success?email.data:''});}
export function companionTasks(tasks:string[]){const seen=new Set<string>();return tasks.map(t=>clean(t,160)).filter(t=>{const key=t.toLocaleLowerCase('en-US');if(!t||seen.has(key))return false;seen.add(key);return true;}).slice(0,20);}
export function taskGuidance(tasks:string[]){
 return companionTasks(tasks).map(task=>{const preflight=preflightForWork('',task);return {task,preflight,topic:preflight?allTrainingTopics.find(topic=>topic.id===preflight.topicId)||null:null};});
}
const nextWording:Record<CompanionContext['phase'],string>={
 confirm:'Thank you for reaching out. I’ll review the work you have in mind and follow up about scope, price and timing.',
 agreement:'Let’s review the work on your list and the price before we get started. Please let me know if there is anything else you’d like us to consider.',
 ready:'Before we get started, is there anything you’d like us to know about access or the work we agreed on?',
 working:'Please let me know if there is anything else you’d like us to consider. We’ll discuss any change in scope or cost before proceeding.',
 paused:'Please let me know if there is anything else you’d like us to consider. We’ll discuss any change in scope or cost before proceeding.',
 invoice:'If you have any questions about the work or invoice details, please let me know. I’m happy to talk them through with you.',
 payment:'If you have any questions about your invoice, please let me know. I’m happy to talk through the details with you.',
 settled:'Thank you for choosing us. If you have any questions about the work, please let me know.',
 closed:'Thank you for reaching out. If you need help with another home or yard job, you’re always welcome to get in touch.',
 review:'I’m checking the request details so I can help with the right next step. Please let me know if anything has changed.'
};
/** Local proposal only: no promise of availability, automatic approval, prices,
 * completed work, receipt or delivery. The owner reviews every copied update. */
export function customerUpdate(context:CompanionContext,intent:UpdateIntent,referral:PublicReferral|null=null){
 const c=companionContext.parse(context),name=c.customer||'there';
 const text=intent==='next'?nextWording[c.phase]:intent==='photo'?'A photo of the area or item would help us review the next step. If it’s convenient, could you send one, along with anything you’d like us to know?':intent==='access'?'Is there anything we should know about access, parking, pets or items that need to be moved? A little preparation helps the visit go smoothly.':referral?'If you’d like to contact a specialist, here are their details:\n\n'+referralText(publicReferral(referral))+'\n\nPlease check the scope, availability and pricing directly with them.':'If you’d like to contact a specialist, I can share contact details for you to review. Please check the scope, availability and pricing directly with them.';
 return {subject:'About your service request',body:`Hi ${name},\n\n${text}\n\nThank you,\n${c.company}`};
}
