'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import type {BackgroundSetupStatus} from '../lib/background-setup';
type Setup={checks:{label:string;complete:boolean;action:string}[];publicAvailabilityConfigured:boolean;recurringReservationsReady:boolean;background?:{workerCredentialReady:boolean;mailSwitchEnabled:boolean;calendarSwitchEnabled:boolean;calendarCompanyMatches:boolean;deploymentCredentialReady:boolean;schedulerStatus:BackgroundSetupStatus|null;canPrepare:boolean}};
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
  let live=true;setSetup(null);setError(false);
  void sessionFetch('/api/scheduling-readiness?'+new URLSearchParams({organization}),{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('READ');const data=await r.json();if(live)setSetup(data);}).catch(()=>{if(live)setError(true);});
  return()=>{live=false;};
 },[organization,retry]);
 return <section className="card" aria-labelledby="scheduling-readiness-heading"><h2 id="scheduling-readiness-heading">Scheduling setup</h2>
  {error?<p role="alert">Setup could not be checked. Refresh after confirming your owner sign-in.</p>:setup?<><ul>{setup.checks.map(check=><li key={check.label}><strong>{check.complete?'Complete':'Needs attention'}: {check.label}</strong>{!check.complete&&<p>{check.action}</p>}</li>)}</ul><p>{setup.publicAvailabilityConfigured?'The website calendar connection is configured. A live booking test is still needed.':'Website availability still needs connection and a live booking test.'}</p><p>Weekly dates can be reviewed for the full year. Automatic recurring bookings are not ready to use yet.</p></>:<p role="status">Checking scheduling setup…</p>}
  {setup?.background&&<section aria-labelledby="background-setup-heading"><h3 id="background-setup-heading">Background automation</h3>
   <p>Keep appointment emails and calendar updates moving while you work.</p>
   <ul>
    <li><strong>Connection:</strong> {setup.background.schedulerStatus?.credentialsStored&&setup.background.workerCredentialReady&&setup.background.deploymentCredentialReady&&setup.background.calendarCompanyMatches?'Connected':'Needs attention'}</li>
    <li><strong>Appointment emails:</strong> {setup.background.schedulerStatus===null?'Needs attention':setup.background.mailSwitchEnabled&&setup.background.schedulerStatus.jobs.some(job=>job.name==='ynsg-mail-worker'&&job.active)?'Scheduled':'Paused'}</li>
    <li><strong>Calendar updates:</strong> {setup.background.schedulerStatus===null?'Needs attention':setup.background.calendarSwitchEnabled&&setup.background.calendarCompanyMatches&&setup.background.schedulerStatus.jobs.some(job=>job.name==='ynsg-calendar-worker'&&job.active)?'Scheduled':'Paused'}</li>
   </ul>
   <p>A connected status means your setup is saved. Paused means automatic updates are not running. Email delivery and calendar updates still need live testing.</p>
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
