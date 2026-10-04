"use client";
import { publicError } from "../lib/public-errors";
import { useEffect, useState, type FormEvent } from "react";
import { sessionFetch } from "../lib/session-fetch";
async function call(body?: unknown) {
  const response = await sessionFetch("/api/owner-setup", {
    cache: "no-store",
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Setup could not be completed.");
  return data;
}
export default function OwnerSetup({ onComplete }: { onComplete: () => Promise<void> }) {
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    call().then(data => { if (active) setEligible(data.eligible); })
      .catch(() => { if (active) setError("Unable to check your setup invitation. Reload to try again."); });
    return () => { active = false; };
  }, []);
  async function claim(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try { await call({ action: "claim" }); await onComplete(); }
    catch (e) { setError(publicError(e)); }
    finally { setPending(false); }
  }
  return <div className="card">
    <h1>{eligible ? "Finish owner setup" : "Your account is verified."}</h1>
    {error && <p role="alert">{error}</p>}
    {eligible === null && !error && <p>Checking your setup invitation…</p>}
    {eligible === false && <p>No company has been shared with this account. An authorized administrator must grant access.</p>}
    {eligible && <form onSubmit={claim}>
      <p>Your email is verified. Finish setup to open your business workspace.</p>
      <button disabled={pending}>{pending ? "Opening your workspace…" : "Finish owner setup"}</button>
    </form>}
  </div>;
}
