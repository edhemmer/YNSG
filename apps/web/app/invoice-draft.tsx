"use client";
import { publicError } from "../lib/public-errors";
import { useEffect, useRef, useState } from "react";
import { sessionFetch } from "../lib/session-fetch";
type Line = {
  description: string;
  recordedMinutes: number;
  chargedCents: number;
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
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => () => onBusy(false), [onBusy]);
  useEffect(() => {
    let current = true;
    setLoaded(false);
    setSavedDraft(false);
    setLines([]);
    setReviewed(false);
    setMessage("");
    retry.current = null;
    sessionFetch(
      "/api/invoice-draft?organization=" + organization + "&job=" + job,
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (current) {
          setLines(d.draft?.lines || []);
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
      current = false;
    };
  }, [organization, job, revision]);
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
    setBusy(true);
    onBusy(true);
    setMessage("");
    try {
      const value = { organization, job, revision, lines };
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
      setMessage(
        "Draft saved. These charges will be used when you issue the invoice.",
      );
      retry.current = null;
      saved();
    } catch (e) {
      setMessage(publicError(e));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  async function approve() {
    if (busy || blocked || !loaded || !savedDraft || !reviewed || !completed)
      return;
    setBusy(true);
    onBusy(true);
    setMessage("");
    try {
      const value = {
        command: "ApproveInvoice",
        organizationId: organization,
        id: job,
        revision,
        totalCents: lines.reduce((sum, line) => sum + line.chargedCents, 0),
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
      retry.current = null;
      setMessage(
        "Invoice approved and issued. Open Money to review the invoice and separately request email delivery.",
      );
      saved();
    } catch (error) {
      setMessage(publicError(error));
    } finally {
      setBusy(false);
      onBusy(false);
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
                  type="number"
                  min="0"
                  max="9999999.99"
                  step="0.01"
                  required
                  value={l.chargedCents / 100}
                  onChange={(e) =>
                    change(i, {
                      chargedCents: Math.round(Number(e.target.value) * 100),
                    })
                  }
                />
              </label>
              <label>
                Reason for no charge
                <input
                  required={l.chargedCents === 0}
                  minLength={l.chargedCents === 0 ? 2 : 0}
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
                  chargedCents: 0,
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
                {(
                  lines.reduce((sum, l) => sum + l.chargedCents, 0) / 100
                ).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
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
