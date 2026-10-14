import {calendarAuthority} from "../../../lib/calendar-authority";
import {mailTransport} from "../../../lib/transactional-mail";
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {visibleBackgroundQueue} from '../../../lib/background-health';
import {authorizeGoogle,store,missingGoogleConfiguration,serverDatabase} from '../../../lib/google-server';
import {verifiedSessionId} from '../../../lib/background-setup';
import {verifyRoutesConnection} from '../../../lib/routes-health';
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
  const authority=await calendarAuthority(org),transport=await mailTransport(org),managedMail=transport?.ready?transport:null;
  const account=missingGoogleConfiguration().length?null:await store(org,'read');
  const rules=configuration.data?.settings?.scheduling;
  // Owner-authenticated, budgeted public-town probe; independent of optional calendar OAuth.
  const routesCheck=verifyRoutesConnection(org).catch(()=>{console.warn('routes_health_unavailable');return 'verification_unavailable';});
  let schedulerStatus=null,executionHealth=null;
  try{
   const result=await serverDatabase().rpc('background_setup',{p_org:org,p_actor:session.user.id,p_session:verifiedSessionId(session.access),p_action:'status'});
   if(!result.error)schedulerStatus=result.data;
   const health=await serverDatabase().rpc('background_health',{p_org:org,p_actor:session.user.id,p_session:verifiedSessionId(session.access)});
   if(!health.error)executionHealth=health.data;
  }catch{ /* Setup remains usable if the deployment registry has not been installed. */ }
  const routesStatus=await routesCheck;
  const verifiedMail=Boolean(managedMail)||Boolean(account?.encrypted_tokens&&account?.health==='healthy'&&account?.gmail_test==='accepted');
  const mailReady=delivery.data?.enabled===true&&verifiedMail&&(Boolean(managedMail)||process.env.GOOGLE_GMAIL_DELIVERY_ENABLED==='true');
  if(executionHealth){
   const checked=new Date(executionHealth.checkedAt);if(!Number.isFinite(checked.getTime()))throw Error('QUEUE_HEALTH_UNAVAILABLE');
   const overdueBefore=new Date(checked.getTime()-300000).toISOString(),checkedAt=checked.toISOString();
   async function counts(calendar:boolean){
    const scope=()=>{const q=db.from('outbox').select('id',{count:'exact',head:true}).eq('organization_id',org);return calendar?q.like('kind','calendar.%'):q.not('kind','like','calendar.%');};
    const waitingStates=['pending','failed','leased','sending'];
    const results=await Promise.all([scope().in('status',['needs_reconciliation','dead_letter']),scope().in('status',waitingStates).lt('next_attempt_at',overdueBefore).or('lease_until.is.null,lease_until.lt.'+checkedAt),scope().in('status',waitingStates)]);
    if(results.some(r=>r.error||r.count===null))throw Error('QUEUE_HEALTH_UNAVAILABLE');
    return {needsReview:results[0]!.count!,overdue:results[1]!.count!,waiting:results[2]!.count!};
   }
   const [mailQueue,calendarQueue]=await Promise.all([counts(false),counts(true)]);
   executionHealth={...executionHealth,queue:visibleBackgroundQueue(mailQueue,calendarQueue,{mail:mailReady,calendar:Boolean(account?.encrypted_tokens&&account?.calendar_id&&process.env.GOOGLE_CALENDAR_WORKER_ENABLED==='true'&&process.env.GOOGLE_WORKER_ORGANIZATION_ID===org)})};
  }

  const checks=[
   {label:'Business settings published',complete:Boolean(configuration.data),action:'Review and publish Company settings below.'},
   {label:'Booking window set to 30 days',complete:rules?.horizonMinutes===43200,action:'Set the booking window to 30 days in Company settings.'},
   {label:'Travel buffer configured',complete:Number.isInteger(rules?.bufferMinutes),action:'Review the travel buffer in Company settings.'},
   {label:'Scheduling enabled for your business',complete:entitlement.data?.enabled===true,action:'Scheduling access needs activation.'},
   {label:'One available operator configured',complete:operators.data?.length===1,action:'The current website calendar requires one available operator.'},
   {label:'Primary appointment calendar ready',complete:authority.source==='crm'||Boolean(account?.encrypted_tokens&&account?.calendar_id&&account?.health==='healthy'),action:'Review your primary appointment calendar.'},
   {label:'Business email service verified',complete:verifiedMail,action:'Verify Business email in Your calendar & notifications.'},
   {label:'Email notifications approved and enabled',complete:mailReady,action:'Verify the business sender and enable appointment notifications.'},
  ];
  return NextResponse.json({checks,websiteCalendarReady:process.env.PUBLIC_AVAILABILITY_ENABLED==='true'&&process.env.PUBLIC_SCHEDULING_ORGANIZATION_ID===org&&checks.slice(0,6).every(check=>check.complete),mailServiceReady:verifiedMail,mailReady,routesStatus,calendarSource:authority.source,optionalGoogleConnected:Boolean(account?.encrypted_tokens&&account?.calendar_id),publicAvailabilityConfigured:process.env.PUBLIC_AVAILABILITY_ENABLED==='true'&&process.env.PUBLIC_SCHEDULING_ORGANIZATION_ID===org,recurringReservationsReady:false,background:{
    workerCredentialReady:Boolean(process.env.GOOGLE_WORKER_SECRET&&process.env.GOOGLE_WORKER_SECRET.length>=32),
    mailSwitchEnabled:mailReady,
    calendarSwitchEnabled:process.env.GOOGLE_CALENDAR_WORKER_ENABLED==='true',
    calendarCompanyMatches:process.env.GOOGLE_WORKER_ORGANIZATION_ID===org,
    deploymentCredentialReady:Boolean(process.env.VERCEL_AUTOMATION_BYPASS_SECRET&&process.env.VERCEL_AUTOMATION_BYPASS_SECRET.length>=32),
    schedulerStatus,executionHealth,
    canPrepare:Boolean(schedulerStatus),
   }},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error&&error.message==='UNAUTHORIZED'?'Sign in as the business owner to check scheduling setup.':error instanceof Error&&error.message==='OWNER_ACCESS_REQUIRED'?'Owner access is required to check scheduling setup.':'Connection status could not be checked. Try again shortly.'},{status:error instanceof Error&&error.message==='UNAUTHORIZED'?401:error instanceof Error&&error.message==='OWNER_ACCESS_REQUIRED'?403:503,headers:{'Cache-Control':'private, no-store'}});}
}
