"use client";
import { publicError } from "../lib/public-errors";
import { useEffect, useRef, useState } from "react";
import { sessionFetch } from "../lib/session-fetch";
import { localInstant } from "../../../packages/domain/timezone";
type Block = { id: string; startsAt: string; endsAt: string; revision: number };
export default function CalendarBlocks({
  organization,
  timezone,
  onChanged,
}: {
  organization: string;
  timezone: string;
  onChanged?: () => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>([]),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  async function load() {
    const r = await sessionFetch(
      "/api/calendar-blocks?organization=" + organization,
    );
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setBlocks(d.blocks);
  }
  useEffect(() => {
    void load().catch((e) => setMessage(publicError(e)));
  }, [organization]);
  async function save(block: Block | null) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const value = {
        organization,
        id: block?.id || null,
        revision: block?.revision || null,
        start: block
          ? null
          : new Date(localInstant(start, timezone)).toISOString(),
        end: block ? null : new Date(localInstant(end, timezone)).toISOString(),
        remove: Boolean(block),
      };
      const fingerprint = JSON.stringify(value);
      if (retry.current?.fingerprint !== fingerprint)
        retry.current = { fingerprint, key: crypto.randomUUID() };
      const r = await sessionFetch("/api/calendar-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...value, key: retry.current.key }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await load();
      onChanged?.();
      setMessage(
        block
          ? "Time is available again."
          : "Time blocked. Customers will only see that it is unavailable.",
      );
      setStart("");
      setEnd("");
      retry.current = null;
    } catch (e) {
      setMessage(publicError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Block calendar time</h2>
      <p>
        Choose a time range or several days. No personal reason is shown to
        customers. Times below use {timezone}.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(null);
        }}
      >
        <label>
          From
          <input
            type="datetime-local"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Until
          <input
            type="datetime-local"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <button disabled={busy}>Block this time</button>
      </form>
      {message && <p role="status">{message}</p>}
      {blocks.map((b) => (
        <div key={b.id} className="account-card">
          <p>
            {new Date(b.startsAt).toLocaleString(undefined, {
              timeZone: timezone,
            })}{" "}
            –{" "}
            {new Date(b.endsAt).toLocaleString(undefined, {
              timeZone: timezone,
            })}
          </p>
          <button disabled={busy} onClick={() => void save(b)}>
            Remove block
          </button>
        </div>
      ))}
    </section>
  );
}
