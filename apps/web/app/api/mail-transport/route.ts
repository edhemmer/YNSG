import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authorizeGoogle,serverDatabase} from '../../../lib/google-server';
import {sameOrigin,failure} from '../../../lib/session';
import {verifiedSessionId} from '../../../lib/background-setup';
import {centralSender,centralReady,sendCentralEmail} from '../../../lib/central-mail';
import {emailIdentity} from '../../../../../lib/email-layout.js';
import {googleTestMessage} from '../../../lib/google-test-message';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(request:Request){try{
 const org=z.uuid().parse(new URL(request.url).searchParams.get('organization'));const s=await authorizeGoogle(org);
 const r=await s.db.rpc('transactional_mail_status',{p_org:org});if(r.error)throw Error('MAIL_STATUS_UNAVAILABLE');
 return NextResponse.json({enabled:Boolean(r.data?.enabled)&&(r.data?.provider!=='resend'||centralReady(r.data.sender)),sender:r.data?.sender||null},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}
export async function POST(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403});try{
 const {organization:org,key,action}=z.object({organization:z.uuid(),key:z.uuid(),action:z.enum(['verify','pause']).default('verify')}).strict().parse(await request.json());const s=await authorizeGoogle(org);
 if(action==='pause'){const r=await s.db.rpc('pause_transactional_mail',{p_org:org});if(r.error)throw Error('MAIL_PAUSE_UNAVAILABLE');return NextResponse.json({enabled:false},{headers:{'Cache-Control':'no-store'}})}
 const cfg=await s.db.from('configuration_versions').select('settings').eq('organization_id',org).order('version',{ascending:false}).limit(1).single();if(cfg.error||s.user.email?.toLowerCase()!==cfg.data.settings.notificationRecipient?.toLowerCase())throw Error('OWNER_RECIPIENT_REQUIRED');
 const sender=centralSender(),identity=emailIdentity(cfg.data.settings,org),m=googleTestMessage(cfg.data.settings.displayName,identity,'business');
 const id=await sendCentralEmail(org,key,{to:cfg.data.settings.notificationRecipient,subject:'[SAMPLE OWNER] Business email connection test',body:m.body,html:m.html,replyTo:cfg.data.settings.sender});
 const verified=await serverDatabase().rpc('activate_central_mail',{p_org:org,p_actor:s.user.id,p_session:verifiedSessionId(s.access),p_origin:new URL(process.env.APP_ORIGIN!).origin,p_sender:sender});if(verified.error)throw Error('MAIL_ACTIVATION_UNAVAILABLE');
 return NextResponse.json({accepted:true,sender,enabled:true,id},{headers:{'Cache-Control':'no-store'}});
}catch(e){const code=e instanceof Error?e.message:'';
 if(code.startsWith('MAIL_')){console.warn('Business email setup needs attention',{code});return NextResponse.json({error:'Business email needs attention. Contact your platform administrator. Your appointment schedule still works.'},{status:503,headers:{'Cache-Control':'no-store'}})}
 return failure(e)}}
