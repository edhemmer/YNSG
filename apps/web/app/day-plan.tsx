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
    [savingRule, setSavingRule] = useState(false);
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
        if (live && current === sequence.current) setError(publicError(e));
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
          Refresh call sheet
        </button>
        <button
          type="button"
          className="secondary"
    …12653 tokens truncated…              )}
            </>
          )}
        </fieldset>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
