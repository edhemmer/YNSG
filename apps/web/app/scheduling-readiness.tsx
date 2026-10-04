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
  {error?<p role="alert">Setup could not be checked. Refresh after confirming your owner sign-in.</p>:setup?<><ul>{setup.checks.map(check=><li key={check.label}><strong>{check.complete?'Complete':'Needs attention'}: {check.label}</strong>{!check.complete&&<p>{check.action}</p>}</li>)}</ul><p>{setup.publicAvailabilityConfigured?'The business availability endpoint is enabled. The website connection still needs a live booking test.':'Website availability still needs connection and a live booking test.'}</p><p>Weekly dates can be reviewed for the full year. Automatic recurring reservations still need implementation and testing before use.</p></>:<p role="status">Checking scheduling setup…</p>}
  {setup?.background&&<section aria-labelledby="background-setup-heading"><h3 id="background-setup-heading">Background setup</h3><p>These checks show whether the workers can receive a request. They do not confirm that a recurring schedule is running.</p><ul>
   <li>{setup.background.workerCredentialReady?'Ready':'Needs setup'}: protected worker access</li>
   <li>{setup.background.mailSwitchEnabled?'Enabled':'Paused'}: email worker</li>
   <li>{setup.background.calendarSwitchEnabled?'Enabled':'Paused'}: calendar worker</li>
   <li>{setup.background.calendarCompanyMatches?'Ready':'Needs setup'}: calendar worker linked to this business</li>
   <li>{setup.background.deploymentCredentialReady?'Ready':'Needs setup'}: protected deployment access</li>
   <li>{setup.background.schedulerStatus?.credentialsStored?'Stored securely':'Needs setup'}: scheduler credentials</li>
   {setup.background.schedulerStatus?.jobs.map(job=><li key={job.name}>{job.active?'Scheduled':'Paused'}: {job.name==='ynsg-mail-worker'?'email schedule':'calendar schedule'}</li>)}
  </ul><p>A recurring trigger and successful live runs still need verification. Changes to worker settings require a new deployment.</p></section>}
  {setup?.background?.canPrepare&&<section aria-labelledby="prepare-background-heading"><h3 id="prepare-background-heading">Prepare the background schedule</h3><p>After regenerating the automation key in Vercel, redeploy the app branch. Then press the button below to store the matching credentials securely. No keys are shown here. This step pauses both jobs; live verification comes before activation.</p>
   <label><input type="checkbox" checked={rotationConfirmed} disabled={preparing} onChange={event=>setRotationConfirmed(event.target.checked)}/> I regenerated the Vercel automation key and redeployed the app branch.</label>
   <button type="button" className="secondary" disabled={preparing||!rotationConfirmed||!setup.background.workerCredentialReady||!setup.background.deploymentCredentialReady||!setup.background.calendarCompanyMatches} onClick={()=>void prepareBackground()}>{preparing?'Preparing…':'Prepare background schedule'}</button>
   {feedback&&<p role="status">{feedback}</p>}
  </section>}
  <button type="button" className="secondary" onClick={()=>setRetry(v=>v+1)}>Refresh setup status</button>
 </section>;
}
