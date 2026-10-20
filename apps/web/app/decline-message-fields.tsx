'use client';
import {useState} from 'react';
import {useUnsavedEntry} from './entry-safety';
import {declineReasons,declineExplanation,futureProjectInvitation,declineSignature,type DeclineReason} from '../lib/decline-message';
export default function DeclineMessageFields({timeOnly=false,organization}:{timeOnly?:boolean;organization:string}){
 const [reason,setReason]=useState<DeclineReason|''>(''),[message,setMessage]=useState('');
 useUnsavedEntry('decline-message:'+organization,reason!==''||message.trim().length>0);
 return <><label>Reason<select required value={reason} onChange={e=>{const value=e.target.value as DeclineReason;setReason(value);setMessage(value?declineExplanation(value):'');}}><option value="">Choose a reason</option>{declineReasons.filter(([key])=>!timeOnly||key==='time'||key==='other').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Message for the customer<textarea name="reason" required minLength={2} maxLength={1000} rows={6} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Choose a reason, then review or edit the message."/></label>{declineSignature(organization)&&<details><summary>Included signature</summary><p style={{whiteSpace:'pre-wrap'}}>{declineSignature(organization)}</p></details>}{!timeOnly&&futureProjectInvitation(organization)&&<details><summary>Included after your message</summary><p style={{whiteSpace:'pre-wrap'}}>{futureProjectInvitation(organization)}</p></details>}</>;
}
export function DeclineDecisionFields({proposal,reschedule=false,organization}:{proposal:boolean;reschedule?:boolean;organization:string}){
 const [choice,setChoice]=useState('decline_service');
 return <>{proposal&&(reschedule?<input type="hidden" name="choice" value="decline_time"/>:<label>What are you declining?<select name="choice" value={choice} onChange={e=>setChoice(e.target.value)}><option value="decline_time">Only this time — keep the request open</option><option value="decline_service">The entire service request — close it</option></select></label>)}<DeclineMessageFields organization={organization} key={proposal?choice:'request'} timeOnly={proposal&&(reschedule||choice==='decline_time')}/></>;
}
