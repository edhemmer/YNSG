'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import OwnerNetwork,{type NetworkActivity} from './owner-network';
import OwnerLearningToolkit from './owner-learning-toolkit';
import CustomerUpdateDraft,{type CustomerUpdateDraft as Draft} from './customer-update-draft';
import {customerUpdate,companionTasks,type CompanionContext,type PublicReferral,type UpdateIntent} from '../lib/job-companion';
import {referralHints} from '../lib/owner-support';
import {useUnsavedEntry} from './entry-safety';
type View='learn'|'refer'|'update';
export default function OwnerNetworkLookup({organization,tasks,context,initialView='refer',onClose}:{organization:string;tasks:string[];context?:CompanionContext;initialView?:View;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),activity=useRef<NetworkActivity>({dirty:false,busy:false,unknown:false});
 const [activityState,setActivityState]=useState<NetworkActivity>(activity.current),[query,setQuery]=useState(''),[view,setView]=useState<View>(context||initialView!=='update'?initialView:'refer'),[mounted,setMounted]=useState(false);
 const [referral,setReferral]=useState<PublicReferral|null>(null);
 const [draft,setDraft]=useState<Draft>(()=>({intent:'next',...(context?customerUpdate(context,'next'):{subject:'',body:''}),dirty:false}));
 useUnsavedEntry('customer-update:'+organization+':'+(context?.request||'none'),draft.dirty);
 const report=useCallback((value:NetworkActivity)=>{activity.current=value;setActivityState(value);},[]);
 useEffect(()=>{setMounted(true);},[]);
 useEffect(()=>{if(!mounted)return;const prior=document.activeElement,el=dialog.current;el?.showModal();return()=>{el?.close();if(prior instanceof HTMLElement&&prior.isConnected)prior.focus();};},[mounted]);
 function close(){const a=activity.current;if(a.busy||a.unknown)return;if((a.dirty||draft.dirty)&&!window.confirm('Discard the unsaved contact or customer-update changes and return to your job?'))return;onClose();}
 function switchView(next:View){const a=activity.current;if(a.busy||a.unknown)return false;if(a.dirty&&!window.confirm('Discard the unsaved contact changes and switch tools?'))return false;activity.current={dirty:false,busy:false,unknown:false};setActivityState(activity.current);setView(next);return true;}
 function chooseIntent(intent:UpdateIntent,force=false){if(!context)return;if(draft.dirty&&!force&&!window.confirm('Replace your current edits with this starting draft?'))return;setDraft({intent,...customerUpdate(context,intent,referral),dirty:true});}
 function chooseReferral(contact:PublicReferral){if(!context)return;if(draft.dirty&&!window.confirm('Replace the current update with this referral draft?'))return;if(!switchView('update'))return;setReferral(contact);setDraft({intent:'referral',...customerUpdate(context,'referral',contact),dirty:true});}
 if(!mounted)return null;
 const hints=referralHints(tasks),focusedTasks=companionTasks(tasks),blocked=activityState.busy||activityState.unknown;
 return createPortal(<dialog ref={dialog} className="network-lookup" aria-labelledby="network-lookup-title" onCancel={e=>{e.preventDefault();close();}}>
  <header className="network-lookup-top"><div><p className="eyebrow">Help for the next step</p><h2 id="network-lookup-title">{context?'Help with this job':'Owner support'}</h2>{context&&<p className="companion-context">{context.customer} · {context.next}</p>}</div><button className="secondary" disabled={blocked} onClick={close} aria-label="Close referral lookup">Done</button></header>
  <div className="companion-tabs" role="group" aria-label="Owner support tools"><button className={view==='learn'?'':'secondary'} aria-pressed={view==='learn'} disabled={blocked} onClick={()=>switchView('learn')}>Learn &amp; prepare</button>{context&&<button className={view==='update'?'':'secondary'} aria-pressed={view==='update'} disabled={blocked} onClick={()=>switchView('update')}>Customer update{draft.dirty?' · draft':''}</button>}<button className={view==='refer'?'':'secondary'} aria-pressed={view==='refer'} disabled={blocked} onClick={()=>switchView('refer')}>Find a referral</button></div>
  {view==='learn'?<OwnerLearningToolkit organization={organization} tasks={focusedTasks} onNetwork={selected=>{if(switchView('refer'))setQuery(referralHints(selected)[0]||'');}}/>:view==='update'&&context?<CustomerUpdateDraft draft={draft} email={context.email} onChange={setDraft} onIntent={chooseIntent} hasReferral={Boolean(referral)} onFindReferral={()=>switchView('refer')} onCopied={snapshot=>setDraft(current=>current.body===snapshot.body&&current.subject===snapshot.subject?{...current,dirty:false}:current)}/>:<>
   <p>Your job stays open. Choose a contact, check their vetting, then copy their details{context?' or prepare a customer update':''}.</p>
   {hints.length>0&&<div className="network-context"><p>Start with a category:</p><div className="actions">{hints.map(h=><button type="button" className="secondary" key={h} disabled={blocked||activityState.dirty} onClick={()=>setQuery(h)}>{h}</button>)}{query&&<button className="secondary" disabled={blocked||activityState.dirty} onClick={()=>setQuery('')}>All contacts</button>}</div><p className="network-help">Suggested from the task. Check scope, qualifications and availability with the contact.</p></div>}
   <OwnerNetwork key={organization+query} organization={organization} initialQuery={query} onActivity={report} onReferral={context?chooseReferral:undefined}/>
  </>}
 </dialog>,document.body);
}
