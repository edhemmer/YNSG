import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authorizeGoogle,store,missingGoogleConfiguration,serverDatabase} from '../../../lib/google-server';
import {verifiedSessionId} from '../../../lib/background-setup';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const org=z.uuid().parse(new URL(request.url).searchParams.get('organization')),session=await authorizeGoogle(org),{db}=session;
  const [configuration,operators,entitlement,delivery]=await Promise.all([
   db.from('configuration_versions').select('version,settings').eq('organization_id',org).order('version',{ascending:false}).limit(1).maybeSingle(),
   db.from('resources').select('id').eq('organization_id',org).eq('kind','operator').eq('status','available').limit(2),
   db.from('entitlements').select('enabled').eq('organization_id',org).eq('module','scheduling').maybeSingle(),
   db.rpc('mail_delivery_status',{p_org:org}),
  ]);
  if(configuration.error||operators.error||entitlement.error||delivery.error)throw Error('READ');
  const account=missingGoogleConfiguration().length?null:await store(org,'read');
  const rules=configuration.data?.settings?.scheduling;
  let schedulerStatus=null,executionHealth=null;
  try{
   const result=await serverDatabase().rpc('background_setup',{p_org:org,p_actor:session.user.id,p_session:verifiedSessionId(session.access),p_action:'status'});
   if(!result.error)schedulerStatus=result.data;
   const health=await serverDatabase().rpc('background_health',{p_org:org,p_actor:session.user.id,p_session:verifiedSessionId(session.access)});
   if(!health.error)executionHealth=health.data;
  }catch{ /* Setup remains usable if the deployment registry has not been installed. */ }
  const checks=[
   {label:'Business settings published',complete:Boolean(configuration.data),action:'Review and publish Company settings below.'},
   {label:'Booking window set to 30 days',complete:rules?.horizonMinutes===43200,action:'Set the booking window to 30 days in Company settings.'},
   {label:'Travel buffer configured',complete:Number.isInteger(rules?.bufferMinutes),action:'Review the travel buffer in Company settings.'},
   {label:'Scheduling enabled for your business',complete:entitlement.data?.enabled===true,action:'Scheduling access needs activation.'},
   {label:'One available operator configured',complete:operators.data?.length===1,action:'The current website calendar requires one available operator.'},
   {label:'Google connected and business calendar checked',complete:Boolean(account?.encrypted_tokens&&account?.calendar_id&&account?.health==='healthy'),action:'Connect Google and select your business calendar below.'},
   {label:'Gmail test sent successfully',complete:account?.gmail_test==='accepted',action:'Send a Gmail test in Google settings.'},
   {label:'Email notifications approved and enabled',complete:delivery.data?.enabled===true&&process.env.GOOGLE_GMAIL_DELIVERY_ENABLED==='true',action:'Confirm the test arrived, review the sender and enable email notifications in Google settings.'},
  ];
  return NextResponse.json({checks,publicAvailabilityConfigured:process.env.PUBLIC_AVAILABILITY_ENABLED==='true'&&process.env.PUBLIC_SCHEDULING_ORGANIZATION_ID===org,recurringReservationsReady:false,background:{
    workerCredentialReady:Boolean(process.env.GOOGLE_WORKER_SECRET&&process.env.GOOGLE_WORKER_SECRET.length>=32),
    mailSwitchEnabled:process.env.GOOGLE_GMAIL_DELIVERY_ENABLED==='true',
    calendarSwitchEnabled:process.env.GOOGLE_CALENDAR_WORKER_ENABLED==='true',
    calendarCompanyMatches:process.env.GOOGLE_WORKER_ORGANIZATION_ID===org,
    deploymentCredentialReady:Boolean(process.env.VERCEL_AUTOMATION_BYPASS_SECRET&&process.env.VERCEL_AUTOMATION_BYPASS_SECRET.length>=32),
    schedulerStatus,executionHealth,
    canPrepare:Boolean(schedulerStatus),
   }},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:'Sign in as the business owner to check scheduling setup.'},{status:error instanceof Error&&error.message==='UNAUTHORIZED'?401:403,headers:{'Cache-Control':'private, no-store'}});}
}
