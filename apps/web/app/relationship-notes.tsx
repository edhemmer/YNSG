"use client";
import { publicError } from "../lib/public-errors";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { sessionFetch } from "../lib/session-fetch";
type Note = { id: string; body: string; created_at: string; request_id: string | null };
async function call(path: string, body?: unknown) {
  const response = await sessionFetch(path, { cache: "no-store", ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Notes could not be opened.");
  return data;
}
export default function RelationshipNotes({ organization, type, target, timezone }: { organization: string; type: "request" | "customer"; target: string; timezone: string }) {
  const [open, setOpen] = useState(false), [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState(""), [pending, setPending] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [page, setPage] = useState(0), [hasMore, setHasMore] = useState(false);
  const sequence = useRef(0), retry = useRef<{ fingerprint: string; key: string } | null>(null);
  async function reload() {
    const current = ++sequence.current; setLoading(true); setError("");
    try {
      const result = await call(`/api/notes?${new URLSearchParams({ organization, type, target, page: String(page) })}`);
      if (sequence.current === current) { setNotes(result.notes); setHasMore(result.hasMore); }
    } catch (e) { if (sequence.current === current) setError(publicError(e)); }
    finally { if (sequence.current === current) setLoading(false); }
  }
  useEffect(() => { if (open) void reload(); return () => { sequence.current++; }; }, [open, organization, type, target, page]);
  async function save(event: FormEvent) {
    event.preventDefault(); const text = body.trim(); if (!text) return;
    setPending(true); setError(""); setMessage("");
    const fingerprint = JSON.stringify([organization, type, target, text]);
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID() };
    try {
      await call("/api/notes", { organization, type, target, body: text, key: retry.current!.key });
      retry.current = null; setBody(""); setMessage("Note saved.");
      if (page !== 0) setPage(0); else await reload();
    } catch (e) { setError(publicError(e)); }
    finally { setPending(false); }
  }
  const region = `notes-${type}-${target}`;
  return <section aria-label="Owner notes">
    <button type="button" className="secondary" disabled={pending} aria-expanded={open} aria-controls={region} onClick={() => setOpen(!open)}>{open ? "Close notes" : "Conversation notes"}</button>
    {open && <div id={region} className="card">
      <h3>{type === "customer" ? "Customer conversation history" : "Request conversation notes"}</h3>
      <p className="muted">For your business records. These notes are not shown in the customer account.</p>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <form onSubmit={save}>
        <label htmlFor={`${region}-body`}>Add a note</label>
        <textarea id={`${region}-body`} required disabled={pending} maxLength={4000} rows={3} value={body} onChange={e => setBody(e.target.value)} />
        <button disabled={pending}>{pending ? "Saving…" : "Save note"}</button>
      </form>
      {loading ? <p role="status">Loading notes…</p> : notes.length ? notes.map(note => <article className="row" key={note.id}>
        <time dateTime={note.created_at}>{new Intl.DateTimeFormat("en-US", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(note.created_at))}</time>
        {type === "customer" && note.request_id && <p className="tiny">From a linked service request</p>}
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note.body}</p>
      </article>) : <p>No notes on this page.</p>}
      <div className="actions"><button type="button" className="secondary" disabled={pending || loading || page === 0} onClick={() => setPage(page - 1)}>Previous notes</button><button type="button" className="secondary" disabled={pending || loading || !hasMore} onClick={() => setPage(page + 1)}>More notes</button><button type="button" className="secondary" disabled={pending || loading} onClick={() => void reload()}>Refresh notes</button></div>
    </div>}
  </section>;
}
