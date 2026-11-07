'use client';
import {useId,useMemo,useState} from 'react';
import {businessIdentity} from '../../../lib/business-identity.js';
import {emailDraftUrl} from '../lib/decline-message';
import {brandedEmailHtml,emailPlainText} from '../lib/email-templates';
import {visitReportDraft,visitReportReady,visitReportLimits,type VisitReport} from '../lib/visit-report';
import {useUnsavedEntry} from './entry-safety';

// Owner composes a visit report and sends it from their own email app, attaching photos there.
export default function VisitReportComposer({name,email,organization,today}:{name:string;email:string;organization:string;today:string}){
 const id=useId();
 const [report,setReport]=useState<VisitReport>({customerName:name,visitDate:today,workDone:'',noticed:'',photosAttached:true,nextVisit:'',reviewLink:businessIdentity.googleReviewUrl});
 const [recipient,setRecipient]=useState(email),[notice,setNotice]=useState(''),[dirty,setDirty]=useState(false);
 useUnsavedEntry('visit-report:'+organization+':'+email,dirty);
 const draft=useMemo(()=>visitReportDraft(report),[report]),ready=visitReportReady(report)&&recipient.includes('@');
 const plain=emailPlainText(draft),mail=ready?emailDraftUrl(recipient,draft.subject,plain):null,href=mail&&mail.length<=1800?mail:null;
 function change(patch:Partial<VisitReport>){setReport(r=>({...r,...patch}));setDirty(true);setNotice('');}
 async function copy(){
  if(!ready)return;
  try{
   if(typeof ClipboardItem!=='undefined'&&navigator.clipboard?.write)await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([brandedEmailHtml(draft)],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})})]);
   else await navigator.clipboard.writeText(plain);
   setDirty(false);setNotice('Visit report copied. Paste it into a new email to '+recipient+', attach your before-and-after photos, and send.');
  }catch{setNotice('Could not copy. Select the preview text and copy it manually.');}
 }
 return <details className="visit-report"><summary>Visit report</summary>
  <section className="visit-report-editor" aria-label="Visit report composer">
   <p>Send a short record of the visit: what you did, what you noticed, your photos and the 7-day promise. Customers rarely get this from anyone else.</p>
   <label htmlFor={id+'-to'}>To<input id={id+'-to'} type="email" maxLength={254} value={recipient} onChange={e=>{setRecipient(e.target.value);setNotice('');}} placeholder="Customer email address"/></label>
   <label htmlFor={id+'-date'}>Visit date<input id={id+'-date'} type="date" value={report.visitDate} onChange={e=>change({visitDate:e.target.value})}/></label>
   <label htmlFor={id+'-work'}>What we did <span className="tiny">(one item per line)</span><textarea id={id+'-work'} rows={5} maxLength={visitReportLimits.workDone} value={report.workDone} placeholder={'Assembled the dresser\nHung 4 pictures in the hallway\nReplaced the front doorknob'} onChange={e=>change({workDone:e.target.value})}/></label>
   <label htmlFor={id+'-noticed'}>What we noticed <span className="tiny">(optional)</span><textarea id={id+'-noticed'} rows={3} maxLength={visitReportLimits.noticed} value={report.noticed} placeholder="The back gate latch is loose. Worth fixing before winter." onChange={e=>change({noticed:e.target.value})}/></label>
   <label htmlFor={id+'-next'}>Suggested next visit <span className="tiny">(optional)</span><input id={id+'-next'} maxLength={visitReportLimits.nextVisit} value={report.nextVisit} placeholder="Spring cleanup and mulch in April" onChange={e=>change({nextVisit:e.target.value})}/></label>
   <label className="visit-report-check"><input type="checkbox" checked={report.photosAttached} onChange={e=>change({photosAttached:e.target.checked})}/> I’ll attach before-and-after photos</label>
   <div className="visit-report-actions">
    <button type="button" className="primary" disabled={!ready} onClick={()=>void copy()}>Copy report email</button>
    {href?<a className="button" href={href}>Open in email app</a>:<span className="tiny">{ready?'Too long to open directly; use Copy instead.':'Add a valid email, a visit date and at least one item you did.'}</span>}
   </div>
   {notice&&<p role="status">{notice}</p>}
   <h4>Preview</h4>
   <div className="visit-report-preview"><p><strong>Subject:</strong> {draft.subject}</p><pre>{plain}</pre></div>
  </section>
 </details>;
}
