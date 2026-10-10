"use client";
import { publicError } from "../lib/public-errors";
import { useEffect, useRef, useState } from "react";
import { sessionFetch } from "../lib/session-fetch";
import {invoiceChargeCents} from "../lib/invoice-charge";
import {salesTax,type TaxRule,type TaxComponent} from "../lib/taxes";
type TaxContext={required:boolean;rules:TaxRule[];valid:boolean;tax:{taxCents:number;rule?:TaxRule;customerApprovalEvidence?:string}|null};
import {hourlyCharge} from "../lib/invoice-billing";
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
}: {
  organization: string;
  job: string;
  revision: number;
  saved: () => void;
  completed: boolean;
  blocked: boolean;
  onBusy: (busy: boolean) => void;
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
  useEffect(() => {mounted.current=true;return()=>{mounted.current=false;onBusy(false);};}, [onBusy]);
  useEffect(() => {
    let current = true;
    const controller=new AbortController();
    setBusy(false);onBusy(false);
    setLoaded(false);
    setSavedDraft(false);
    setLines([]);setTaxContext(null);setTaxRule("");setTaxEvidence("");
    setReviewed(false);
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
          setLines((d.draft?.lines || []).map((line:{description:string;recordedMinutes:number;chargedCents:number;waiverReason:string;billingBasis?:"fixed"|"hourly";billingMinutes?:number;unitRateCents?:number})=>({billingBasis:line.billingBasis||"fixed",billingMinutes:line.billingMinutes??line.recordedMinutes,hourlyAmount:((line.unitRateCents??0)/100).toFixed(2),description:line.description,recordedMinutes:line.recordedMinutes,waiverReason:line.waiverReason,chargedAmount:(line.chargedCents/100).toFixed(2)})));
          setTaxContext(d.tax);setTaxRule(d.tax?.valid?d.tax?.tax?.rule?.id||"":"");setTaxEvidence(d.tax?.valid?d.tax?.tax?.customerApprovalEvidence||"":"");
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
  }, [organization, job, revision,onBusy]);
  function change(index: number, patch: Partial<Line>) {
    setReviewed(false);
    setSavedDraft(false);
    setLines((items) =>
      items.map((item, i) => (i === index ? (()=>{const next={...item,...patch};if(next.billingBasis==="hourly"){const rate=invoiceChargeCents(next.hourlyAmount);if(rate!==null){try{next.chargedAmount=(hourlyCharge(next.billingMinutes,rate)/100).toFixed(2);}catch{next.chargedAmount="";}}else next.chargedAmount="";}return next;})() : item)),
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || blocked || !loaded || !reviewed) return;
    if(lines.some(line=>invoiceChargeCents(line.chargedAmount)===null)){setMessage("Enter each charge as dollars with up to two decimal places.");return;}
    const target=organization+":"+job+":"+revision;
    setBusy(true);
    onBusy(true);
    setMessage("");
    try {
      const savedLines=lines.map(({chargedAmount,hourlyAmount,billingMinutes,billingBasis,...line})=>({...line,billingBasis,...(billingBasis==="hourly"?{billingMinutes,unitRateCents:invoiceChargeCents(hourlyAmount)}:{}),chargedCents:invoiceChargeCents(chargedAmount)}));
      if(savedLines.some(line=>line.chargedCents===null)){setMessage("Enter each charge as dollars with up to two decimal places. Nothing was saved.");return;}
      const value = { organization, job, revision, lines:savedLines };
      const fingerprint = JSON.stringify(value);
      if (retry.current?.fingerprint !== fingerprint)
        retry.current = { fingerprint, key: crypto.randomUUID() };
      const r = await sessionFetch("/api/invoice-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...value, key: retry.current.key }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if(!mounted.current||currentTarget.current!==target)return;
      setMessage(
        "Draft saved. These charges will be used when you issue the invoice.",
      );
      retry.current = null;
      saved();
    } catch (e) {
      if(mounted.current&&currentTarget.current===target)setMessage(publicError(e));
    } finally {
      if(mounted.current&&currentTarget.current===target){setBusy(false);onBusy(false);}
    }
  }
  async function approve() {
    if (busy || blocked || !loaded || !savedDraft || !reviewed || !completed)
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
        "Invoice approved and issued. Open Money to review the invoice and separately request email delivery.",
      );
      saved();
    } catch (error) {
      if(mounted.current&&currentTarget.current===target)setMessage(publicError(error));
    } finally {
      if(mounted.current&&currentTarget.current===target){setBusy(false);onBusy(false);}
    }
  }
  return (
    <details>
      <summary>
        {completed
          ? "Review and approve invoice"
          : "Record work and prepare invoice draft"}
      </summary>
      <p>
        Record the work, including anything you choose not to charge for. These
        lines replace the labor total. Materials and mixed taxable/exempt work require a separately reviewed invoice; do not include them here.
        Charges cannot exceed approved labor.
      </p>
      <p>
        {completed
          ? "Save any changes, then review the saved draft before approving. Approval fixes the issued charges; it does not email the customer."
          : "You can prepare the draft now. Complete the service call before approving its invoice."}
      </p>
      <form onSubmit={save}>
        <fieldset disabled={busy || blocked || !loaded}>
          <legend>Invoice draft</legend>
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
              <label>Billing basis<select value={l.billingBasis} onChange={e=>change(i,{billingBasis:e.target.value as "fixed"|"hourly"})}><option value="fixed">Fixed approved amount</option><option value="hourly">Time × hourly rate</option></select></label>{l.billingBasis==="hourly"&&<><label>Billed minutes (may include the agreed minimum)<input type="number" min="0" max="1440" required value={l.billingMinutes} onChange={e=>change(i,{billingMinutes:Number(e.target.value)})}/></label><label>Hourly rate ($)<input required inputMode="decimal" value={l.hourlyAmount} onChange={e=>change(i,{hourlyAmount:e.target.value})}/></label></>}
              <label>
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
              <label>
                Reason for no charge
                <input
                  required={invoiceChargeCents(l.chargedAmount) === 0}
                  minLength={invoiceChargeCents(l.chargedAmount) === 0 ? 2 : 0}
                  maxLength={1000}
                  value={l.waiverReason}
                  onChange={(e) => change(i, { waiverReason: e.target.value })}
                />
              </label>
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
                I reviewed the work, final charges and any applicable tax. The customer accepted the total; the rule applies to all work and the exact address.
              </label>
              <button disabled={busy || !reviewed}>Save invoice draft</button>
              {completed && (
                <button
                  type="button"
                  disabled={busy || !reviewed || !savedDraft || Boolean(taxContext?.required&&(!taxPreview||taxEvidence.trim().length<2))}
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
