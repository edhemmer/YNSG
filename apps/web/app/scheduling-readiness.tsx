'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {workerHealth,type BackgroundHealth} from '../lib/background-health';
import type {BackgroundSetupStatus} from '../lib/background-setup';
type Setup={checks:{label:string;complete:boolean;action:string}[];publicAvailabilityConfigured:boolean;recurringReservationsReady:boolean;background?:{workerCredentialReady:boolean;mailSwitchEnabled:boolean;calendarSwitchEnabled:boolean;calendarCompanyMatches:boolean;deploymentCredentialReady:boolean;schedulerStatus:BackgroundSetupStatus|null;executionHealth?:BackgroundHealth|null;canPrepare:boolean}};
export default function SchedulingReadiness({organization}:{organization:string}){
 const [setup,setSetup]=useState<Setup|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const [rotationConfirmed,setRotationConfirmed]=useState(false),[preparing,setPreparing]=useState(false),[feedback,setFeedback]=useState('');
 useEffect(()=>{setRotationConfirmed(false);setFeedback('');},[organization]);
 async function prepareBackground(){
  if(preparing||!rotationConfirmed)return;setPreparing(true);setFeedback('');
  try{
   const response=await sessionFetch('/api/background-setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,rotationConfirmed:true})});
   const data=await response.json();
   if(!response.ok){setFeedback(data.error||'Setup could not be completed. Please try again.');return;}
   setFeedback(data.message);setRotationConfirmed(false);setRetry(v=>v+1);
  }catch{setFeedback('Setup could not be confirmed. Refresh setup status before trying again.');}finally{setPreparing(false);}
 }
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
  void load();const timer=setInterval(()=>{void load();},60000);
  return()=>{live=false;clearInterval(timer);controller?.abort();};
 },[organization,retry]);
 return <section className="card" aria-labelledby="scheduling-readiness-heading"><h2 id="scheduling-readiness-heading">Scheduling setup</h2>
  {error?<p role="alert">Setup could not be checked. Refresh after confirming your owner sign-in.</p>:setup?<><ul>{setup.checks.map(check=><li key={check.label}><strong>{check.complete?'Complete':'Needs attention'}: {check.label}</strong>{!check.complete&&<p>{check.action}</p>}</li>)}</ul><p>{setup.publicAvailabilityConfigured?'The website calendar connection is configured. A live booking test is still needed.':'Website availability still needs connection and a live booking test.'}</p><p>Weekly dates can be reviewed for the full year. Automatic recurring bookings are not ready to use yet.</p></>:<p role="status">Checking scheduling setup…</p>}
  {setup?.background&&<section aria-labelledby="background-setup-heading"><h3 id="background-setup-heading">Background automation</h3>
   <p>Keep appointment emails and calendar updates moving while you work.</p>
   <ul>
    <li><strong>Connection:</strong> {setup.background.schedulerStatus?.credentialsStored&&setup.background.workerCredentialReady&&setup.background.deploymentCredentialReady&&setup.background.calendarCompanyMatches?'Connected':'Needs attention'}</li>
    <li><strong>Appointment emails:</strong> {setup.background.schedulerStatus===null?'Needs attention':workerHealth(setup.background.executionHealth,'mail',setup.background.schedulerStatus.jobs.some(job=>job.name==='ynsg-mail-worker'&&job.active),setup.background.mailSwitchEnabled)}</li>
    <li><strong>Calendar updates:</strong> {setup.background.schedulerStatus===null?'Needs attention':workerHealth(setup.background.executionHealth,'calendar',setup.background.schedulerStatus.jobs.some(job=>job.name==='ynsg-calendar-worker'&&job.active),setup.background.calendarSwitchEnabled&&setup.background.calendarCompanyMatches)}</li>
   </ul>
   <p>Running means the background worker has responded successfully within the last three minutes. Paused means automatic updates are off. This checks the connection; individual emails and calendar changes still need delivery verification.</p>
   {setup.background.executionHealth&&(setup.background.executionHealth.queue.needsReview>0||setup.background.executionHealth.queue.overdue>0)&&<p role="alert">{setup.background.executionHealth.queue.needsReview>0?`${setup.background.executionHealth.queue.needsReview} notification(s) need delivery review. `:''}{setup.background.executionHealth.queue.overdue>0?`${setup.background.executionHealth.queue.overdue} notification(s) are taking longer than expected.`:''} Check notification status before resending.</p>}
   <details><summary>Advanced settings</summary>
    <p>These checks are for initial setup and troubleshooting.</p>
    <ul>
     <li>{setup.background.workerCredentialReady?'Ready':'Needs attention'}: secure automation access</li>
     <li>{setup.background.deploymentCredentialReady?'Ready':'Needs attention'}: app connection</li>
     <li>{setup.background.calendarCompanyMatches?'Ready':'Needs attention'}: business calendar connection</li>
     <li>{setup.background.schedulerStatus?.credentialsStored?'Saved securely':'Needs attention'}: automation settings</li>
    </ul>
    {setup.background.canPrepare&&<section aria-labelledby="connect-background-heading"><h4 id="connect-background-heading">Connect background automation</h4>
     <p>Use this after automation access has been renewed and the app update published. Connecting saves the settings securely and pauses automatic emails and calendar updates until testing is complete.</p>
     <label><input type="checkbox" checked={rotationConfirmed} disabled={preparing} onChange={event=>setRotationConfirmed(event.target.checked)}/> I confirm automation access was renewed and the app update published.</label>
     <button type="button" className="secondary" disabled={preparing||!rotationConfirmed||!setup.background.workerCredentialReady||!setup.background.deploymentCredentialReady||!setup.background.calendarCompanyMatches} onClick={()=>void prepareBackground()}>{preparing?'Connecting…':'Connect background automation'}</button>
    </section>}
   </details>
   {feedback&&<p role="status">{feedback}</p>}
  </section>}
  <button type="button" className="secondary" onClick={()=>setRetry(v=>v+1)}>Refresh setup status</button>
 </section>;
}
