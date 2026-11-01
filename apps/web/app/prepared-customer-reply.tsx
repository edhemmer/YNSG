'use client';
import {useState} from 'react';
import {useUnsavedEntry} from './entry-safety';

type PreparedDraft={subject:string;body:string;requiresOwnerApproval:true;status:'draft'};

/** An editable owner draft, never an outbound message or a saved approval. */
export default function PreparedCustomerReply({recipient,draft,requestKey}:{recipient:string;draft:PreparedDraft;requestKey:string}){
 const [subject,setSubject]=useState(draft.subject),[body,setBody]=useState(draft.body),[notice,setNotice]=useState('');
 const edited=subject!==draft.subject||body!==draft.body;
 useUnsavedEntry('prepared-reply:'+requestKey,edited);
 const ready=Boolean(recipient.trim()&&subject.trim()&&body.trim());
 async function copy(){
  if(!ready)return;
  try{
   await navigator.clipboard.writeText('To: '+recipient+'\nSubject: '+subject+'\n\n'+body);
   setNotice('Draft copied. Review the recipient, details, and current appointment status before sending from your email app.');
  }catch{
   setNotice('Copy unavailable. Select the draft text and copy it manually.');
  }
 }
 return <details className="prepared-customer-reply" aria-label="Prepared customer response">
  <summary>Prepared customer reply <span>Not sent</span></summary>
  <div className="prepared-customer-reply-body">
   <p className="tiny">Editable starting point based on the saved request. Edits are not saved. No booking or delivery is performed here.</p>
   <p className="tiny">To: {recipient}</p>
   <label>Subject<input value={subject} maxLength={160} onChange={event=>{setSubject(event.target.value);setNotice('');}}/></label>
   <label>Message<textarea value={body} maxLength={3000} rows={7} onChange={event=>{setBody(event.target.value);setNotice('');}}/></label>
   <button type="button" className="secondary" disabled={!ready} onClick={()=>void copy()}>Copy reviewed draft</button>
   {notice&&<p role="status">{notice}</p>}
  </div>
 </details>;
}
