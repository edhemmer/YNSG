'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {ACCOUNT_TYPES,ACCOUNT_TYPE_LABEL,STAGES,STAGE_LABEL,LOST_REASONS,LOST_LABEL,businessAccountCommand,businessAccountDetail,businessAccountSaved,businessPipeline,type BusinessAccount,type BusinessPipeline} from '../lib/business-account-contract';
import {useUnsavedEntry,useBlockedEntry} from './entry-safety';

type Draft={accountType:string;companyName:string;billingName:string;billingEmail:string;paymentTermsDays:string;approvalLimit:string;stage:string;nextAction:string;followUpOn:string;lostReason:string;reason:string};
const blank:Draft={accountType:'landlord',companyName:'',billingName:'',billingEmail:'',paymentTermsDays:'0',approvalLimit:'',stage:'prospect',nextAction:'',followUpOn:'',lostReason:'',reason:''};
const money=(cents:number)=>'$'+(cents/100).toLocaleString('en-US',{minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2});
const terms=(d:number)=>d===0?'Due on receipt':'Net '+d;
const day=(iso:string)=>new Date(iso+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date());
const toDraft=(a:BusinessAccount):Draft=>({accountType:a.accountType,companyName:a.companyName||'',billingName:a.billingName||'',billingEmail:a.billingEmail||'',paymentTermsDays:String(a.paymentTermsDays),approvalLimit:a.approvalLimitCents===null?'':String(a.approvalLimitCents/100),stage:a.stage,nextAction:a.nextAction||'',followUpOn:a.followUpOn||'',lostReason:a.lostReason||'',reason:''});
async function call(path:string,body?:string){
 const r=await sessionFetch(path,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body}:{})});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(typeof d.error==='string'?d.error:'The business account could not be opened.'),{known:r.status>=400&&r.status<500});return d;
}

