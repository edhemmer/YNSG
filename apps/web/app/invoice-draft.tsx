"use client";
import OwnerServicePricing,{initialPriceDraft,parsePriceDraft,type PriceDraft} from './owner-service-pricing';
import {pricingTotals} from '../lib/owner-invoice-pricing';
import {workedTimeMinutes,workedTimeLabel} from '../lib/worked-time';
import { publicError } from "../lib/public-errors";
import { useEffectEvent, useEffect, useRef, useState } from "react";
import { sessionFetch } from "../lib/session-fetch";
import {invoiceChargeCents} from "../lib/invoice-charge";
import {salesTax,type TaxRule,type TaxComponent} from "../lib/taxes";
type TaxContext={required:boolean;rules:TaxRule[];valid:boolean;tax:{taxCents:number;rule?:TaxRule;customerApprovalEvidence?:string}|null};
import {crewTerms,crewBilledMinutes,type CrewTerms} from '../lib/crew-billing';
import {hourlyCharge} from "../lib/invoice-billing";
import {invoiceDraftFingerprint} from '../lib/service-workflow';
import {useUnsavedEntry,useBlockedEntry} from './entry-safety';
type Line = {
  timeInput?:string;
  crewPerson?:number;waive?:boolean;
  billingBasis:"fixed"|"hourly";
  billingMinutes:number;
  hourlyAmount:string;
  description: string;
  recordedMinutes: number;
  chargedAmount: string;
  waiverReason: string;
};
export default function InvoiceDraft({
  organization,
  job,
  revision,
  saved,
  completed,
  blocked,
  onBusy,
  initialExpanded=false,
  suggestedWork,
  mobile=false,
  completeOnSave=false,
  fieldMode=false,
  fieldCanIssue=false,
  streamlined=false,
  trackedMinutes,
  requestedServices=[],
  approvedTotalCents=0,
}: {
  organization: string;
  job: string;
  revision: number;
  saved: () => void;
  completed: boolean;
  blocked: boolean;
  onBusy: (busy: boolean) => void;
  initialExpanded?:boolean;
  suggestedWork?:{description:string;chargedCents:number};
  mobile?:boolean;
  completeOnSave?:boolean;
  fieldMode?:boolean;
  fieldCanIssue?:boolean;
  streamlined?:boolean;
  trackedMinutes?:number;
  requestedServices?:string[];
  approvedTotalCents?:number;
}) {
  const [crew,setCrew]=useState<CrewTerms|null>(null);
  const [ownerPriceDraft,setOwnerPriceDraft]=useState<PriceDraft|null>(null);
  const [pricingBaseline,setPricingBaseline]=useState('');
  const priceMode=Boolean(completed&&ownerPriceDraft&&requestedServices.length&&(!crew||crew.plannedPeople===1));
  const [lines, setLines] = useState<Line[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [loaded, setLoaded] = useState(false),
    [savedDraft, setSavedDraft] = useState(false);
  const [taxContext,setTaxContext]=useState<TaxContext|null>(null),[taxRule,setTaxRule]=useState(""),[taxEvidence,setTaxEvidence]=useState("");
  const validOwnerPricing=priceMode&&ownerPriceDraft?parsePriceDraft(ownerPriceDraft):null;
  const subtotal=validOwnerPricing?pricingTotals(validOwnerPricing).billedCents:lines.reduce((sum,line)=>sum+(invoiceChargeCents(line.chargedAmount)??0),0);
  const selectedRule=taxContext?.rules.find(r=>r.id===taxRule);
  let taxPreview:{taxCents:number;totalCents:number;components:TaxComponent[]}|null=null;
  try{if(selectedRule)taxPreview=salesTax(subtotal,selectedRule);}catch{}
  const mounted=useRef(true);
  const currentTarget=useRef(organization+":"+job+":"+revision);
  currentTarget.current=organization+":"+job+":"+revision;
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const issueAttempt=useRef<{body:string;target:string;total:number}|null>(null);
  const [issueUnknown,setIssueUnknown]=useState(false);
  const completionAttempt=useRef<{body:string;revision:number}|null>(null);
  const draftAttempt=useRef<{body:string;revision:number;target:string;fingerprint:string}|null>(null);
  const [draftUnknown,setDraftUnknown]=useState(false);
  const [completionUncertain,setCompletionUncertain]=useState(false);
  const ownSaved=useRef<{revision:number;lines:string}|null>(null);
  const [readiness,setReadiness]=useState<{ready:boolean;reasons:string[]}|null>(null);
  const [loadRetry,setLoadRetry]=useState(0);
  const [entryBaseline,setEntryBaseline]=useState({lines:'[]',taxRule:'',taxEvidence:''}),[entryConflict,setEntryConflict]=useState(false);
  const entryDirty=(loaded&&JSON.stringify(lines)!==entryBaseline.lines)||taxRule!==entryBaseline.taxRule||taxEvidence!==entryBaseline.taxEvidence||Boolean(loaded&&ownerPriceDraft&&JSON.stringify(ownerPriceDraft)!==pricingBaseline);
  const manualWorkTouched=useRef(false),manualWorkTouchVersion=useRef(0);
  const dirtyRef=useRef(false);dirtyRef.current=entryDirty;
  const loadedRevision=useRef<number|null>(null);
  const currentRead=loaded&&loadedRevision.current===revision;
  useUnsavedEntry('invoice:'+organization+':'+job,entryDirty);
  useBlockedEntry('invoice-draft:'+organization+':'+job,busy||draftUnknown||completionUncertain||issueUnknown);
  useEffect(() => {mounted.current=true;return()=>{mounted.current=false;onBusy(false);};}, [onBusy]);
  // Sample unsaved review inputs when a saved job revision loads. Typing must not restart that read.
  const draftInputs=useEffectEvent(()=>({taxRule,taxEvidence,entryBaseline,suggestedWork,completed,requestedServices,approvedTotalCents}));
  useEffect(() => {
    const {taxRule,taxEvidence,entryBaseline,suggestedWork,completed,requestedServices,approvedTotalCents}=draftInputs();
    if(completionAttempt.current||draftAttempt.current||issueAttempt.current)return;
    if(dirtyRef.current&&loadedRevision.current!==revision&&ownSaved.current?.revision!==revision){setEntryConflict(true);setMessage('The saved job changed while you were editing. Your entries are still shown. Copy anything you need before reloading the current saved record.');return;}
    // Saving work does not save the tax agreement. Preserve its local review
    // through our own returned revision rather than silently clearing it.
    const keepLocalTax=ownSaved.current?.revision===revision&&(taxRule!==entryBaseline.taxRule||taxEvidence!==entryBaseline.taxEvidence);
    setEntryConflict(false);
    const inputVersionAtRead=manualWorkTouchVersion.current;
    let current = true;
    const controller=new AbortController();
    setBusy(false);onBusy(false);
    setLoaded(false);
    setSavedDraft(false);
    setLines([]);setCrew(null);setOwnerPriceDraft(null);setPricingBaseline('');setReadiness(null);setTaxContext(null);if(!keepLocalTax){setTaxRule("");setTaxEvidence("");}
    if(ownSaved.current?.revision!==revision)setReviewed(false);
    setMessage("");
    retry.current = null;
    sessionFetch(
      (fieldMode?"/api/field-labor?organization=":"/api/invoice-draft?organization=") + organization + "&job=" + job,
      {cache:"no-store",signal:controller.signal},
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (current) {
          if(manualWorkTouchVersion.current!==inputVersionAtRead){setEntryConflict(true);setLoaded(true);setMessage("Saved work arrived after you started editing. Your entries are kept. Reload the current record when you are ready.");return;}
          const agreedCrew=d.crew?crewTerms.parse(d.crew):null;setCrew(agreedCrew);
          const sourceLines=d.draft?.lines?.length?d.draft.lines:agreedCrew?Array.from({length:agreedCrew.plannedPeople},(_,index)=>({crewPerson:index+1,description:index===0?(suggestedWork?.description&&suggestedWork.description.length<=1000?suggestedWork.description:'Record the work performed'):'Additional person labor',recordedMinutes:0,chargedCents:0,waiverReason:'',billingBasis:'hourly',billingMinutes:0,unitRateCents:agreedCrew.perPersonRateCents})):suggestedWork?[{...suggestedWork,description:suggestedWork.description.length<=1000?suggestedWork.description:'',recordedMinutes:0,waiverReason:''}]:[];
          const entryLines=sourceLines.map((line:{description:string;recordedMinutes:number;chargedCents:number;waiverReason:string;billingBasis?:"fixed"|"hourly";billingMinutes?:number;unitRateCents?:number;crewPerson?:number})=>({...((line.crewPerson!==undefined)?{crewPerson:line.crewPerson,waive:line.recordedMinutes>0&&line.chargedCents===0}:{}),billingBasis:line.billingBasis||"fixed",billingMinutes:line.billingMinutes??line.recordedMinutes,hourlyAmount:((line.unitRateCents??0)/100).toFixed(2),description:line.description,recordedMinutes:line.recordedMinutes,waiverReason:line.waiverReason,chargedAmount:(line.chargedCents/100).toFixed(2)}));
          setLines(entryLines);
          const priceEligible=completed&&requestedServices.length>0&&(!agreedCrew||agreedCrew.plannedPeople===1);
          const initialPricing=priceEligible?initialPriceDraft(requestedServices,d.ownerPricing||null,approvedTotalCents,entryLines.reduce((sum: number,item:Line)=>sum+(invoiceChargeCents(item.chargedAmount)??0),0)):null;
          setOwnerPriceDraft(initialPricing);setPricingBaseline(JSON.stringify(initialPricing));
          setEntryBaseline({lines:JSON.stringify(entryLines),taxRule:d.tax?.valid?d.tax?.tax?.rule?.id||'':'',taxEvidence:d.tax?.valid?d.tax?.tax?.customerApprovalEvidence||'':''});loadedRevision.current=revision;
          setReadiness(d.readiness||null);
          if(!ownSaved.current||ownSaved.current.revision!==revision||ownSaved.current.lines!==invoiceDraftFingerprint(d.draft?.lines||[]))setReviewed(false);
          setTaxContext(d.tax);if(!keepLocalTax){setTaxRule(d.tax?.valid?d.tax?.tax?.rule?.id||"":"");setTaxEvidence(d.tax?.valid?d.tax?.tax?.customerApprovalEvidence||"":"");}
          setLoaded(true);
          setSavedDraft(
            Boolean(d.draft?.lines?.length) && d.draft.jobRevision === revision && (!priceEligible||requestedServices.length===1||Boolean(d.ownerPricing)),
          );
        }
      })
      .catch((e) => {
        if (current) setMessage(publicError(e));
      });
    return () => {
      current = false;controller.abort();
    };
  }, [organization, job, revision,onBusy,loadRetry,fieldMode]);
  function change(index: number, patch: Partial<Line>,fromClock=false) {
    if(!fromClock){manualWorkTouched.current=true;manualWorkTouchVersion.current++;}
    setReviewed(false);
    setSavedDraft(false);
    setLines((items) =>
      items.map((item, i) => (i === index ? (()=>{const next={...item,...patch};if(crew&&next.crewPerson){if(next.waive)next.chargedAmount='0.00';try{next.billingMinutes=next.waive?0:crewBilledMinutes(next.recordedMinutes,next.crewPerson,crew)}catch{next.billingMinutes=-1;}}if(next.billingBasis==="hourly"){const rate=invoiceChargeCents(next.hourlyAmount);if(rate!==null){if(crew&&rate===0)next.billingMinutes=0;try{next.chargedAmount=(hourlyCharge(next.billingMinutes,rate)/100).toFixed(2);}catch{next.chargedAmount="";}}else next.chargedAmount="";}return next;})() : item)),
    );
  }
  const clockPrepared=useRef<string|null>(null);
  const prepareTrackedTime=useEffectEvent((minutes:number)=>change(0,{recordedMinutes:minutes,timeInput:workedTimeLabel(minutes)},true));
  useEffect(()=>{const target=organization+':'+job+':'+revision;if(!streamlined||trackedMinutes===undefined||!Number.isSafeInteger(trackedMinutes)||trackedMinutes<0||trackedMinutes>1440||!loaded||savedDraft||dirtyRef.current||manualWorkTouched.current||clockPrepared.current===target)return;clockPrepared.current=target;prepareTrackedTime(trackedMinutes);},[streamlined,trackedMinutes,loaded,savedDraft,organization,job,revision]);
  async function replayDraft(){
    const attempt=draftAttempt.current;
    if(busy||!attempt)return;
    setBusy(true);onBusy(true);setMessage('');
    try{
      const response=await sessionFetch("/api/invoice-draft",{method:"POST",headers:{"Content-Type":"application/json"},body:attempt.body});
      if(response.status>=400&&response.status<500){
        const result=await response.json().catch(()=>null);
        if(draftUnknown){setMessage('The earlier save is still unconfirmed. Keep the original work here and check its result before making another change.');return;}
        draftAttempt.current=null;
        setMessage(typeof result?.error==='string'?result.error:'Draft was rejected; entries are preserved.');
        return;
      }
      if(!response.ok)throw Error('UNCONFIRMED');
      const result=await response.json();
      if(!Number.isSafeInteger(result?.result?.revision)||result.result.revision!==attempt.revision+1||!Number.isSafeInteger(result?.result?.totalCents))throw Error('UNCONFIRMED');
      if(!mounted.current||currentTarget.current!==attempt.target)return;
      ownSaved.current={revision:result.result.revision,lines:attempt.fingerprint};
      draftAttempt.current=null;retry.current=null;setDraftUnknown(false);setSavedDraft(true);setLoaded(false);
      setMessage('Draft saved. Review the confirmed work before issuing the invoice.');
      try{saved();}catch{setMessage('Draft saved but dashboard refresh failed. Refresh the work record before issuing.');}
    }catch{
      if(mounted.current&&currentTarget.current===attempt.target){setDraftUnknown(true);setMessage('We could not confirm the draft save. Your original work and its exact retry are kept. Check saved draft result before editing.');}
    }finally{if(mounted.current&&currentTarget.current===attempt.target){setBusy(false);onBusy(Boolean(completionAttempt.current));}}
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if(busy||blocked||draftUnknown||completionUncertain||issueUnknown||entryConflict||!currentRead||(!reviewed&&!streamlined))return;
    if(lines.some(line=>invoiceChargeCents(line.chargedAmount)===null)){setMessage('Enter valid amounts in dollars and cents.');return;}
    const privatePricing=validOwnerPricing;
    if(priceMode&&!privatePricing){setMessage('Finish the standard and actual price for each service. Nothing has been saved yet.');return;}
    if(privatePricing&&pricingTotals(privatePricing).billedCents>approvedTotalCents){setMessage('The final amount exceeds the approved labor estimate. Review the customer agreement before charging more.');return;}
    if(crew&&lines.some(line=>(priceMode?(privatePricing?pricingTotals(privatePricing).billedCents:0):(invoiceChargeCents(line.chargedAmount)??0))>0&&line.recordedMinutes<=0)){setMessage('Record the actual time worked before saving a billed labor charge.');return;}
    try{
      const savedLines=privatePricing?(()=>{
        const first=lines[0];
        if(!first)throw Error('NO_WORK');
        const combined=privatePricing.services.map(item=>item.description).join(' & ');
        if(combined.length>1000)throw Error('DESCRIPTION_TOO_LONG');
        return [{...((first.crewPerson!==undefined)?{crewPerson:first.crewPerson}:{}),description:combined,recordedMinutes:first.recordedMinutes,
          chargedCents:pricingTotals(privatePricing).billedCents,billingBasis:'fixed' as const,
          waiverReason:privatePricing.reason.trim()||'Owner-approved service pricing'}];
      })():lines.map(({chargedAmount,hourlyAmount,billingMinutes,billingBasis,timeInput:_timeInput,waive:_waive,...line})=>({...line,billingBasis,...(billingBasis==='hourly'?{billingMinutes,unitRateCents:invoiceChargeCents(hourlyAmount)}:{}),chargedCents:invoiceChargeCents(chargedAmount)}));
      if(savedLines.some(line=>line.chargedCents===null)){setMessage('Check every charge. No changes were made.');return;}
      const value={organization,job,revision,lines:savedLines,...(privatePricing?{ownerPricing:privatePricing}:{})};
      const fingerprint=JSON.stringify(value);
      if(retry.current?.fingerprint!==fingerprint)retry.current={fingerprint,key:crypto.randomUUID()};
      if(completeOnSave&&!completed){completionAttempt.current={body:JSON.stringify({...value,key:retry.current.key,reviewed:true}),revision};await checkCompletion();return;}
      draftAttempt.current={body:JSON.stringify({...value,key:retry.current.key}),revision,target:organization+":"+job+":"+revision,fingerprint:invoiceDraftFingerprint(savedLines)};
      await replayDraft();
    }catch{setMessage('Check each work item and amount before saving. Your entries are kept.');}
  }
  async function checkCompletion(){
    const attempt=completionAttempt.current;if(!attempt||busy)return;
    setBusy(true);onBusy(true);
    try{
      const r=await sessionFetch("/api/visit-completion",{method:"POST",headers:{"Content-Type":"application/json"},body:attempt.body});
      const d=await r.json();
      if(!r.ok){if(r.status<500&&d.uncertain===false){completionAttempt.current=null;setCompletionUncertain(false);saved();}throw Error(d.error);}
      if(d.result?.status!=="completed"||!Number.isSafeInteger(d.result.revision)||d.result.revision<=attempt.revision)throw Error("Completion could not be confirmed.");
      ownSaved.current={revision:d.result.revision,lines:invoiceDraftFingerprint(JSON.parse(attempt.body).lines)};
      completionAttempt.current=null;retry.current=null;setCompletionUncertain(false);setMessage("Work saved and visit completed. Review the invoice next.");saved();
    }catch(e){if(mounted.current){setCompletionUncertain(Boolean(completionAttempt.current));setMessage(completionAttempt.current?"Connection interrupted. Check saved work before making changes. This retries the same completion safely.":publicError(e));}}
    finally{if(mounted.current){setBusy(false);onBusy(Boolean(completionAttempt.current));}}
  }
  async function approve() {
    if(busy)return;
    if(!issueAttempt.current){
      if((fieldMode&&!fieldCanIssue)||blocked||draftUnknown||entryConflict||!currentRead||!savedDraft||(!reviewed&&!streamlined)||!completed||readiness?.ready!==true)return;
      if(taxContext?.required&&(fieldMode?!taxContext.valid||!taxContext.tax:(!taxPreview||!taxEvidence.trim()))){setMessage("Choose the reviewed tax rule and record the customer-approved total.");return;}
      if(lines.some(line=>invoiceChargeCents(line.chargedAmount)===null)){setMessage("Enter each charge as dollars with up to two decimal places.");return;}
      const total=taxContext?.required?(fieldMode?subtotal+(taxContext.tax?.taxCents||0):taxPreview!.totalCents):subtotal;
      const value={command:"ApproveInvoice",organizationId:organization,id:job,revision,totalCents:total,...(!fieldMode&&taxContext?.required?{taxRuleId:taxRule,taxEvidence}:{}),reviewed:true,key:crypto.randomUUID()};
      issueAttempt.current={body:JSON.stringify(value),target:organization+":"+job,total};
    }
    const attempt=issueAttempt.current,wasUnknown=issueUnknown;
    setBusy(true);onBusy(true);setMessage("");
    try{
      const response=await sessionFetch("/api/commands",{method:"POST",headers:{"Content-Type":"application/json"},body:attempt.body});
      const data=await response.json();
      if(!response.ok){
        if(response.status>=400&&response.status<500&&!wasUnknown){issueAttempt.current=null;setIssueUnknown(false);setMessage(publicError(Error(data.error)));return;}
        throw Error("UNCONFIRMED");
      }
      if(data.ok!==true||typeof data.result?.id!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.result.id)||data.result.totalCents!==attempt.total)throw Error("UNCONFIRMED");
      if(!mounted.current||attempt.target!==organization+":"+job)return;
      issueAttempt.current=null;setIssueUnknown(false);retry.current=null;
      setMessage("Invoice issued. Review the invoice below; email delivery is a separate action.");saved();
    }catch{if(mounted.current){setIssueUnknown(true);setMessage("Invoice issuance is unconfirmed. Check this saved attempt before editing charges or issuing again.");}}
    finally{if(mounted.current){setBusy(false);onBusy(Boolean(issueAttempt.current));}}
  }
  return (
    <InvoiceSurface streamlined={streamlined} mobile={mobile} expanded={initialExpanded||completed}>
      <header className="invoice-editor-title">
        {fieldMode&&!fieldCanIssue?"Record labor for owner review":completed
          ? "Invoice charges"
          : "Work completed"}
      </header>
      {mobile?(!streamlined&&<p>Review the actual work, minutes and charge. Materials are paid directly to suppliers.</p>):<p>Record the work, including anything you choose not to charge for. These lines replace the labor total. Materials and mixed taxable/exempt work require a separately reviewed invoice; do not include them here. Charges cannot exceed approved labor.</p>}
      {entryDirty&&<p className="note" role="status">Unsaved entries · save this work before leaving.</p>}
      {entryConflict&&<div className="note" role="alert"><p>The job changed elsewhere. Saving and issuing are paused to protect both versions.</p><button type="button" className="secondary" onClick={()=>{if(window.confirm('Reloading discards these unsaved entries. Have you copied anything you need?')){dirtyRef.current=false;manualWorkTouched.current=false;setTaxRule(entryBaseline.taxRule);setTaxEvidence(entryBaseline.taxEvidence);setLoaded(false);setLoadRetry(n=>n+1);}}}>Reload saved work</button></div>}
      {(!fieldMode||fieldCanIssue)&&readiness?.ready===false&&<div className="note" role="status"><strong>Before this invoice can be issued</strong><ul>{readiness.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul><p>Your work and draft can still be saved.</p>{!fieldMode&&<><a href={'/owner/taxes?'+new URLSearchParams({organization})}>Review separate invoice transaction-tax rules</a><br/><a href={'/owner?'+new URLSearchParams({organization,section:'Settings'})}>Open business settings</a></>}</div>}
      {!streamlined&&<p className="invoice-draft-step" role="status">{!loaded?'Loading work record…':!lines.length?'Add the work performed.':!savedDraft?'Step 1: review the work and save this draft.':!completed?'Draft saved. Finish the work before issuing the invoice.':!reviewed?'Step 2: confirm the saved charges below, then issue the invoice.':'Draft reviewed. You can issue the invoice when business tax settings are ready.'}</p>}
      {loaded&&!savedDraft&&suggestedWork&&suggestedWork.description.length>1000&&<p>The agreed scope is shown above. Summarize the actual work in up to 1,000 characters per item, or add separate work items.</p>}{!mobile&&loaded&&!savedDraft&&suggestedWork&&<p>The starting amount comes from the customer’s agreed estimate. Enter the actual work time and review the charge before saving.</p>}
      {!loaded&&message&&<button type="button" className="secondary" onClick={()=>setLoadRetry(n=>n+1)}>Retry loading the work record</button>}
      {!mobile&&<p>
        {completed
          ? "Save any changes, then review the saved draft before approving. Approval fixes the issued charges; it does not email the customer."
          : "You can prepare the draft now. Complete the service call before approving its invoice."}
      </p>}
      {issueUnknown&&<button type="button" disabled={busy} onClick={()=>void approve()}>Check issued invoice</button>}
      {completionUncertain&&<button type="button" disabled={busy} onClick={checkCompletion}>Check saved work</button>}
      {draftUnknown&&<button type="button" disabled={busy} onClick={()=>void replayDraft()}>Check saved draft result</button>}
      {streamlined&&clockPrepared.current===organization+':'+job+':'+revision&&<p className="tiny">Time filled from the saved job timer, rounded to a minute. Review it before completing.</p>}
      {streamlined&&<p className="invoice-action-explanation">{completed?"Review the work and final amount. Save changes, issue the invoice, then email it.":"Confirm the work and amount. Your time record stays available below."}</p>}
      <form className={streamlined?"invoice-workbench":undefined} onSubmit={save}>
        <fieldset disabled={busy || blocked || draftUnknown || completionUncertain || issueUnknown || !currentRead}>
          <legend>{completed?"Invoice draft":"Work record"}</legend>
          {!loaded && (
            <p role="status">
              {message
                ? "Draft unavailable. Reload the job before editing."
                : "Loading saved work…"}
            </p>
          )}
          {!streamlined&&crew&&<p className="note">Record each person's actual worked minutes. Only the first person has the two-hour minimum. Additional people have no separate minimum. Rates come from the saved agreement; final labor must stay within its approved amount. Do not multiply the visit timer by crew size.</p>}
          {priceMode&&ownerPriceDraft&&<><OwnerServicePricing value={ownerPriceDraft} approvedTotalCents={approvedTotalCents} disabled={busy||blocked} onChange={next=>{manualWorkTouched.current=true;manualWorkTouchVersion.current++;setOwnerPriceDraft(next);setSavedDraft(false);setReviewed(false);}}/><details className="invoice-tracked-work" open={lines[0]?.recordedMinutes===0}><summary>Recorded job time · {lines[0]?.recordedMinutes?workedTimeLabel(lines[0].recordedMinutes):'not entered'}</summary><label>Actual time on this job (hours:minutes)<input type="text" inputMode="text" placeholder="2:00" value={lines[0]?.timeInput??workedTimeLabel(lines[0]?.recordedMinutes??0)} onChange={e=>change(0,{timeInput:e.target.value,recordedMinutes:workedTimeMinutes(e.target.value)??-1})}/></label></details></>}
          {!priceMode&&lines.map((l, i) => (
            <fieldset key={i}>
              <legend>{crew?(i===0?'First person':'Additional person '+(i+1)):'Work item '+(i+1)}</legend>
              <label>
                Work recorded
                <textarea
                  required
                  minLength={2}
                  maxLength={1000}
                  value={l.description}
                  onChange={(e) => change(i, { description: e.target.value })}
                />
              </label>
<label>
                Invoice amount ($)
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]{1,7}(\.[0-9]{1,2})?"
                  required
                  readOnly={Boolean(l.waive)}
                  aria-label="Invoice charge in dollars"
                  onFocus={event=>event.currentTarget.select()}
                  value={l.chargedAmount}
                  onChange={(e) =>
                    change(i, {
                      // A directly edited amount becomes a fixed labor charge.
                      // Preserve the recorded minutes and require an explanation
                      // whenever crew billing rules require one.
                      billingBasis:"fixed",
                      chargedAmount: e.target.value,
                    })
                  }
                />
              </label>

              {streamlined?<details className="invoice-tracked-work" open={l.recordedMinutes<=0}>
                <summary>Work time & records · {l.recordedMinutes>0?workedTimeLabel(l.recordedMinutes):'enter actual time'}</summary>
              <label>
                {streamlined?'Time worked (hours:minutes)':'Actual minutes recorded'}
                {streamlined?<input required type="text" inputMode="text" placeholder="1:20" pattern="[0-9]{1,2}:[0-5][0-9]" value={l.timeInput??workedTimeLabel(l.recordedMinutes)} onChange={e=>change(i,{timeInput:e.target.value,recordedMinutes:workedTimeMinutes(e.target.value)??-1})}/>:<input
                  type="number"
                  min="0"
                  max="1440"
                  step="1"
                  required
                  value={l.recordedMinutes}
                  onChange={(e) =>
                    change(i, { recordedMinutes: Number(e.target.value) })
                  }
                />}
              </label>
              </details>:<>              <label>
                {streamlined?'Time worked (hours:minutes)':'Actual minutes recorded'}
                {streamlined?<input required type="text" inputMode="text" placeholder="1:20" pattern="[0-9]{1,2}:[0-5][0-9]" value={l.timeInput??workedTimeLabel(l.recordedMinutes)} onChange={e=>change(i,{timeInput:e.target.value,recordedMinutes:workedTimeMinutes(e.target.value)??-1})}/>:<input
                  type="number"
                  min="0"
                  max="1440"
                  step="1"
                  required
                  value={l.recordedMinutes}
                  onChange={(e) =>
                    change(i, { recordedMinutes: Number(e.target.value) })
                  }
                />}
              </label></>}
              <details><summary>Rate calculation & other billing options</summary><label>Billing basis<select value={l.billingBasis} onChange={e=>change(i,{billingBasis:e.target.value as "fixed"|"hourly"})}><option value="fixed">{crew?'Adjusted labor amount':'Fixed approved amount'}</option><option value="hourly">Time × hourly rate</option></select></label>{l.billingBasis==="hourly"&&<><label>Billed minutes (may include the agreed minimum)<input type="number" min="0" max="1440" required readOnly={Boolean(crew)} value={l.billingMinutes} onChange={e=>change(i,{billingMinutes:Number(e.target.value)})}/></label><label>Rate for this person ($/hour)<input required inputMode="decimal" value={l.hourlyAmount} onChange={e=>change(i,{hourlyAmount:e.target.value})}/></label></>}
{crew&&<label className="check"><input type="checkbox" checked={l.waive||false} onChange={e=>change(i,{waive:e.target.checked})}/>Waive this person's labor and record the reason below</label>}
              </details>              {(!mobile||invoiceChargeCents(l.chargedAmount)===0||Boolean(crew&&(l.billingBasis==='fixed'||invoiceChargeCents(l.hourlyAmount)!==crew.perPersonRateCents)))&&<label>
                Adjustment note (when the agreed rate changes or a charge is waived)
                <input
                  required={invoiceChargeCents(l.chargedAmount) === 0||Boolean(crew&&(l.billingBasis==='fixed'||invoiceChargeCents(l.hourlyAmount)!==crew.perPersonRateCents))}
                  minLength={invoiceChargeCents(l.chargedAmount) === 0||Boolean(crew&&(l.billingBasis==='fixed'||invoiceChargeCents(l.hourlyAmount)!==crew.perPersonRateCents)) ? 2 : 0}
                  maxLength={1000}
                  value={l.waiverReason}
                  onChange={(e) => change(i, { waiverReason: e.target.value })}
                />
              </label>}
              {(!crew||(i>0&&i===lines.length-1))&&<button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setLines((items) => items.filter((_, n) => n !== i));
                  setReviewed(false);
                  setSavedDraft(false);
                }}
              >
                Remove draft item
              </button>}
            </fieldset>
          ))}
          {crew&&lines.some(line=>line.billingBasis==='hourly'&&line.billingMinutes<0)&&<p role="alert">The hourly calculation needs a reviewed extension billing policy. You can instead enter an agreed fixed amount with a reason while keeping the actual time on record.</p>}
          {!priceMode&&<button
            type="button"
            className="secondary"
            disabled={busy || lines.length >= (crew?6:50)}
            onClick={() => {
              if(crew&&lines.length>=6)return;
              setLines((items) => [
                ...items,
                {
                  ...(crew?{crewPerson:items.length+1}:{}),billingBasis:crew?'hourly':'fixed',billingMinutes:0,hourlyAmount:crew?(crew.perPersonRateCents/100).toFixed(2):'0.00',
                  description: "",
                  recordedMinutes: 0,
                  chargedAmount: "0.00",
                  waiverReason: "",
                },
              ]);
              setReviewed(false);
              setSavedDraft(false);
            }}
          >
            {crew?'Add another person':'Add work item'}
          </button>}
          {lines.length > 0 && (
            <>
              <p>
                Total to invoice:{" "}
                {priceMode?(ownerPriceDraft&&parsePriceDraft(ownerPriceDraft)?(pricingTotals(parsePriceDraft(ownerPriceDraft)! ).billedCents/100).toLocaleString("en-US",{style:"currency",currency:"USD"}):"Complete service prices"):lines.some(l=>invoiceChargeCents(l.chargedAmount)===null)?"Check the charge amounts":(lines.reduce((sum,l)=>sum+(invoiceChargeCents(l.chargedAmount)??0),0)/100).toLocaleString("en-US",{style:"currency",currency:"USD"})}
              </p>
              {!fieldMode&&completed&&taxContext?.required&&<section><h3>Invoice tax</h3><label>Reviewed rule for all recorded work<select value={taxRule} onChange={e=>{setTaxRule(e.target.value);setReviewed(false);}}><option value="">Choose the applicable rule</option>{taxContext.rules.map(r=><option key={r.id} value={r.id}>{r.label} — {r.city}, {r.state}</option>)}</select></label>{selectedRule&&<><p>{selectedRule.scope}</p><p>Effective {selectedRule.effectiveFrom} through {selectedRule.effectiveTo}. Verify county / district boundaries for this exact address.</p><a href={selectedRule.sourceUrl} target="_blank" rel="noopener noreferrer">Rule source</a></>}{taxPreview&&<><p>Subtotal {(subtotal/100).toLocaleString("en-US",{style:"currency",currency:"USD"})}</p>{taxPreview.components.map((c,i)=><p key={i}>{c.label} ({c.ratePpm/10000}%): {(c.taxCents/100).toLocaleString("en-US",{style:"currency",currency:"USD"})}</p>)}<p>Invoice total <strong>{(taxPreview.totalCents/100).toLocaleString("en-US",{style:"currency",currency:"USD"})}</strong></p></>}<label>Customer approval and jurisdiction review evidence<textarea value={taxEvidence} minLength={2} maxLength={1000} onChange={e=>{setTaxEvidence(e.target.value);setReviewed(false);}} placeholder="Record acceptance of subtotal plus tax, and verify that this rule applies to every work item and the service address."/></label></section>}
              {!streamlined&&<label>
                <input
                  type="checkbox"
                  required
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                {fieldMode&&!fieldCanIssue?'I reviewed the recorded work, actual minutes, adjusted rates and reasons. The primary technician or office must review the final invoice.':completeOnSave&&!completed?'The work is finished. I reviewed the actual work, minutes and agreed labor charges.':'I reviewed the actual work, final charges and any applicable tax. Charges follow the customer’s accepted terms and approved price limit; the tax rule applies to the work and address.'}
              </label>}
              {(!streamlined||!completed||entryDirty||!savedDraft)&&<button className={completed?"secondary":undefined} disabled={busy || entryConflict || (!reviewed&&!streamlined)}>{completeOnSave&&!completed?(streamlined?"Complete visit & review invoice":"Save work & complete visit"):(fieldMode&&!fieldCanIssue?"Save labor for owner review":streamlined?"Save invoice changes":"Save invoice draft")}</button>}
              {(!fieldMode||fieldCanIssue) && completed && (
                <button
                  type="button"
                  disabled={busy || entryConflict || (!reviewed&&!streamlined) || !savedDraft || readiness?.ready!==true || Boolean(taxContext?.required&&(fieldMode?!taxContext.valid||!taxContext.tax:!taxPreview||taxEvidence.trim().length<2))}
                  onClick={() => void approve()}
                >
                  {streamlined?"Issue invoice · "+((taxPreview?.totalCents??subtotal)/100).toLocaleString("en-US",{style:"currency",currency:"USD"}):"Approve and issue invoice"}
                </button>
              )}
            </>
          )}
        </fieldset>
        {message && <p role="status">{message}</p>}
      </form>
    </InvoiceSurface>
  );
}
function InvoiceSurface({streamlined,mobile,expanded,children}:{streamlined:boolean;mobile:boolean;expanded:boolean;children:React.ReactNode}){return streamlined?<section className="invoice-editor">{children}</section>:<details className={mobile?"mobile-work-record":undefined} open={expanded}><summary>Work record & invoice</summary>{children}</details>;}
