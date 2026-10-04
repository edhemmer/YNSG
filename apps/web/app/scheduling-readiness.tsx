'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
type Setup={checks:{label:string;complete:boolean;action:string}[];publicAvailabilityConfigured:boolean;recurringReservationsReady:boolean;background?:{workerCredentialReady:boolean;mailSwitchEnabled:boolean;calendarSwitchEnabled:boolean;calendarCompanyMatches:boolean}};
export default function SchedulingReadiness({organization}:{organization:string}){
 const [setup,setSetup]=useState<Setup|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
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
  </ul><p>A recurring trigger and successful live runs still need verification. Changes to worker settings require a new deployment.</p></section>}
  <button type="button" className="secondary" onClick={()=>setRetry(v=>v+1)}>Refresh setup status</button>
 </section>;
}
