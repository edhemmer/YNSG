'use client';
import {useEffect,useState}from'react';import dynamic from'next/dynamic';
import SchedulingReadiness from'./scheduling-readiness';import GoogleControls from'./google-controls';
import CalendarConnections from'./calendar-connections';import CompanySettings from'./company-settings';
const OwnerSecurity=dynamic(()=>import('./owner-security'));
const MobileNotifications=dynamic(()=>import('./mobile-notifications'));
const RetentionControls=dynamic(()=>import('./privacy-controls').then(m=>m.RetentionControls));
export default function OwnerSettings({organization,name,timezone,focusGoogle,onBusy,onActivity}:{organization:string;name:string;timezone:string;focusGoogle:boolean;onBusy:(busy:boolean)=>void;onActivity:()=>void}){
 const [emailOpen,setEmailOpen]=useState(false),[businessStatus,setBusinessStatus]=useState('Checking settings…');
 useEffect(()=>{if(focusGoogle)document.getElementById('google-setup')?.scrollIntoView({block:'start'})},[focusGoogle]);
 return <section className="owner-settings" aria-label="Business settings">
  <SchedulingReadiness organization={organization} compact onEmailSetup={()=>setEmailOpen(true)} onActivity={onActivity}/>
  <GoogleControls organization={organization} timezone={timezone} view="settings" compact/>
  <div className="settings-preferences">
   <details className="settings-section"><summary><span>Business details, rates &amp; hours<small>{businessStatus}</small></span></summary><CompanySettings organization={organization} name={name} onStatus={setBusinessStatus}/></details>
   <details className="settings-section" open={emailOpen} onToggle={e=>setEmailOpen(e.currentTarget.open)}><summary><span>Email &amp; calendar preferences<small>Delivery controls and optional calendar subscriptions</small></span></summary><CalendarConnections organization={organization} compact/></details>
   <details className="settings-section"><summary><span>Phone alerts<small>Device notification preferences</small></span></summary><MobileNotifications organization={organization} timezone={timezone} onBusy={onBusy}/></details>
   <details className="settings-section"><summary><span>Security &amp; records<small>Sign-in history, retention and privacy requests</small></span></summary><p><a href="/auth/password">Change my password</a></p><OwnerSecurity organization={organization}/><p><a href="/owner/practice">Practice with sample jobs</a></p><p><a href={"/owner/production-check?"+new URLSearchParams({organization})}>Sample invoices and email checks</a></p><RetentionControls organization={organization}/></details>
  </div>
 </section>;
}
