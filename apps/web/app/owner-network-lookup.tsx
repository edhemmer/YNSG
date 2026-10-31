'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import OwnerNetwork,{type NetworkActivity} from './owner-network';
import OwnerLearningToolkit from './owner-learning-toolkit';
import {referralHints} from '../lib/owner-support';
export default function OwnerNetworkLookup({organization,tasks,onClose}:{organization:string;tasks:string[];onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),activity=useRef<NetworkActivity>({dirty:false,busy:false,unknown:false}),[activityState,setActivityState]=useState<NetworkActivity>(activity.current),[query,setQuery]=useState(''),[view,setView]=useState<'learn'|'refer'>('refer'),[mounted,setMounted]=useState(false);
 const report=useCallback((value:NetworkActivity)=>{activity.current=value;setActivityState(value);},[]);
 useEffect(()=>{setMounted(true);},[]);
 useEffect(()=>{if(!mounted)return;const prior=document.activeElement,el=dialog.current;el?.showModal();return()=>{el?.close();if(prior instanceof HTMLElement&&prior.isConnected)prior.focus();};},[mounted]);
 function close(){const a=activity.current;if(a.busy||a.unknown)return;if(a.dirty&&!window.confirm('Discard the unsaved contact changes and return to your job?'))return;onClose();}
 function switchView(next:'refer'|'learn'){const a=activity.current;if(a.busy||a.unknown)return;if(a.dirty&&!window.confirm('Discard the unsaved contact changes and switch tools?'))return;activity.current={dirty:false,busy:false,unknown:false};setActivityState(activity.current);setView(next);}
 if(!mounted)return null;
 const hints=referralHints(tasks);
 return createPortal(<dialog ref={dialog} className="network-lookup" aria-labelledby="network-lookup-title" onCancel={e=>{e.preventDefault();close();}}><header className="network-lookup-top"><h2 id="network-lookup-title">Owner support</h2><button className="secondary" disabled={activityState.busy||activityState.unknown} onClick={close} aria-label="Close referral lookup">Done</button></header><div className="actions" role="group" aria-label="Owner support tools"><button className={view==='learn'?'':'secondary'} aria-pressed={view==='learn'} onClick={()=>switchView('learn')}>Learn &amp; prepare</button><button className={view==='refer'?'':'secondary'} aria-pressed={view==='refer'} onClick={()=>switchView('refer')}>Find a referral</button></div>{view==='learn'?<OwnerLearningToolkit organization={organization} onNetwork={tasks=>{setQuery(referralHints(tasks)[0]||'');switchView('refer');}}/>:<><p>Your request stays open behind this directory. Choose a contact, review their vetting, then copy the details you want to share.</p>{hints.length>0&&<div className="network-context"><p>Suggested starting points from this task:</p><div className="actions">{hints.map(h=><button type="button" className="secondary" key={h} disabled={activityState.busy||activityState.unknown||activityState.dirty} onClick={()=>setQuery(h)}>{h}</button>)}{query&&<button className="secondary" disabled={activityState.busy||activityState.unknown||activityState.dirty} onClick={()=>setQuery('')}>All contacts</button>}</div><p className="network-help">Category suggestions only. Check scope, qualifications and availability yourself.</p></div>}<OwnerNetwork key={organization+query} organization={organization} initialQuery={query} onActivity={report}/></>}</dialog>,document.body);
}
