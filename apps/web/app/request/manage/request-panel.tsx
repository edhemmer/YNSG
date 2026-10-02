"use client";
import { useEffect, useRef, useState } from "react";
type Context = {
  company: string;
  timezone: string;
  configurationVersion: number;
  name: string;
  address: string;
  services: { service: string; task?: string }[];
  appointmentRevision: number;
  responseVersion: number;
  status: string;
  arrivalAt: string;
  reservedStart: string;
  endAt: string;
  response: string;
  actions: string[];
  expiresAt: string;
  decisionReason: string | null;
  pendingPreference: {
    preferredLocalStart: string | null;
    note: string;
    createdAt: string;
  } | null;
};
async function api(value: unknown) {
  const response = await fetch("/api/customer-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Please try again.");
  return data;
}
export default function CustomerRequest() {
  const [context, setContext] = useState<Context | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    [loading, setLoading] = useState(true),
    [reschedule, setReschedule] = useState(false),
    [preferred, setPreferred] = useState(""),
    [note, setNote] = useState("");
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null),
    seq = useRef(0),
    opening = useRef<Promise<{ context: Context }> | null>(null);
  async function refresh() {
    const d = await api({ operation: "context" });
    setContext(d.context);
    return d.context as Context;
  }
  useEffect(() => {
    let alive = true;
    const s = ++seq.current;
    if (!opening.current) {
      const params = new URLSearchParams(location.hash.slice(1)),
        token = params.get("token");
      if (params.get("action") === "reschedule") setReschedule(true);
      history.replaceState(null, "", location.pathname);
      opening.current = api(
        token ? { operation: "open", token } : { operation: "context" },
      );
    }
    void opening.current
      .then((d) => {
        if (alive && s === seq.current) {
          setContext(d.context);
          setError("");
        }
      })
      .catch((e) => {
        if (alive && s === seq.current) setError(e.message);
      })
      .finally(() => {
        if (alive && s === seq.current) setLoading(false);
      });
    return () => {
      alive = false;
      seq.current++;
    };
  }, []);
  async function act(action: "confirm" | "request_another_time") {
    if (!context || pending) return;
    const s = seq.current;
    const input = {
      action,
      appointmentRevision: context.appointmentRevision,
      responseVersion: context.responseVersion,
      configurationVersion: context.configurationVersion,
      preferredLocalStart: action === "confirm" ? null : preferred || null,
      note: action === "confirm" ? "" : note.trim(),
    };
    const fingerprint = JSON.stringify(input);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    setPending(true);
    setError("");
    setMessage("");
    try {
      const d = await api({
        operation: "action",
        input,
        key: attempt.current.key,
      });
      if (s !== seq.current) return;
      setMessage(
        action === "confirm"
          ? "Thanks. We've recorded that you plan to be there."
          : d.result.originalRetained
            ? "Your request for another time is saved. Your current appointment is still booked until a replacement is approved."
            : "Your preferred time is saved on the same service request. It is not booked yet.",
      );
      attempt.current = null;
      try {
        await refresh();
      } catch {
        setError(
          "Your response was saved, but the latest details could not be loaded. Refresh to see them.",
        );
      }
      setReschedule(false);
    } catch (e) {
      if (s === seq.current) setError((e as Error).message);
    } finally {
      if (s === seq.current) setPending(false);
    }
  }
  const when = (v: string) =>
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: context?.timezone || "UTC",
    }).format(new Date(v));
  return (
    <main className="shell customer-request" id="main">
      <section className="card">
        <p className="eyebrow">
          {context?.company || "Your service appointment"}
        </p>
        <h1>Your appointment</h1>
        {loading && <p role="status">Opening your appointment…</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {!loading && !context && (
          <>
            <p>
              Use the latest appointment link from your email. If it has
              expired, contact the business for a new link.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setPending(true);
                void refresh()
                  .then(() => setError(""))
                  .catch((e) => setError(e.message))
                  .finally(() => setPending(false));
              }}
            >
              Try again
            </button>
          </>
        )}
        {context && (
          <>
            <p>Hi {context.name}. Here are the details saved for this visit.</p>
            <div className="appointment-summary">
              <h2>
                {context.status === "reserved"
                  ? "Booked appointment"
                  : context.status === "declined_time"
                    ? "Choose another time"
                    : "Service appointment update"}
              </h2>
              {context.status === "reserved" ? (
                <>
                  <p>
                    <strong>Arrival:</strong> {when(context.arrivalAt)}
                  </p>
                  <p>
                    <strong>Address:</strong> {context.address}
                  </p>
                  {context.reservedStart !== context.arrivalAt && (
                    <p>
                      Pickup work starts before arrival at your address. This
                      response does not change the agreed work or price.
                    </p>
                  )}
                </>
              ) : (
                <p>
                  {context.decisionReason ||
                    "This proposed appointment could not be confirmed."}
                </p>
              )}
              <h3>Requested work</h3>
              <ul>
                {context.services.map((v, i) => (
                  <li key={i}>
                    {v.service}
                    {v.task ? ": " + v.task : ""}
                  </li>
                ))}
              </ul>
            </div>
            {context.response === "confirmed" && (
              <p>
                Your attendance confirmation is recorded. Your appointment stays
                booked.
              </p>
            )}
            {context.pendingPreference && (
              <div className="notice">
                <h3>Your request for another time is awaiting review</h3>
                <p>
                  {context.pendingPreference.preferredLocalStart?.replace(
                    "T",
                    " at ",
                  )}{" "}
                  {context.pendingPreference.preferredLocalStart &&
                    `(${context.timezone})`}
                </p>
                <p>{context.pendingPreference.note}</p>
                <p>
                  {context.status === "reserved"
                    ? "Your original appointment remains booked until a replacement is approved."
                    : "No replacement time is booked yet."}
                </p>
              </div>
            )}
            {context.actions.includes("confirm") &&
              context.response !== "confirmed" &&
              context.response !== "reschedule_requested" &&
              !reschedule && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void act("confirm")}
                >
                  {pending ? "Saving…" : "Confirm I’ll be there"}
                </button>
              )}
            {context.actions.includes("request_another_time") && (
              <button
                type="button"
                className="secondary"
                disabled={pending}
                aria-expanded={reschedule}
                onClick={() => setReschedule((v) => !v)}
              >
                {context.pendingPreference
                  ? "Update my preferred time"
                  : context.status === "reserved"
                    ? "Request another time"
                    : "Choose another time"}
              </button>
            )}
            {reschedule && context.actions.includes("request_another_time") && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("request_another_time");
                }}
              >
                <h2>When would work for you?</h2>
                <p>
                  {context.status === "reserved"
                    ? "Your current appointment stays booked while another time is reviewed."
                    : "Your work and contact details stay on the same request."}{" "}
                  Sending this form does not reserve a new time.
                </p>
                <label>
                  Preferred date and time (optional)
                  <input
                    type="datetime-local"
                    value={preferred}
                    onChange={(e) => setPreferred(e.target.value)}
                    disabled={pending}
                  />
                </label>
                <p>Use {context.timezone} time.</p>
                <label>
                  Tell us when you’re available
                  <textarea
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={pending}
                    placeholder="For example, Tuesday morning or Thursday after lunch."
                  />
                </label>
                <button disabled={pending}>
                  {pending ? "Saving…" : "Send my preferred time"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={pending}
                  onClick={() => setReschedule(false)}
                >
                  Keep current details
                </button>
              </form>
            )}
            <button
              type="button"
              className="secondary"
              disabled={pending}
              onClick={() => {
                setPending(true);
                void refresh()
                  .then(() => {
                    attempt.current = null;
                    setError("");
                  })
                  .catch((e) => setError(e.message))
                  .finally(() => setPending(false));
              }}
            >
              Refresh appointment details
            </button>
            <p className="tiny">
              These controls respond to this appointment only. They do not
              approve a quote, extra work, payment, or cancellation.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
