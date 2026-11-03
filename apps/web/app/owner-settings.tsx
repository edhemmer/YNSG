'use client';

import {useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
import {useEntrySafety} from './entry-safety';
import SchedulingReadiness from './scheduling-readiness';
import GoogleControls from './google-controls';
import CalendarConnections from './calendar-connections';
import CompanySettings from './company-settings';
import Icon from './crm-icons';

const OwnerSecurity=dynamic(()=>import('./owner-security'));
const MobileNotifications=dynamic(()=>import('./mobile-notifications'));
const RetentionControls=dynamic(()=>import('./privacy-controls').then(module=>module.RetentionControls));
const destinations=[['connections','Connections','refresh'],['business','Business','work'],['alerts','Phone alerts','bell'],['security','Security & records','settings']] as const;
type Destination=typeof destinations[number][0];

export default function OwnerSettings({organization,name,timezone,focusGoogle,focusServices=false,onBusy,onActivity}:{organization:string;name:string;timezone:string;focusGoogle:boolean;focusServices?:boolean;onBusy:(busy:boolean)=>void;onActivity:()=>void}) {
  const {canLeave}=useEntrySafety();
  const initial=focusServices?'business':'connections';
  const [section,setSection]=useState<Destination>(initial);
  const [visited,setVisited]=useState<Destination[]>([initial]);
  const [deliveryOpen,setDeliveryOpen]=useState(false);
  function open(next:Destination){setSection(next);setVisited(previous=>previous.includes(next)?previous:[...previous,next]);}
  useEffect(()=>{if(focusServices){setSection('business');setVisited(previous=>previous.includes('business')?previous:[...previous,'business']);}},[focusServices]);
  useEffect(()=>{if(focusGoogle){setSection('connections');setVisited(previous=>previous.includes('connections')?previous:[...previous,'connections']);}},[focusGoogle]);

  return <section className="owner-settings settings-workspace" aria-label="Business settings">
    <nav className="settings-navigation" aria-label="Settings categories">
      {destinations.map(([key,label,icon])=><button type="button" key={key} aria-pressed={section===key} onClick={()=>open(key)}><Icon name={icon}/><span>{label}</span></button>)}
      <a href={'/owner/taxes?'+new URLSearchParams({organization})} onClick={event=>{if(!canLeave())event.preventDefault();}}><Icon name="money"/><span>Taxes & invoice setup</span></a>
    </nav>
    <div className="settings-content">
      {visited.includes('connections')&&<section className="settings-destination" aria-label="Connections" hidden={section!=='connections'}>
        <GoogleControls organization={organization} timezone={timezone} view="settings" compact/>
        <SchedulingReadiness organization={organization} compact onEmailSetup={()=>setDeliveryOpen(true)} onActivity={onActivity}/>
        <details id="settings-delivery" className="settings-section" open={deliveryOpen} onToggle={event=>setDeliveryOpen(event.currentTarget.open)}><summary>Email & calendar preferences</summary><CalendarConnections organization={organization} compact/></details>
      </section>}
      {visited.includes('business')&&<section className="settings-destination" aria-label="Business preferences" hidden={section!=='business'}>
        <CompanySettings organization={organization} name={name} focusServices={focusServices}/>
      </section>}
      {visited.includes('alerts')&&<section className="settings-destination" aria-label="Phone alerts" hidden={section!=='alerts'}>
        <MobileNotifications organization={organization} timezone={timezone} onBusy={onBusy}/>
      </section>}
      {visited.includes('security')&&<section className="settings-destination" aria-label="Security and records" hidden={section!=='security'}>
        <section className="card"><h2>Security & records</h2><p><a href="/auth/password">Change my password</a></p><OwnerSecurity organization={organization}/></section>
        <RetentionControls organization={organization}/>
        <details className="settings-section"><summary>Practice & diagnostics</summary><p><a href="/owner/practice">Practice with sample jobs</a></p><p><a href={'/owner/production-check?'+new URLSearchParams({organization})}>Sample invoices and email checks</a></p></details>
      </section>}
    </div>
  </section>;
}
