'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {workerHealth,type BackgroundHealth} from '../lib/background-health';
import type {BackgroundSetupStatus} from '../lib/background-setup';
type Setup={checks:{label:string;complete:boolean;action:string}[];publicAvailabilityConfigured:boolean;recurringReservationsReady:boolean;background?:{workerCredentialReady:boolean;mailSwitchEnabled:boolean;calendarSwitchEnabled:boolean;calendarCompanyMatches:boolean;deploymentCredentialReady:boolean;schedulerStatus:BackgroundSetupStatus|null;executionHealth?:BackgroundHealth|null;canPrepare:boolean}};
export default function SchedulingReadiness({organization}:{organization:string}){
 const [setup,setSetup]=useState<Setup|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let live=true,controller:AbortController|null=null;setSetup(null);setError(false);
  async function load(){
   if(controller)return;
   const current=new AbortController();controller=current;
   const deadline=setTimeout(()=>current.abort(),20000);
   try{
    const response=await sessionFetch('/api/scheduling-readiness?'+new URLSearchParams({organization}),{cache:'no-store',signal:current.signal});
    if(!response.ok)throw Error('READ');const data=await response.json();
    if(live){setSetup(data);setError(false);}
   }catch{if(live){setError(true);setSetup(null);}}
   finally{clearTimeout(deadline);if(controller===current)controller=null;}
  }
  void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},60000);
  return()=>{live=false;clearInterval(timer);controller?.abort();};
 },[organization,retry]);
 return <section className="card" aria-labelledby="scheduling-readiness-heading"><h2 id="scheduling-readiness-heading">Connections &amp; automation</h2>
  {error?<p role="alert">Connection status could not be checked. Press Refresh status to try again.</p>:!setup?<p role="status">Checking connections…</p>:<>
   <ul>
    <li><strong>Website calendar:</strong> {setup.publicAvailabilityConfigured&&setup.checks.every(check=>check.complete)?'Configured':'Needs attention'}</li>
    <li><strong>Appointment emails:</strong> {!setup.background?.schedulerStatus?'Needs attention':workerHealth(setup.background.executionHealth,'mail',setup.background.schedulerStatus.jobs.some(job=>job.name==='ynsg-mail-worker'&&job.active),setup.background.mailSwitchEnabled)}</li>
    <li><strong>Calendar updates:</strong> {!setup.background?.schedulerStatus?'Needs attention':workerHealth(setup.background.executionHealth,'calendar',setup.background.schedulerStatus.jobs.some(job=>job.name==='ynsg-calendar-worker'&&job.active),setup.background.calendarSwitchEnabled&&setup.background.calendarCompanyMatches)}</li>
   </ul>
   <p>When running, automatic updates continue when you close the app. Check Activity for individual message and calendar results.</p>
   {setup.background?.executionHealth&&(setup.background.executionHealth.queue.needsReview>0||setup.background.executionHealth.queue.overdue>0)&&<p role="alert">{setup.background.executionHealth.queue.needsReview>0?`${setup.background.executionHealth.queue.needsReview} notification(s) need review. `:''}{setup.background.executionHealth.queue.overdue>0?`${setup.background.executionHealth.queue.overdue} notification(s) are taking longer than expected.`:''} Open Activity to review them.</p>}
  </>}
  <button type="button" className="secondary" onClick={()=>setRetry(v=>v+1)}>Refresh status</button>
 </section>;
}
