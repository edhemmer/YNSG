"use client";
import { useRef, useState } from "react";
import { sessionFetch } from "../lib/session-fetch";
import type { PackingItem, PackingRule, WorkItem } from "../lib/packing-plan";
export default function PackingRuleEditor({
  organization,
  work,
  rule,
  saved,
  busy,
  locked,
}: {
  organization: string;
  work: WorkItem;
  rule?: PackingRule;
  saved: () => void;
  busy: (saving: boolean) => void;
  locked: boolean;
}) {
  const [items, setItems] = useState<PackingItem[]>(
      () => rule?.items.map((v) => ({ ...v })) || [],
    ),
    [none, setNone] = useState(rule?.items.length === 0),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const change = (index: number, patch: Partial<PackingItem>) => {
    setItems((previous) =>
      previous.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
    setNone(false);
  };
  async function approve() {
    if (items.length === 0 && !none) {
      setError(
        "Add equipment, or confirm that this task needs no listed equipment.",
      );
      return;
    }
    setPending(true);
    busy(true);
    setError("");
    try {
      const value = {
        organization,
        ...work,
        revision: rule?.revision || 0,
        items,
      };
      const fingerprint = JSON.stringify(value);
      if (retry.current?.fingerprint !== fingerprint)
        retry.current = { fingerprint, key: crypto.randomUUID() };
      const response = await sessionFetch("/api/packing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...value, key: retry.current.key }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "The packing list was not saved.");
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
      busy(false);
    }
  }
  return (
    <details className="packing-editor day-plan-controls">
      <summary>
        {rule ? "Edit approved equipment" : "Set equipment"}: {work.service}
        {work.task ? ": " + work.task : ""}
      </summary>
      <p>
        These items apply to this exact task for future visits. Enter the
        quantity needed for one occurrence of the task. Reusable tools are
        combined using the largest quantity needed; consumables are added across
        tasks.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void approve();
        }}
      >
        <fieldset disabled={pending || locked}>
          {items.map((item, index) => (
            <div className="packing-item" key={index}>
              <label>
                Equipment or supply
                <input
                  required
                  maxLength={80}
                  value={item.name}
                  onChange={(e) => change(index, { name: e.target.value })}
                />
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  required
                  min={1}
                  max={1000}
                  step={1}
                  value={item.quantity}
                  onChange={(e) =>
                    change(index, { quantity: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Unit
                <input
                  required
                  maxLength={24}
                  pattern="[A-Za-z][A-Za-z ]{0,23}"
                  placeholder="each, pair, bag"
                  value={item.unit}
                  onChange={(e) => change(index, { unit: e.target.value })}
                />
              </label>
              <label>
                Item type
                <select
                  value={item.consumed ? "consumed" : "reusable"}
                  onChange={(e) =>
                    change(index, { consumed: e.target.value === "consumed" })
                  }
                >
                  <option value="reusable">Reusable tool or equipment</option>
                  <option value="consumed">Supply used up on the task</option>
                </select>
              </label>
              <button
                type="button"
                className="secondary"
                onClick={() => setItems((v) => v.filter((_, i) => i !== index))}
              >
                Remove item
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={items.length >= 40}
            className="secondary"
            onClick={() => {
              setItems((v) => [
                ...v,
                { name: "", quantity: 1, unit: "each", consumed: false },
              ]);
              setNone(false);
            }}
          >
            Add equipment or supply
          </button>
          {items.length === 0 && (
            <label className="check">
              <input
                type="checkbox"
                checked={none}
                onChange={(e) => setNone(e.target.checked)}
              />
              I reviewed this task; no listed equipment is needed.
            </label>
          )}
          <button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Approve this packing list"}
          </button>
        </fieldset>
      </form>
    </details>
  );
}
