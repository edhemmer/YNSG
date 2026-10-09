"use client";
import { publicError } from "../lib/public-errors";
import { useEffect, useRef, useState } from "react";
import { sessionFetch } from "../lib/session-fetch";
import {
  localDate,
  shiftLocalDate,
  navigationUrl,
  type DayPlan,
} from "../lib/day-plan";
import DelayNotice from './delay-notice';
import PackingRuleEditor from "./packing-rule-editor";
import { workKey } from "../lib/packing-plan";
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
    [reload, setReload] = useState(0),
    [operator,setOperator]=useState(""),
    [savingRule, setSavingRule] = useState(false);
  const sequence = useRef(0);
  useEffect(() => {
    setDate(localDate(new Date(), timezone));setOperator("");
  }, [organization, timezone]);
  useEffect(() => {
    const current = ++sequence.current;
    let live = true;
    setPlan(null);
    setError("");
    setLoading(true);
    void sessionFetch(
      `/api/day-plan?organization=${encodeURIComponent(organization)}&date=${encodeURIComponent(date)}${operator?`&operator=${encodeURIComponent(operator)}`:""}`,
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
        if (live && current === sequence.current) setError(publicError(e));
      })
      .finally(() => {
        if (live && current === sequence.current) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [organization, date, operator, reload]);
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
      <h2 id="day-plan-heading">Day route</h2>
      <div className="actions day-plan-controls">
        <label>
          Appointments for
          <input
            type="date"
            required
            value={date}
            disabled={savingRule}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <button
          type="button"
          disabled={loading || savingRule}
          onClick={() => setReload((v) => v + 1)}
        >
          Refresh route
        </button>
        <button
          type="button"
          className="secondary"
          disabled={loading || savingRule || !plan || plan.date !== date}
          onClick={() => window.print()}
        >
          Print day plan
        </button>
      </div>
      <div className="actions day-plan-controls">
        <button
          type="button"
          disabled={savingRule}
          className="secondary"
          onClick={() => {
            setDate(localDate(new Date(), timezone));setOperator("");
            setReload((v) => v + 1);
          }}
        >
          Today
        </button>
        <button
          type="button"
          disabled={savingRule}
          className="secondary"
          onClick={() =>
            setDate(shiftLocalDate(localDate(new Date(), timezone), 1))
          }
        >
          Tomorrow
        </button>
      </div>
      <p>Choose any date to see its visits in appointment order. Open the route in Maps to navigate.</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading the complete day…</p>}
      {plan && plan.date === date && (
        <>
          {(plan.operators?.length||0)>1&&<label>Operator route<select value={operator||plan.selectedOperator||''} disabled={savingRule} onChange={e=>setOperator(e.target.value)}>{plan.operators?.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
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
          {plan.route&&<section className="route-summary" aria-label="Travel between visits">
            <h3>Travel & schedule</h3>
            <div className="actions day-plan-controls">{plan.route.mapsUrls.map((url,i)=><a key={url} className="button" href={url} target="_blank" rel="noopener noreferrer">{plan.route!.mapsUrls.length===1?'Open day route in Maps':`Open route segment ${i+1}`}</a>)}</div>
            {plan.route.legs.length>0&&<p className="tiny">Google Maps travel estimates use each visit’s scheduled finish as departure. Times can change with traffic. Check supplier pickups separately.</p>}
            {plan.route.warnings.map(w=><p key={w} className="note">{w}</p>)}
            {plan.route.legs.filter(l=>l.lateMinutes!==null&&l.lateMinutes>0).map(l=><p key={l.toId} className="error">Travel to {plan.calls.find(c=>c.id===l.toId)?.name} needs {l.minutes} minutes; the schedule allows {l.gapMinutes}. Estimated {l.lateMinutes} minutes late. Review the appointment time below.</p>)}
            {plan.route.grouping.map(g=><p className="note" key={g.nearbyId}>Nearby visits: {plan.calls.find(c=>c.id===g.firstId)?.name} and {plan.calls.find(c=>c.id===g.nearbyId)?.name}. The visit with {plan.calls.find(c=>c.id===g.betweenId)?.name} separates them with a longer drive. Consider grouping the nearby visits when rescheduling; customer times need confirmation.</p>)}
          </section>}
          {plan.calls.map((call, index) => {
            const navigation = navigationUrl(call.address);
            const leg=plan.route?.legs.find(l=>l.toId===call.id);
            return (
              <article key={call.id} className="row day-call">
                <h3>
                  {index + 1}. {time(call.arrivalAt)} — {call.name}
                </h3>
                {leg&&<p className="note">{leg.minutes===null?leg.reason:`From the previous visit: ${leg.minutes} min · ${((leg.meters||0)/1609.344).toFixed(1)} miles · ${leg.gapMinutes} min between visits${leg.lateMinutes?` · ${leg.lateMinutes} min short`:''}`}</p>}
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
                  {navigation ? (
                    <a href={navigation} target="_blank" rel="noopener noreferrer"
                      aria-label={`Directions to ${call.name} at ${call.address}`}>
                      {call.address}
                    </a>
                  ) : "Address needs review"}
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
                      Directions from my location
                    </a>
                  )}
                  {call.phone && (
                    <a href={`tel:${call.phone}`}>Call customer</a>
                  )}
                  <a
                    href={`/?organization=${encodeURIComponent(organization)}&request=${encodeURIComponent(call.requestId)}`}
                  >
                    Open service order
                  </a>
                </div>
                {call.status==='reserved'&&call.revision&&plan.date===localDate(new Date(),timezone)&&Date.parse(call.endAt)>Date.now()&&<DelayNotice key={organization+':'+call.id+':'+call.revision} organization={organization} appointment={call.id} revision={call.revision} email={call.email}/>}
                <p className="tiny print-order-id">
                  Service request: {call.requestId}
                </p>
              </article>
            );
          })}
          <details className="day-packing"><summary>Equipment & supplies for this day</summary>
          <section
            className="packing-summary"
            aria-labelledby="packing-heading"
          >
            <h3 id="packing-heading">What to bring</h3>
            <p>
              {plan.packing.complete
                ? "All scheduled tasks have approved equipment lists. Review supplies and pickup details before loading."
                : "Packing needs review. Check the flagged tasks and appointments before loading."}
            </p>
            {plan.packing.warnings.length > 0 && (
              <ul className="note">
                {plan.packing.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            )}
            {plan.packing.items.length > 0 ? (
              <ul className="packing-checklist">
                {plan.packing.items.map((item) => (
                  <li key={item.name}>
                    <label>
                      <input type="checkbox" />
                      <span>
                        {item.quantity} {item.unit} — {item.name}
                        {item.consumed ? " (supply)" : ""}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {!plan.packingRulesAvailable
                  ? "Equipment details are unavailable. Refresh before loading."
                  : plan.calls.length
                    ? "No equipment has been listed for this day."
                    : "No appointments to pack for."}
              </p>
            )}
            {plan.packing.unmapped.length > 0 && (
              <>
                <h4>Equipment not set yet</h4>
                <ul>
                  {plan.packing.unmapped.map((work) => (
                    <li key={workKey(work)}>
                      {work.service}
                      {work.task ? ": " + work.task : ""}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="tiny">
              Packing checkmarks are temporary and clear when the sheet reloads.
              Customer-prepaid materials, pickups and quantities still need
              order review; they are not estimated here.
            </p>
            {plan.packingRulesAvailable && (
              <div className="day-plan-controls">
                {[
                  ...new Map(
                    plan.calls
                      .filter((call) => call.status === "reserved")
                      .flatMap((call) => call.workItems)
                      .map((work) => [workKey(work), work]),
                  ).values(),
                ].map((work) => {
                  const rule = plan.packingRules.find(
                    (r) => workKey(r) === workKey(work),
                  );
                  return (
                    <PackingRuleEditor
                      key={workKey(work) + ":" + (rule?.revision || 0)}
                      organization={organization}
                      work={work}
                      rule={rule}
                      locked={savingRule}
                      busy={setSavingRule}
                      saved={() => setReload((v) => v + 1)}
                    />
                  );
                })}
              </div>
            )}
          </section>
          </details>
        </>
      )}
    </section>
  );
}
