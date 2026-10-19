'use client';
import {useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {visitState,type InboxRequest} from '../lib/request-inbox';
import {confirmRequestedAppointment,type ApprovalAttempt} from '../lib/quick-approval';
import Icon from './crm-icons';
import {DeclineDecisionFields} from './decline-message-fields';
import {appointmentDeliveryMessage} from '../lib/appointment-delivery';
export default function RequestQuickActions({request,organization,canManage,onReview,onChanged,reviewLabel='Review'}:{request:InboxRequest;organization:string;canManage:boolean;onReview:()=>void;onChanged:()=>void;reviewLabel?:string}) {
 const [action,setAction]=useState<'decline'|null>(null),[pending,setPending]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const declineAttempt=useRef<{path:string;input:Record<string,unknown>}|null>(null);
 const [declineUnknown,setDeclineUnknown]=useState(false);
 const keys=useRef(new Map<string,string>()),reviewedRevision=useRef<number|null>(null),approvalAttempt=useRef<ApprovalAttempt>(null);
 const proposal=request.appointments.find(v=>visitState(v)==='proposal');
 const confirmed=request.appointments.some(v=>visitState(v)==='reserved');
 const manageable=canManage&&['submitted','reviewing','quoted'].includes(request.status);
 async function command(path:string,input:Record<string,unknown>) {
  const fingerprint=JSON.stringify(input);if(!keys.current.has(fingerprint))keys.current.set(fingerprint,crypto.randomUUID());
  const response=await sessionFetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId:organization,key:keys.current.get(fingerprint),...input})});
  const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'Decision unconfirmed'),{definite:response.status>=400&&response.status<500});if(value?.ok!==true||value.result===null||value.result===undefined)throw Error('Decision unconfirmed');
 }
 async function approve() {
  if(pending||!proposal)return;setPending(true);setError('');setMessage('');
  try {if(request.status==='submitted'&&reviewedRevision.current!==request.revision){await command('/api/commands',{command:'ReviewRequest',id:request.id,revision:request.revision,status:'reviewing'});reviewedRevision.current=request.revision;onChanged();}const confirmed=await confirmRequestedAppointment(organization,request.id,proposal.id,approvalAttempt,sessionFetch);setMessage(appointmentDeliveryMessage(confirmed.delivery));onChanged();}
  catch(e){setError(publicError(e));}finally{setPending(false);}
 }
 async function decline(form:HTMLFormElement) {
  if(pending)return;setPending(true);setError('');const fields=new FormData(form);
  try {
   if(!declineAttempt.current)declineAttempt.current=proposal?{path:'/api/scheduling',input:{schemaVersion:1,input:{action:fields.get('choice'),id:proposal.id,revision:proposal.revision,reason:fields.get('reason')}}}:{path:'/api/commands',input:{command:'ReviewRequest',id:request.id,revision:request.revision,status:'declined',reason:String(fields.get('reason')||'')}};
   const timeOnly=(declineAttempt.current.input.input as {action?:string}|undefined)?.action==='decline_time';
   await command(declineAttempt.current.path,declineAttempt.current.input);
   declineAttempt.current=null;setDeclineUnknown(false);
   setAction(null);setMessage(timeOnly?'Time declined. The service request stays open.':'Service request declined.');onChanged();
  }catch(e){if(!declineUnknown&&(e as {definite?:boolean}).definite){declineAttempt.current=null;setError(publicError(e));}else{setDeclineUnknown(true);setError('The decline may already be saved. Check the same saved decision before changing the message or making another decision.');}}finally{setPending(false);}
 }
 return <div className="request-quick-actions">
  <div className="request-action-buttons" role="group" aria-label={'Actions for '+request.original_submission.name}>
   {manageable&&(Boolean(proposal)||!confirmed)&&<><button type="button" disabled={pending||declineUnknown} onClick={()=>proposal?void approve():onReview()} title={!proposal?'Choose an appointment time in Review':undefined}><Icon name="check"/>{pending?'Saving…':proposal?'Approve':'Schedule'}</button><button type="button" className="danger-ghost" disabled={pending||declineUnknown||(!proposal&&request.status==='quoted')} onClick={()=>{setError('');setMessage('');setAction('decline');}}><Icon name="close"/>Decline</button></>}
   <button type="button" className="secondary" disabled={pending} onClick={onReview}><Icon name="search"/>{reviewLabel}<span className="sr-only"> request for {request.original_submission.name}</span></button>
  </div>
  {manageable&&(Boolean(proposal)||!confirmed)&&!proposal&&<p className="tiny">Choose a date and time to book this visit.</p>}
  {manageable&&proposal&&<p className="tiny">Approve uses your standard travel/setup buffer. Review to change the visit details.</p>}
  {error&&<p className="error note" role="alert">{error}</p>}{message&&<p className="note" role="status">{message}</p>}
  {action==='decline'&&<form className="quick-decision" onSubmit={e=>{e.preventDefault();void decline(e.currentTarget);}}><h3>Decline {proposal?'appointment time':'service request'}</h3><fieldset style={{minWidth:0,border:0,padding:0,margin:0,display:'grid',gap:'1rem'}} disabled={pending||declineUnknown}><DeclineDecisionFields organization={organization} proposal={!!proposal}/></fieldset><p>{proposal?'Your decision queues the matching customer message.':'This closes the service request and queues the customer message.'}</p><div className="actions"><button className="danger-button" disabled={pending}>{pending?'Saving…':declineUnknown?'Check saved decline':'Confirm decline'}</button><button className="secondary" type="button" disabled={pending||declineUnknown} onClick={()=>setAction(null)}>Cancel</button></div></form>}
 </div>;
}
