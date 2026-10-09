'use client';
import {useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {visitState,type InboxRequest} from '../lib/request-inbox';
import {confirmRequestedAppointment,type ApprovalAttempt} from '../lib/quick-approval';
import Icon from './crm-icons';
import {appointmentDeliveryMessage} from '../lib/appointment-delivery';
export default function RequestQuickActions({request,organization,canManage,onReview,onChanged}:{request:InboxRequest;organization:string;canManage:boolean;onReview:()=>void;onChanged:()=>void}) {
 const [action,setAction]=useState<'decline'|null>(null),[pending,setPending]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const keys=useRef(new Map<string,string>()),reviewedRevision=useRef<number|null>(null),approvalAttempt=useRef<ApprovalAttempt>(null);
 const proposal=request.appointments.find(v=>visitState(v)==='proposal');
 const confirmed=request.appointments.some(v=>visitState(v)==='reserved');
 const manageable=canManage&&['submitted','reviewing','quoted'].includes(request.status);
 async function command(path:string,input:Record<string,unknown>) {
  const fingerprint=JSON.stringify(input);if(!keys.current.has(fingerprint))keys.current.set(fingerprint,crypto.randomUUID());
  const response=await sessionFetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId:organization,key:keys.current.get(fingerprint),...input})});
  const value=await response.json();if(!response.ok)throw Error(value.error);
 }
 async function approve() {
  if(pending||!proposal)return;setPending(true);setError('');setMessage('');
  try {if(request.status==='submitted'&&reviewedRevision.current!==request.revision){await command('/api/commands',{command:'ReviewRequest',id:request.id,revision:request.revision,status:'reviewing'});reviewedRevision.current=request.revision;onChanged();}const confirmed=await confirmRequestedAppointment(organization,request.id,proposal.id,approvalAttempt,sessionFetch);setMessage(appointmentDeliveryMessage(confirmed.delivery));onChanged();}
  catch(e){setError(publicError(e));}finally{setPending(false);}
 }
 async function decline(form:HTMLFormElement) {
  if(pending)return;setPending(true);setError('');const fields=new FormData(form);
  try {
   if(proposal)await command('/api/scheduling',{schemaVersion:1,input:{action:fields.get('choice'),id:proposal.id,revision:proposal.revision,reason:fields.get('reason')}});
   else await command('/api/commands',{command:'ReviewRequest',id:request.id,revision:request.revision,status:'declined'});
   setAction(null);setMessage(proposal&&fields.get('choice')==='decline_time'?'Time declined. The service request stays open.':'Service request declined.');onChanged();
  }catch(e){setError(publicError(e));}finally{setPending(false);}
 }
 return <div className="request-quick-actions">
  <div className="request-action-buttons" role="group" aria-label={'Actions for '+request.original_submission.name}>
   {manageable&&(Boolean(proposal)||!confirmed)&&<><button type="button" disabled={pending} onClick={()=>proposal?void approve():onReview()} title={!proposal?'Choose an appointment time in Review':undefined}><Icon name="check"/>{pending?'Saving…':proposal?'Approve':'Schedule'}</button><button type="button" className="danger-ghost" disabled={pending||(!proposal&&request.status==='quoted')} onClick={()=>{setError('');setMessage('');setAction('decline');}}><Icon name="close"/>Decline</button></>}
   <button type="button" className="secondary" disabled={pending} onClick={onReview}><Icon name="search"/>Review<span className="sr-only"> request for {request.original_submission.name}</span></button>
  </div>
  {manageable&&(Boolean(proposal)||!confirmed)&&!proposal&&<p className="tiny">Choose a date and time to book this visit.</p>}
  {manageable&&proposal&&<p className="tiny">Approve uses your standard travel/setup buffer. Review to change the visit details.</p>}
  {error&&<p className="error note" role="alert">{error}</p>}{message&&<p className="note" role="status">{message}</p>}
  {action==='decline'&&<form className="quick-decision" onSubmit={e=>{e.preventDefault();void decline(e.currentTarget);}}><h3>Decline {proposal?'appointment time':'service request'}</h3>{proposal&&<><label>Decision<select name="choice" defaultValue="decline_time"><option value="decline_time">Decline this time — keep the request open</option><option value="decline_service">Decline the entire service request</option></select></label><label>Message for the customer<textarea name="reason" minLength={2} maxLength={1000} required placeholder="A brief, neighborly explanation."/></label></>}<p>{proposal?'Your decision queues the matching customer message.':'This closes the service request and queues the customer message.'}</p><div className="actions"><button className="danger-button" disabled={pending}>{pending?'Saving…':'Confirm decline'}</button><button className="secondary" type="button" disabled={pending} onClick={()=>setAction(null)}>Cancel</button></div></form>}
 </div>;
}
