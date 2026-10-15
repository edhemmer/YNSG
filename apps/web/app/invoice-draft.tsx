"use client";
import { publicError } from "../lib/public-errors";
import { useEffect, useRef, useState } from "react";
import { sessionFetch } from "../lib/session-fetch";
import {invoiceChargeCents} from "../lib/invoice-charge";
import {salesTax,type TaxRule,type TaxComponent} from "../lib/taxes";
type TaxContext={required:boolean;rules:TaxRule[];valid:boolean;tax:{taxCents:number;rule?:TaxRule;customerApprovalEvidence?:string}|null};
import {hourlyCharge} from "../lib/invoice-billing";
import {invoiceDraftFingerprint} from '../lib/service-workflow';
import {useUnsavedEntry,useBlockedEntry} from './entry-safety';
type Line = {
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
}) {
  const [lines, setLines] = useState<Line[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [loaded, setLoaded] = useState(false),
    [savedDraft, setSavedDraft] = useState(false);
  const [taxContext,setTaxContext]=useState<TaxContext|null>(null),[taxRule,setTaxRule]=useState(""),[taxEvidence,setTaxEvidence]=useState("");
  const subtotal=lines.reduce((sum,line)=>sum+(invoiceChargeCents(line.chargedAmount)??0),0);
  const selectedRule=taxContext?.rules.find(r=>r.id===taxRule);
  let taxPreview:{taxCents:number;totalCents:number;components:TaxComponent[]}|null=null;
  try{if(selectedRule)taxPreview=salesTax(subtotal,selectedRule);}catch{}
  const mounted=useRef(true);
  const currentTarget=useRef(organization+":"+job+":"+revision);
  currentTarget.current=organization+":"+job+":"+revision;
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const completionAttempt=useRef<{body:string;revision:number}|null>(null);
  const draftAttempt=useRef<{body:string;revision:number;target:string;fingerprint:string}|null>(null);
  const [draftUnknown,setDraftUnknown]=useState(false);
  const [completionUncertain,setCompletionUncertain]=useState(false);
  const ownSaved=useRef<{revision:number;lines:string}|null>(null);
  const [readiness,setReadiness]=useState<{ready:boolean;reasons:string[]}|null>(null);
  const [loadRetry,setLoadRetry]=useState(0);
  const [entryBaseline,setEntryBaseline]=useState({lines:'[]',taxRule:'',taxEvidence:''}),[entryConflict,setEntryConflict]=useState(false);
  const entryDirty=(loaded&&JSON.stringify(lines)!==entryBaseline.lines)||taxRule!==entryBaseline.taxRule||taxEvidence!==entryBaseline.taxEvidence;
  const dirtyRef=useRef(false);dirtyRef.current=entryDirty;
  const loadedRevision=useRef<number|null>(null);
  useUnsavedEntry('invoice:'+organization+':'+job,entryDirty);
  useBlockedEntry('invoice-draft:'+organization+':'+job,busy||draftUnknown||completionUncertain);
  useEffect(() => {mounted.current=true;return()=>{mounted.current=false;onBusy(false);};}, [onBusy]);
  useEffect(() => {
    if(completionAttempt.current||draftAttempt.current)return;
    if(dirtyRef.current&&loadedRevision.current!==revision&&ownSaved.current?.revision!==revision){setEntryConflict(true);setMessage('The saved job changed while you were editing. Your entries are still shown. Copy anything you need before reloading the current saved record.');return;}
    // Saving work does not save the tax agreement. Preserve its local review
    // through our own returned revision rather than silently clearing it.
    const keepLocalTax=ownSaved.current?.revision===revision&&(taxRule!==entryBaseline.taxRule||taxEvidence!==entryBaseline.taxEvidence);
    setEntryConflict(false);
    let current = true;
    const controller=new AbortController();
    setBusy(false);onBusy(false);
    setLoaded(false);
    setSavedDraft(false);
    setLines([]);setReadiness(null);setTaxContext(null);if(!keepLocalTax){setTaxRule("");setTaxEvidence("");}
    if(ownSaved.current?.revision!==revision)setReviewed(false);
    setMessage("");
    retry.current = null;
    sessionFetch(
      "/api/invoice-draft?organization=" + organization + "&job=" + job,
      {cache:"no-store",signal:controller.signal},
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (current) {
          const sourceLines=d.draft?.lines?.length?d.draft.lines:suggestedWork?[{...suggestedWork,description:suggestedWork.description.length<=1000?suggestedWork.description:'',recordedMinutes:0,waiverReason:''}]:[];
          const entryLines=sourceLines.map((line:{description:string;recordedMinutes:number;chargedCents:number;waiverReason:string;billingBasis?:"fixed"|"hourly";billingMinutes?:number;unitRateCents?:number})=>({billingBasis:line.billingBasis||"fixed",billingMinutes:line.billingMinutes??line.recordedMinutes,hourlyAmount:((line.unitRateCents??0)/100).toFixed(2),description:line.description,recordedMinutes:line.recordedMinutes,waiverReason:line.waiverReason,chargedAmount:(line.chargedCents/100).toFixed(2)}));
          setLines(entryLines);
          setEntryBaseline({lines:JSON.stringify(entryLines),taxRule:d.tax?.valid?d.tax?.tax?.rule?.id||'':'',taxEvidence:d.tax?.valid?d.tax?.tax?.customerApprovalEvidence||'':''});loadedRevision.current=revision;
          setReadiness(d.readiness||null);
          if(!ownSaved.current||ownSaved.current.revision!==revision||ownSaved.current.lines!==invoiceDraftFingerprint(d.draft?.lines||[]))setReviewed(false);
          setTaxContext(d.tax);if(!keepLocalTax){setTaxRule(d.tax?.valid?d.tax?.tax?.rule?.id||"":"");setTaxEvidence(d.tax?.valid?d.tax?.tax?.customerApprovalEvidence||"":"");}
          setLoaded(true);
          setSavedDraft(
            Boolean(d.draft?.lines?.length) && d.draft.jobRevision === revision,
          );
        }
      })
      .catch((e) => {
        if (current) setMessage(publicError(e));
      });
    return () => {
      current = false;controller.abort();
    };
  }, [organization, job, revision,onBusy,loadRetry]);
  function change(index: number, patch: Partial<Line>) {
    setReviewed(false);
    setSavedDraft(false);
    setLines((items) =>
      items.map((item, i) => (i === index ? (()=>{const next={...item,...patch};if(next.billingBasis==="hourly"){const rate=invoiceChargeCents(next.hourlyAmount);if(rate!==null){try{next.chargedAmount=(hourlyCharge(next.billingMinutes,rate)/100).toFixed(2);}catch{next.chargedAmount="";}}else next.chargedAmount="";}return next;})() : item)),
    );
  }
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
    if(busy||blocked||draftUnknown||completionUncertain||entryConflict||!loaded||!reviewed)return;
    if(lines.some(line=>invoiceChargeCents(line.chargedAmount)===null)){setMessage('Enter valid amounts in dollars and cents.');return;}
    try{
      const savedLines=lines.map(({chargedAmount,hourlyAmount,billingMinutes,billingBasis,...line})=>({...line,billingBasis,...(billingBasis==='hourly'?{billingMinutes,unitRateCents:invoiceChargeCents(hourlyAmount)}:{}),chargedCents:invoiceChargeCents(chargedAmount)}));
      if(savedLines.some(line=>line.chargedCents===null)){setMessage('Check every charge. No changes were made.');return;}
      const value={organization,job,revision,lines:savedLines};
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
    if (busy || blocked || draftUnknown || entryConflict || !loaded || !savedDraft || !reviewed || !completed || readiness?.ready!==true)
      return;
    if(taxContext?.required&&(!taxPreview||!taxEvidence.trim())){setMessage("Choose the reviewed tax rule and record the customer-approved total.");return;}
    if(lines.some(line=>invoiceChargeCents(line.chargedAmount)===null)){setMessage("Enter each charge as dollars with up to two decimal places.");return;}
    const target=organization+":"+job+":"+revision;
    setBusy(true);
    onBusy(true);
    setMessage("");
    try {
      const value = {
        command: "ApproveInvoice",
        organizationId: organization,
        id: job,
        revision,
        totalCents: taxContext?.required ? taxPreview!.totalCents : subtotal,
        ...(taxContext?.required?{taxRuleId:taxRule,taxEvidence}:{}),
        reviewed: true,
      };
      const fingerprint = JSON.stringify(value);
      if (retry.current?.fingerprint !== fingerprint)
        retry.current = { fingerprint, key: crypto.randomUUID() };
      const response = await sessionFetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...value, key: retry.current.key }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if(!mounted.current||currentTarget.current!==target)return;
      retry.current = null;
      setMessage(
        "Invoice approved and issued. Review the invoice below and separately request email delivery.",
      );
      saved();
    } catch (error) {
      if(mounted.current&&currentTarget.current===target)setMessage(publicError(error));
    } finally {
      if(mounted.current&&currentTarget.current===target){setBusy(false);onBusy(false);}
    }
  }
  return (
    <details className={mobile?"mobile-work-record":undefined} open={initialExpanded||completed}>
      <summary>
        {completed
          ? "Review and approve invoice"
          : "Record work and prepare invoice draft"}
      </summary>
      {mobile?<p>Review the actual work, minutes and charge. Materials are paid directly to suppliers.</p>:<p>Record the work, including anything you choose not to charge for. These lines replace the labor total. Materials and mixed taxable/exempt work require a separately reviewed invoice; do not include them here. Charges cannot exceed approved labor.</p>}
      {entryDirty&&<p className="note" role="status">Unsaved entries · save this work before leaving.</p>}
      {entryConflict&&<div className="note" role="alert"><p>The job changed elsewhere. Saving and issuing are paused to protect both versions.</p><button type="button" className="secondary" onClick={()=>{if(window.confirm('Reloading discards these unsaved entries. Have you copied anything you need?')){dirtyRef.current=false;setTaxRule(entryBaseline.taxRule);setTaxEvidence(entryBaseline.taxEvidence);setLoaded(false);setLoadRetry(n=>n+1);}}}>Reload saved work</button></div>}
      {readiness?.ready===false&&<div className="note" role="status"><strong>Before this invoice can be issued</strong><ul>{readiness.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul><p>Your work and draft can still be saved.</p><a href={'/owner/taxes?'+new URLSearchParams({organization})}>Open tax rules and review</a><br/><a href={'/owner?'+new URLSearchParams({organization,section:'Settings'})}>Open business settings</a></div>}
      <p className="invoice-draft-step" role="status">{!loaded?'Loading work record…':!lines.length?'Add the work performed.':!savedDraft?'Step 1: review the work and save this draft.':!completed?'Draft saved. Finish the work before issuing the invoice.':!reviewed?'Step 2: confirm the saved charges below, then issue the invoice.':'Draft reviewed. You can issue the invoice when business tax settings are ready.'}</p>
      {loaded&&!savedDraft&&suggestedWork&&suggestedWork.description.length>1000&&<p>The agreed scope is shown above. Summarize the actual work in up to 1,000 characters per item, or add separate work items.</p>}{loaded&&!savedDraft&&suggestedWork&&<p>The starting amount comes from the customer’s agreed estimate. Enter the actual work time and review the charge before saving.</p>}
      {!loaded&&message&&<button type="button" className="secondary" onClick={()=>setLoadRetry(n=>n+1)}>Retry loading the work record</button>}
      <p>
        {completed
          ? "Save any changes, then review the saved draft before approving. Approval fixes the issued charges; it does not email the customer."
          : "You can prepare the draft now. Complete the service call before approving its invoice."}
      </p>
      {completionUncertain&&<button type="button" disabled={busy} onClick={checkCompletion}>Check saved work</button>}
      {draftUnknown&&<button type="button" disabled={busy} onClick={()=>void replayDraft()}>Check saved draft result</button>}
      <form onSubmit={save}>
        <fieldset disabled={busy || blocked || draftUnknown || completionUncertain || !loaded}>
          <legend>{completed?"Invoice draft":"Work record"}</legend>
          {!loaded && (
            <p role="status">
              {message
                ? "Draft unavailable. Reload the job before editing."
                : "Loading saved work…"}
            </p>
          )}
          {lines.map((l, i) => (
            <fieldset key={i}>
              <legend>Work item {i + 1}</legend>
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
                Actual minutes recorded
                <input
                  type="number"
                  min="0"
                  max="1440"
                  step="1"
                  required
                  value={l.recordedMinutes}
                  onChange={(e) =>
                    change(i, { recordedMinutes: Number(e.target.value) })
                  }
                />
              </label>
              <details open={!mobile||l.billingBasis==="hourly"||invoiceChargeCents(l.chargedAmount)===0}><summary>Billing options & no-charge reason</summary><label>Billing basis<select value={l.billingBasis} onChange={e=>change(i,{billingBasis:e.target.value as "fixed"|"hourly"})}><option value="fixed">Fixed approved amount</option><option value="hourly">Time × hourly rate</option></select></label>{l.billingBasis==="hourly"&&<><label>Billed minutes (may include the agreed minimum)<input type="number" min="0" max="1440" required value={l.billingMinutes} onChange={e=>change(i,{billingMinutes:Number(e.target.value)})}/></label><label>Hourly rate ($)<input required inputMode="decimal" value={l.hourlyAmount} onChange={e=>change(i,{hourlyAmount:e.target.value})}/></label></>}
              </details><label>
                Charge ($)
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]{1,7}(\.[0-9]{1,2})?"
                  required
                  readOnly={l.billingBasis==="hourly"}
                  value={l.chargedAmount}
                  onChange={(e) =>
                    change(i, {
                      chargedAmount: e.target.value,
                    })
                  }
                />
              </label>
              {(!mobile||invoiceChargeCents(l.chargedAmount)===0)&&<label>
                Reason for no charge
                <input
                  required={invoiceChargeCents(l.chargedAmount) === 0}
                  minLength={invoiceChargeCents(l.chargedAmount) === 0 ? 2 : 0}
                  maxLength={1000}
                  value={l.waiverReason}
                  onChange={(e) => change(i, { waiverReason: e.target.value })}
                />
              </label>}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setLines((items) => items.filter((_, n) => n !== i));
                  setReviewed(false);
                  setSavedDraft(false);
                }}
              >
                Remove draft item
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={busy || lines.length >= 50}
            onClick={() => {
              setLines((items) => [
                ...items,
                {
                  billingBasis:"fixed",billingMinutes:0,hourlyAmount:"0.00",
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
            Add work item
          </button>
          {lines.length > 0 && (
            <>
              <p>
                Invoice labor total:{" "}
                {lines.some(l=>invoiceChargeCents(l.chargedAmount)===null)?"Check the charge amounts":(lines.reduce((sum,l)=>sum+(invoiceChargeCents(l.chargedAmount)??0),0)/100).toLocaleString("en-US",{style:"currency",currency:"USD"})}
              </p>
              {completed&&taxContext?.required&&<section><h3>Invoice tax</h3><label>Reviewed rule for all recorded work<select value={taxRule} onChange={e=>{setTaxRule(e.target.value);setReviewed(false);}}><option value="">Choose the applicable rule</option>{taxContext.rules.map(r=><option key={r.id} value={r.id}>{r.label} — {r.city}, {r.state}</option>)}</select></label>{selectedRule&&<><p>{selectedRule.scope}</p><p>Effective {selectedRule.effectiveFrom} through {selectedRule.effectiveTo}. Verify county / district boundaries for this exact address.</p><a href={selectedRule.sourceUrl} target="_blank" rel="noopener noreferrer">Rule source</a></>}{taxPreview&&<><p>Subtotal {(subtotal/100).toLocaleString("en-US",{style:"currency",currency:"USD"})}</p>{taxPreview.components.map((c,i)=><p key={i}>{c.label} ({c.ratePpm/10000}%): {(c.taxCents/100).toLocaleString("en-US",{style:"currency",currency:"USD"})}</p>)}<p>Invoice total <strong>{(taxPreview.totalCents/100).toLocaleString("en-US",{style:"currency",currency:"USD"})}</strong></p></>}<label>Customer approval and jurisdiction review evidence<textarea value={taxEvidence} minLength={2} maxLength={1000} onChange={e=>{setTaxEvidence(e.target.value);setReviewed(false);}} placeholder="Record acceptance of subtotal plus tax, and verify that this rule applies to every work item and the service address."/></label></section>}
              <label>
                <input
                  type="checkbox"
                  required
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                {completeOnSave&&!completed?'The work is finished. I reviewed the actual work, minutes and agreed labor charges.':'I reviewed the work, final charges and any applicable tax. The customer accepted the total; the rule applies to all work and the exact address.'}
              </label>
              <button disabled={busy || entryConflict || !reviewed}>{completeOnSave&&!completed?"Save work & complete visit":"Save invoice draft"}</button>
              {completed && (
                <button
                  type="button"
                  disabled={busy || entryConflict || !reviewed || !savedDraft || readiness?.ready!==true || Boolean(taxContext?.required&&(!taxPreview||taxEvidence.trim().length<2))}
                  onClick={() => void approve()}
                >
                  Approve and issue invoice
                </button>
              )}
            </>
          )}
        </fieldset>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
