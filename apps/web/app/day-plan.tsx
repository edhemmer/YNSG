"use client";
import { useEffect, useRef, useState } from "react";
import { sessionFetch } from "../lib/session-fetch";
import { localDate, navigationUrl, type DayPlan } from "../lib/day-plan";
export default function DailyCallSheet({
  organization,
  timezone,
}: {
  organization: string;
  timezone: string;
}) {
  const [date, setDate] = useState(() => localDate(new Date(), timezone)),
    [plan, setPlan] = useState<DayPlan | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [reload, setReload] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    setDate(localDate(new Date(), timezone));
  }, [organization, timezone]);
  useEffect(() => {
    const current = ++sequence.current;
    let live = true;
    setPlan(null);
    setError("");
    setLoading(true);
    void sessionFetch(
      `/api/day-plan?organization=${encodeURIComponent(organization)}&date=${encodeURIComponent(date)}`,
    )
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok)
          throw Error(
            value.error || "The daily call sheet could not be loaded.",
          );
        if (live && current === sequence.current) setPlan(value);
      })
      .catch((e) => {
        if (live && current === sequence.current) setError(e.message);
      })
      .finally(() => {
        if (live && current === sequence.current) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [organization, date, reload]);
  const time = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeStyle: "short",
    }).format(new Date(value));
  return (
    <section
      className="card daily-call-sheet"
      aria-labelledby="day-plan-heading"
    >
      <h2 id="day-plan-heading">Daily call sheet</h2>
      <div className="actions day-plan-controls">
        <label>
          Appointments for
          <input
            type="date"
            required
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() => setReload((v) => v + 1)}
        >
          Refresh call sheet
        </button>
        <button
          type="button"
          className="secondary"
          disabled={loading || !plan || plan.date !== date}
          onClick={() => window.print()}
        >
          Print call sheet
        </button>
      </div>
      <p>
        In appointment order · {timezone}. Choose tomorrow’s date to plan the
        next day. Navigation uses your current location if you allow it in Maps.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading the complete day…</p>}
      {plan && plan.date === date && (
        <>
          <p>
            {plan.company} · {plan.date} · {plan.calls.length} appointment
            {plan.calls.length === 1 ? "" : "s"}
          </p>
          <p className="tiny">
            Updated {time(plan.generatedAt)}. Refresh before leaving; printed
            copies do not update.
          </p>
          {!plan.calls.length && (
            <p>
              No confirmed appointments or appointments needing review for this
              date.
            </p>
          )}
          {plan.calls.map((call, index) => {
            const navigation = navigationUrl(call.address);
            return (
              <article key={call.id} className="row day-call">
                <h3>
                  {index + 1}. {time(call.arrivalAt)} — {call.name}
                </h3>
                <p>
                  <strong>
                    {call.status === "reserved"
                      ? "Confirmed appointment"
                      : "Needs scheduling review — check before traveling"}
                  </strong>
                  <br />
                  Scheduled finish: {time(call.endAt)}
                  <br />
                  Customer response:{" "}
                  {call.customerResponse === "confirmed"
                    ? "Confirmed"
                    : call.customerResponse === "reschedule_requested"
                      ? "Requested another time"
                      : "Awaiting response"}
                </p>
                <p>
                  {call.address || "Address needs review"}
                  <br />
                  {call.phone || "Phone needs review"}
                  <br />
                  {call.email || "Email needs review"}
                </p>
                <ul>
                  {call.tasks.map((task, i) => (
                    <li key={i}>{task}</li>
                  ))}
                </ul>
                {call.description && <p>{call.description}</p>}
                <div className="actions day-plan-controls">
                  {navigation && (
                    <a
                      className="button"
                      href={navigation}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Navigate to address
                    </a>
                  )}
                  {call.phone && (
                    <a href={`tel:${call.phone}`}>Call customer</a>
                  )}
                  <a href={`/?organization=${encodeURIComponent(organization)}&request=${encodeURIComponent(call.requestId)}`}>
                    Open service order
                  </a>
                </div>
                <p className="tiny print-order-id">
                  Service request: {call.requestId}
                </p>
              </article>
            );
          })}
        </>
      )}
    </section>
  );
}