// Business account card on a customer record: type, billing contact, terms, approval limit and pipeline stage.
export function BusinessAccountCard({organization,customer,disabled}:{organization:string;customer:string;disabled:boolean}){
 const [account,setAccount]=useState<BusinessAccount|null|undefined>(undefined),[draft,setDraft]=useState<Draft|null>(null),baseline=useRef('');
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),attempt=useRef<string|null>(null);
 useUnsavedEntry('business-account:'+customer,Boolean(draft&&JSON.stringify(draft)!==baseline.current));
 useBlockedEntry('business-account:'+customer,busy||uncertain);
 const load=useCallback(async()=>{try{const d=businessAccountDetail.parse(await call('/api/business-accounts?'+new URLSearchParams({organization,customer})));setAccount(d.account);}catch(e){setError((e as Error).message);}},[organization,customer]);
 useEffect(()=>{void load();},[load]);
 const open=(d:Draft)=>{baseline.current=JSON.stringify(d);setDraft(d);setError('');setNotice('');};
 const set=(k:keyof Draft,v:string)=>setDraft(old=>old?{...old,[k]:v,...(k==='stage'&&v!=='lost'?{lostReason:''}:{})}:old);
 async function send(){
  if(!attempt.current)return;setBusy(true);setError('');
  try{businessAccountSaved.parse(await call('/api/business-accounts',attempt.current));attempt.current=null;setUncertain(false);setDraft(null);setNotice('Business account saved.');await load();}
  catch(e){const known=Boolean((e as {known?:boolean}).known);setUncertain(!known);if(known)attempt.current=null;setError(known?(e as Error).message:'The save result is uncertain. Check the saved result before changing anything.');}
  finally{setBusy(false);}
 }
 function save(){
  if(!draft)return;
  const limit=draft.approvalLimit.trim()===''?null:Math.round(Number(draft.approvalLimit)*100);
  const parsed=businessAccountCommand.safeParse({organization,key:crypto.randomUUID(),customer,revision:account?account.revision:null,reason:draft.reason.trim(),value:{
   accountType:draft.accountType,companyName:draft.companyName.trim()||null,billingName:draft.billingName.trim()||null,billingEmail:draft.billingEmail.trim().toLowerCase()||null,
   paymentTermsDays:Number(draft.paymentTermsDays),approvalLimitCents:limit!==null&&Number.isFinite(limit)?limit:limit===null?null:-1,stage:draft.stage,
   nextAction:draft.nextAction.trim()||null,followUpOn:draft.followUpOn||null,lostReason:draft.stage==='lost'?(draft.lostReason||null):null}});
  if(!parsed.success){setError(parsed.error.issues[0]?.message||'Check the business account fields.');return;}
  attempt.current=JSON.stringify(parsed.data);void send();
 }
 // Until the account loads (or if the business-account service isn't available yet), the card stays out of the way.
 if(account===undefined)return null;
 return <section className="card business-account" aria-label="Business account">
  <div className="customer-heading"><div><p className="eyebrow">Business account</p><h3>{account?(account.companyName||ACCOUNT_TYPE_LABEL[account.accountType]):'Homeowner'}</h3></div>
   {!draft&&<button className="secondary" disabled={disabled||busy||uncertain} onClick={()=>open(account?toDraft(account):blank)}>{account?'Edit business account':'Make this a business account'}</button>}</div>
  {error&&<p className="note" role="alert">{error}</p>}{notice&&<p className="note" role="status">{notice}</p>}
  {uncertain&&<button disabled={busy} onClick={()=>void send()}>{busy?'Checking saved result…':'Check saved result'}</button>}
  {!draft&&!account&&<p className="tiny">Landlords, property managers, offices, churches and other organizations get a billing contact, payment terms, an approval limit and a place in the business pipeline.</p>}
  {!draft&&account&&<dl className="business-facts">
   <div><dt>Type</dt><dd>{ACCOUNT_TYPE_LABEL[account.accountType]}</dd></div>
   <div><dt>Stage</dt><dd><span className={'business-stage stage-'+account.stage}>{STAGE_LABEL[account.stage]}</span>{account.lostReason?' · '+LOST_LABEL[account.lostReason]:''}</dd></div>
   <div><dt>Next step</dt><dd>{account.nextAction||'None set'}{account.followUpOn?<> · <span className={account.followUpOn<=today()&&account.stage!=='lost'?'business-due':''}>{day(account.followUpOn)}</span></>:''}</dd></div>
   <div><dt>Billing</dt><dd>{[account.billingName,account.billingEmail].filter(Boolean).join(' · ')||'Same as the main contact'}</dd></div>
   <div><dt>Payment terms</dt><dd>{terms(account.paymentTermsDays)}</dd></div>
   <div><dt>Approval limit</dt><dd>{account.approvalLimitCents===null?'Not set':'Ask before anything over '+money(account.approvalLimitCents)}</dd></div>
  </dl>}
  {draft&&<form onSubmit={e=>{e.preventDefault();save();}}><fieldset disabled={busy||uncertain}>
   <div className="customer-field-row"><label>Account type<select value={draft.accountType} onChange={e=>set('accountType',e.target.value)}>{ACCOUNT_TYPES.map(t=><option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>)}</select></label><label>Company or organization<input maxLength={160} value={draft.companyName} onChange={e=>set('companyName',e.target.value)} autoComplete="organization"/></label></div>
   <div className="customer-field-row"><label>Billing contact<input maxLength={160} value={draft.billingName} onChange={e=>set('billingName',e.target.value)}/></label><label>Billing email<input type="email" maxLength={254} value={draft.billingEmail} onChange={e=>set('billingEmail',e.target.value)}/></label></div>
   <div className="customer-field-row"><label>Payment terms<select value={draft.paymentTermsDays} onChange={e=>set('paymentTermsDays',e.target.value)}><option value="0">Due on receipt</option><option value="15">Net 15</option><option value="30">Net 30</option></select></label><label>Approval limit ($, optional)<input inputMode="decimal" value={draft.approvalLimit} onChange={e=>set('approvalLimit',e.target.value.replace(/[^0-9.]/g,''))} placeholder="e.g. 300"/></label></div>
   <p className="tiny">Terms set the invoice due date you choose for this account. Work above the approval limit needs the customer’s written OK first.</p>
   <div className="customer-field-row"><label>Pipeline stage<select value={draft.stage} onChange={e=>set('stage',e.target.value)}>{STAGES.map(s=><option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>
    {draft.stage==='lost'?<label>Why it was lost<select required value={draft.lostReason} onChange={e=>set('lostReason',e.target.value)}><option value="">Choose one</option>{LOST_REASONS.map(r=><option key={r} value={r}>{LOST_LABEL[r]}</option>)}</select></label>
     :<label>Follow up on<input type="date" value={draft.followUpOn} onChange={e=>set('followUpOn',e.target.value)}/></label>}</div>
   <label>Next step<input maxLength={200} value={draft.nextAction} onChange={e=>set('nextAction',e.target.value)} placeholder="e.g. Walk the building with the trustees"/></label>
   <label>Change note (optional)<textarea rows={2} maxLength={500} value={draft.reason} onChange={e=>set('reason',e.target.value)}/></label>
   <div className="actions"><button>{busy?'Saving…':'Save business account'}</button><button type="button" className="secondary" onClick={()=>{setDraft(null);setError('');}}>Cancel</button></div>
  </fieldset></form>}
 </section>;
}

// Business pipeline on the customer directory: follow-ups due first, filter by stage, open any account.
export function BusinessPipelinePanel({organization,onCustomer}:{organization:string;onCustomer:(id:string)=>void}){
 const [data,setData]=useState<BusinessPipeline|null>(null),[stage,setStage]=useState('open'),[page,setPage]=useState(0),[error,setError]=useState('');
 useEffect(()=>{let live=true;call('/api/business-accounts?'+new URLSearchParams({organization,stage,page:String(page)})).then(d=>{if(live){setData(businessPipeline.parse(d));setError('');}}).catch(e=>{if(live)setError((e as Error).message);});return()=>{live=false;};},[organization,stage,page]);
 if(!data)return null;
 if(data&&data.counts.total===0)return <section className="card business-pipeline"><p className="eyebrow">Business pipeline</p><p className="tiny">No business accounts yet. Open a customer and choose “Make this a business account” to track landlords, property managers, offices and churches here.</p></section>;
 return <section className="card business-pipeline" aria-label="Business pipeline">
  <div className="customer-heading"><div><p className="eyebrow">Business pipeline</p>{data&&<h3>{data.counts.open} open · <span className={data.counts.due?'business-due':''}>{data.counts.due} follow-up{data.counts.due===1?'':'s'} due</span> · {data.counts.won} won</h3>}</div>
   <label>Show<select value={stage} onChange={e=>{setStage(e.target.value);setPage(0);}}><option value="open">Open accounts</option><option value="due">Follow-ups due</option>{STAGES.map(s=><option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label></div>
  {error&&<p className="note" role="alert">{error}</p>}
  {data&&<ul className="business-list">{data.items.map(a=><li key={a.customerId}><button className="secondary" onClick={()=>onCustomer(a.customerId)}>
   <strong>{a.companyName||a.displayName}</strong><span className={'business-stage stage-'+a.stage}>{STAGE_LABEL[a.stage]}</span>
   <span className="tiny">{ACCOUNT_TYPE_LABEL[a.accountType]}{a.nextAction?' · '+a.nextAction:''}{a.followUpOn?' · ':''}{a.followUpOn&&<span className={a.followUpOn<=today()&&a.stage!=='lost'?'business-due':''}>{day(a.followUpOn)}</span>}</span>
  </button></li>)}{!data.items.length&&<li className="tiny">Nothing in this view.</li>}</ul>}
  {data&&(page>0||data.hasMore)&&<div className="actions"><button className="secondary" disabled={page===0} onClick={()=>setPage(n=>n-1)}>Previous</button><button className="secondary" disabled={!data.hasMore} onClick={()=>setPage(n=>n+1)}>Next</button></div>}
 </section>;
}
