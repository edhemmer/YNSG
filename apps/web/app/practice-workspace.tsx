'use client';
import {useCallback,useEffect,useRef,useState,type MouseEvent} from 'react';
import {EntrySafety,useEntrySafety} from './entry-safety';
import ServiceWorkflow from './service-workflow';
import RequestInbox from './request-inbox';
import RequestDetail from './request-detail';
import CustomerRecords from './customer-records';
import MileageActivity from './mileage-activity';
import InvoiceView from './invoice-view';
import ThemeToggle from './theme-toggle';
import {sessionFetch} from '../lib/session-fetch';
import {getBrowserPractice,resetBrowserPractice,PRACTICE_ORG} from '../lib/practice-store';
import type {LinkedJob} from '../lib/request-inbox';
import type {InvoiceDocument} from '../lib/invoice-document';
type Section='requests'|'visit'|'customers'|'mileage';
export default function PracticeWorkspace(){return <EntrySafety><PracticeContent/></EntrySafety>;}
function PracticeContent(){
 const {canLeave}=useEntrySafety();
 const [snapshot,setSnapshot]=useState<ReturnType<ReturnType<typeof getBrowserPractice>['snapshot']>|null>(null),[section,setSection]=useState<Section>('requests'),[selected,setSelected]=useState(''),[detail,setDetail]=useState(false),[customer,setCustomer]=useState<string|null>(null),[version,setVersion]=useState(0),[commandBusy,setCommandBusy]=useState(false),[childBusy,setChildBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[document,setDocument]=useState<InvoiceDocument|null>(null);
 const busy=commandBusy||childBusy;
 const sending=useRef(false),keys=useRef(new Map<string,string>()),heading=useRef<HTMLHeadingElement>(null);
 const refresh=useCallback(()=>{setSnapshot(getBrowserPractice().snapshot());setVersion(v=>v+1);},[]);
 useEffect(()=>{refresh();},[refresh]);
 useEffect(()=>{heading.current?.focus();},[section,selected,document]);
 function navigate(next:Section,id?:string){if(busy||!canLeave())return;setDocument(null);setDetail(false);setSection(next);if(id)setSelected(id);setError('');setNotice('');}
 async function send(path:string,value:Record<string,unknown>){
  if(sending.current)return;sending.current=true;setCommandBusy(true);setError('');
  const fingerprint=JSON.stringify([path,value]);if(!keys.current.has(fingerprint))keys.current.set(fingerprint,crypto.randomUUID());
  try{const r=await sessionFetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId:PRACTICE_ORG,key:keys.current.get(fingerprint),...value})}),d=await r.json();if(!r.ok)throw Error(d.error);keys.current.delete(fingerprint);refresh();setNotice('Practice change saved in this tab only.');return d;}
  catch(e){setError(e instanceof Error?e.message:'Practice change unavailable.');}
  finally{sending.current=false;setCommandBusy(false);}
 }
 const act=useCallback((value:Record<string,unknown>)=>send('/api/commands',value),[]);
 const fieldAction=useCallback(async(j:LinkedJob,action:'start'|'pause'|'resume')=>{await send('/api/jobs',{id:j.id,revision:j.revision,action,note:''});},[]);
 function reset(){if(busy||!canLeave()||!window.confirm('Reset all practice records to the original examples? Live business records are never affected.'))return;resetBrowserPractice();keys.current.clear();setSelected('');setCustomer(null);setDetail(false);setDocument(null);setSection('requests');setNotice('Original sample records restored.');setError('');refresh();}
 // Existing workflow links are intercepted before navigation. A practice invoice
 // renders the real document locally; phone/maps/PDF/provider/account links never
 // escape into a production command, external provider or real phone dialer.
 function localLink(e:MouseEvent){
  const anchor=(e.target as Element).closest?.('a[href]') as HTMLAnchorElement|null;
  if(!anchor||anchor.hasAttribute('data-practice-exit'))return;
  e.preventDefault();e.stopPropagation();if(e.type==='contextmenu')return;
  const u=new URL(anchor.href,window.location.href);
  if(u.pathname==='/invoice'&&u.searchParams.get('organization')===PRACTICE_ORG){if(busy||!canLeave())return;try{setDocument(getBrowserPractice().document(u.searchParams.get('invoice')||''));}catch{setNotice('Sample invoice unavailable. Reset practice data.');}}
  else setNotice('Calls, maps, sign-in, file transfer and external services are disabled in practice. No live action was taken.');
 }
 const request=snapshot?.requests.find(r=>r.id===selected),quotes=snapshot?.quotes.filter(q=>q.request_id===selected)||[],jobs=snapshot?.jobs.filter(j=>quotes.some(q=>q.id===j.quote_id))||[],invoices=snapshot?.invoices.filter(i=>jobs.some(j=>j.id===i.job_id))||[];
 return <main id="main" className="shell practice-workspace">
  <header className="practice-banner"><p className="eyebrow">Practice · sample data only</p><h1 ref={heading} tabIndex={-1}>Try the owner workflow</h1><p>Six sample visits are ready: a new request, scheduled work, work in progress, ready to invoice, partially paid and paid.</p><p><strong>Nothing here books a real visit, sends a message or records real money.</strong> Changes stay in this browser tab. Use fictional information only.</p><p className="tiny">These are the real workflow screens with simulated responses. This checks how the screens feel; live sign-in, database permissions, travel providers, delivery and tax treatment require separate verification.</p><div className="actions"><a className="button secondary" data-practice-exit href="/owner">Exit to live workspace</a><button type="button" className="secondary" disabled={busy} onClick={reset}>Reset sample data</button><ThemeToggle/></div></header>
  <nav className="practice-nav" aria-label="Practice sections">{([['requests','Requests & visits'],['customers','Customers'],['mileage','Mileage']] as const).map(([key,label])=><button type="button" key={key} disabled={busy} aria-pressed={section===key||(key==='requests'&&section==='visit')} onClick={()=>navigate(key)}>{label}</button>)}</nav>
  <details className="practice-guide"><summary>What to try</summary><ol><li>Open a sample request. Review the complete note and appointment, save an estimate and record a fictional agreement.</li><li>Open “Scheduled visit.” Start, pause and resume work. Record sample work and complete the visit.</li><li>Open “Ready to invoice.” Review the saved work, issue the sample invoice and open its document.</li><li>Open “Partial payment.” Record the remaining sample cash/Zelle amount. Check Total, Received and Remaining.</li><li>Edit a sample customer contact or address, add a conversation note, then record or reverse a sample mileage trip.</li><li>Try large text, dark/light mode and rotation. Reset to repeat any scenario.</li></ol><p>Scheduling checks sample overlaps and a 15-minute buffer only; live travel routing is not tested here. Emails, uploads, imports, delegation, account signup and external provider actions are disabled. No sample result represents real consent, funds or delivery.</p></details>
  {notice&&<p className="note" role="status">{notice}</p>}{error&&<p className="note" role="alert">{error}</p>}
  {!snapshot?<p role="status">Preparing sample records…</p>:<div onClickCapture={localLink} onAuxClickCapture={localLink} onContextMenuCapture={localLink}>
   {document?<><button type="button" className="secondary" onClick={()=>setDocument(null)}>Back to sample visit</button><button type="button" className="secondary" onClick={()=>window.print()}>Print sample invoice</button><InvoiceView invoice={document}/></>:<>
   {section==='requests'&&<RequestInbox organization={PRACTICE_ORG} timezone="America/Chicago" revision={version} onOpen={id=>navigate('visit',id)} initialFilter="all" reviewLabel="Continue workflow" canManage={false}/>}
   {section==='visit'&&request&&<><button type="button" className="secondary" disabled={busy} onClick={()=>navigate('requests')}>All sample visits</button><ServiceWorkflow key={request.id} organization={PRACTICE_ORG} request={request} quotes={quotes} jobs={jobs} invoices={invoices} timezone="America/Chicago" canManage canQuote canWork busy={commandBusy} onBusy={setChildBusy} onReview={()=>{if(canLeave())setDetail(true);}} act={act} fieldAction={fieldAction} onChanged={refresh} onCustomer={id=>{if(busy||!canLeave())return;setCustomer(id);navigate('customers');}}/></>}
   {section==='customers'&&<CustomerRecords practice key={'customers:'+version+':'+customer} initialCustomer={customer} organization={PRACTICE_ORG} timezone="America/Chicago" onOpenRequest={id=>navigate('visit',id)} onChanged={()=>setSnapshot(getBrowserPractice().snapshot())}/>}
   {section==='mileage'&&<MileageActivity organization={PRACTICE_ORG} timezone="America/Chicago"/>}
   </>}
   {detail&&request&&<RequestDetail organization={PRACTICE_ORG} requestId={request.id} timezone="America/Chicago" canManage={false} onClose={()=>{if(canLeave())setDetail(false);}} onChanged={refresh} onWork={id=>navigate('visit',id)}/>}
  </div>}
 </main>;
}
