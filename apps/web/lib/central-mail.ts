import {providerEmail,providerSender} from '../../../lib/transactional-email.js';
import type {BusinessMessage} from './transactional-mail-message.ts';
export function centralSender(env:NodeJS.ProcessEnv=process.env){return providerSender({RESEND_API_KEY:env.RESEND_API_KEY,TRANSACTIONAL_EMAIL_FROM:env.TRANSACTIONAL_EMAIL_FROM});}
export function centralReady(sender:string,env:NodeJS.ProcessEnv=process.env){try{return centralSender(env)===sender}catch{return false}}
// Caller validates the owner/tenant and persisted outbox before selecting a recipient.
// Each tenant uses the same platform credential; owners never supply provider credentials.
export async function sendCentralEmail(org:string,id:string,message:BusinessMessage,transport:typeof fetch=fetch,env:NodeJS.ProcessEnv=process.env){
 if(!message.replyTo)throw Error('MAIL_REPLY_ADDRESS_REQUIRED');
 const result=await providerEmail({...message,action:'send',organization:org,id,html:message.html||'',attachment:message.attachment?{filename:message.attachment.filename,content:Buffer.from(message.attachment.bytes).toString('base64')}:undefined},{RESEND_API_KEY:env.RESEND_API_KEY,TRANSACTIONAL_EMAIL_FROM:env.TRANSACTIONAL_EMAIL_FROM},transport);
 if(!result.accepted||typeof result.id!=='string')throw Error('MAIL_PROVIDER_UNAVAILABLE');return result.id as string;
}
