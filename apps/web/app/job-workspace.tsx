'use client';

import {useEffect,useState,type ReactNode} from 'react';
import JobRecordTabs, {type JobPanel} from './job-record-tabs';

/** Shared record frame for office and assigned-field work. Business commands stay in the panels. */
export default function JobWorkspace({id,title,address,kind,status,panel,onPanel,blocked,actions,context,feedback,children,className='',label}:{
  id:string; title:string; address:string; kind:string; status:string;
  panel:JobPanel; onPanel:(panel:JobPanel)=>void; blocked:boolean;
  actions:ReactNode; context:ReactNode; feedback?:ReactNode; children:ReactNode;
  className?:string; label?:string;
}) {
  const [referenceOpen,setReferenceOpen]=useState(false);
  useEffect(()=>{
    const query=window.matchMedia?.('(min-width: 1200px)');
    if(!query)return;
    const update=()=>setReferenceOpen(query.matches);
    update();query.addEventListener('change',update);
    return ()=>query.removeEventListener('change',update);
  },[]);
  return <section className={'job-record job-workspace '+className} aria-label={label||'Job for '+title}>
    <header className="job-record-header">
      <div className="job-record-identity">
        <div className="job-record-overline"><span className="job-record-kicker">{kind}</span><span className="job-record-status" role="status">{status}</span></div>
        <h1 id={'job-title-'+id} tabIndex={-1}>{title}</h1>
        <p>{address}</p>
      </div>
      <div className="field-contact-actions">{actions}</div>
    </header>
    <JobRecordTabs id={id} panel={panel} onChange={onPanel} blocked={blocked}/>
    {feedback}
    <div className="job-workspace-grid">
      <div className="job-record-body">{children}</div>
      <aside className="job-context" aria-label="Job reference">
        <details open={referenceOpen} onToggle={event=>setReferenceOpen(event.currentTarget.open)}><summary>Job reference</summary><div className="job-context-content">{context}</div></details>
      </aside>
    </div>
  </section>;
}
