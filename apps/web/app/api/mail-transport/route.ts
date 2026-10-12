import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authorizeGoogle,serverDatabase} from '../../../lib/google-server';
import {sameOrigin,failure} from '../../../lib/session';
import {verifiedSessionId} from '../../../lib/background-setup';
import {mailRelay} from '../../../lib/transactional-mail';
import {emailIdentity} from '../../../../../lib/email-layout.js';
import {googleTestMessage} from '../../../lib/google-test-message';
export const runtime='nodejs';export const maxDuration=60;
function origin(org:string){const value=process.env.TRANSACTIONAL_EMAIL_RELAY_ORIGIN||(org==='a933d657-14d3-46b6-85e6-21d973e4ed97'?'https://www.yourneighborhoodserviceguy.com':'');if(!value)throw Error('MAIL_ORIGIN_REQUIRED');return new URL(value).origin;}
export async function GET(request:Request){try{const org=z.uuid().parse(new URL(request.url).searchParams.get('organization'));const s=await authorizeGoogle(org);const r=await s.db.rpc('transactional_mail_status',{p_org:org});if(r.error)throw Error('MAIL_STATUS_UNAVAILABLE');return NextResponse.json(r.data,{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e)}}
export async function POST(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403});try{
 const {organization:org,key}=z.object({organization:z.uuid(),key:z.uuid()}).strict().parse(await request.json());const s=await authorizeGoogle(org);
 const cfg=await s.db.from('configuration_versions').select('settings').eq('organization_id',org).order('version',{ascending:false}).limit(1).single();if(cfg.error||s.user.email?.toLowerCase()!==cfg.data.settings.notificationRecipient?.toLowerCase())throw Error('OWNER_RECIPIENT_REQUIRED');
 const destination=origin(org),status=await mailRelay(org,destination,'status');if(!status.ready)throw Error('MAIL_SERVICE_REQUIRED');
 const identity=emailIdentity(cfg.data.settings,org),m=googleTestMessage(cfg.data.settings.displayName,identity);
 const result=await mailRelay(org,destination,'send',key,{to:cfg.data.settings.notificationRecipient,subject:'[SAMPLE OWNER] Business email connection test',body:m.body.replaceAll('Gmail','business email'),html:m.html.replaceAll('Gmail','business email'),replyTo:cfg.data.settings.notificationRecipient});if(!result.accepted)throw Error('MAIL_PROVIDER_UNAVAILABLE');
 const verified=await serverDatabase().rpc('activate_transactional_mail',{p_org:org,p_actor:s.user.id,p_session:verifiedSessionId(s.access),p_origin:destination,p_sender:status.sender});if(verified.error)throw Error('MAIL_ACTIVATION_UNAVAILABLE');
 return NextResponse.json({accepted:true,provider:'resend',sender:status.sender,enabled:true,id:result.id},{headers:{'Cache-Control':'no-store'}});
}catch(e){const code=e instanceof Error?e.message:'';const messages:Record<string,string>={MAIL_API_KEY_REQUIRED:'Add RESEND_API_KEY to the website Production environment, then redeploy.',MAIL_SENDER_REQUIRED:'Set TRANSACTIONAL_EMAIL_FROM to an address on your verified Resend domain in the website Production environment, then redeploy.',MAIL_VERIFIED_DOMAIN_REQUIRED:'The configured email sender uses the Resend testing domain. Verify your business domain in Resend, then set TRANSACTIONAL_EMAIL_FROM on the website Production environment and redeploy.',MAIL_SENDER_DOMAIN_REJECTED:'Resend did not accept the sender domain. Complete its domain verification and check TRANSACTIONAL_EMAIL_FROM before retrying.',MAIL_TEST_RECIPIENT_RESTRICTED:'Resend is restricting the sender to test recipients. Verify your business domain and use an address on that domain for TRANSACTIONAL_EMAIL_FROM.',MAIL_API_KEY_REJECTED:'Resend rejected the configured API key. Replace RESEND_API_KEY in the website Production environment and redeploy.',MAIL_KEY_REQUIRED:'The secure website email connection is missing its server configuration. Contact support.',MAIL_PROVIDER_UNAVAILABLE:'The email provider did not accept the test. Notifications remain disabled; no customer message was sent.'};return messages[code]?NextResponse.json({error:messages[code],code},{status:503,headers:{'Cache-Control':'no-store'}}):failure(e)}}
