"use client";
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
}: {
  organization: string;
  job: string;
  revision: number;
  saved: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [reviewed, setReviewed] = useState(false);
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    let current = true;
    sessionFetch(
      "/api/invoice-draft?organization=" + organization + "&job=" + job,
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (current) setLines(d.draft?.lines || []);
      })
      .catch((e) => {
        if (current) setMessage(e.message);
      });
    return () => {
      current = false;
    };
  }, [organization, job, revision]);
  function change(index: number, patch: Partial<Line>) {
    setReviewed(false);
    setLines((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
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
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Customize labor invoice</summary>
      <p>
        Record the work, including anything you choose not to charge for. These
        lines replace the labor total; materials and tax are not supported here.
        Charges cannot exceed approved labor.
      </p>
      <form onSubmit={save}>
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
              ).toLocaleString("en-US", { style: "currency", currency: "USD" })}
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
          </>
        )}
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
