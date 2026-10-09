"use client";
import { publicError } from "../lib/public-errors";
import { useEffect, useRef, useState } from "react";
import { sessionFetch } from "../lib/session-fetch";
import {invoiceChargeCents} from "../lib/invoice-charge";
type Line = {
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
    setLines([]);
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
          setLines((d.draft?.lines || []).map((line:{description:string;recordedMinutes:number;chargedCents:number;waiverReason:string})=>({description:line.description,recordedMinutes:line.recordedMinutes,waiverReason:line.waiverReason,chargedAmount:(line.chargedCents/100).toFixed(2)})));
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
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
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
      const savedLines=lines.map(({chargedAmount,...line})=>({...line,chargedCents:invoiceChargeCents(chargedAmount)}));
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
        totalCents: lines.reduce((sum, line) => sum + (invoiceChargeCents(line.chargedAmount)??0), 0),
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
        lines replace the labor total; materials and tax are not supported here.
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
              <label>
                Charge ($)
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]{1,7}(\.[0-9]{1,2})?"
                  required
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
              <label>
                <input
                  type="checkbox"
                  required
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                I reviewed all recorded work and these final labor charges.
              </label>
              <button disabled={busy || !reviewed}>Save invoice draft</button>
              {completed && (
                <button
                  type="button"
                  disabled={busy || !reviewed || !savedDraft}
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
