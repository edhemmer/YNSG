"use client";
import { publicError } from "../lib/public-errors";
import { googleMessages as messages } from "../lib/google-messages";
import { useEffect, useRef, useState } from "react";
import {sessionFetch} from '../lib/session-fetch';
type Connection = {
  connected: boolean;
  canCreateCalendar: boolean;
  email: string | null;
  calendarId: string | null;
  health: string;
  checkedAt: string | null;
  gmailTest: string;
};
type Delivery={enabled:boolean;testKey:string|null;configurationVersion:number|null;connectionRevision:number|null;receiptConfirmedAt:string|null;senderMatches:boolean};
type Calendar = { id: string; summary: string; timeZone?: string };
type CalendarCreation = { status: string; calendarId: string | null; summary: string };
export default function GoogleControls({
  organization,
  view = "email",
}: {
  organization: string;
  view?: "calendar" | "email" | "settings";
}) {
  const [connection, setConnection] = useState<Connection | null>(null),
    [missing, setMissing] = useState<string[]>([]),
    [calendars, setCalendars] = useState<Calendar[]>([]),
    [calendar, setCalendar] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [calendarsLoading, setCalendarsLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [delivery,setDelivery]=useState<Delivery|null>(null),[dispatcherEnabled,setDispatcherEnabled]=useState(false),[received,setReceived]=useState(false);
  const [creation, setCreation] = useState<CalendarCreation | null>(null);
  const deliveryKey=useRef<string|null>(null);
  const generation = useRef(0),
    testKey = useRef<string | null>(null);
  async function load(advance=true) {
    const gen = advance?++generation.current:generation.current;
    setStatusLoading(true);
    try {
      const r = await sessionFetch(
          "/api/google?organization=" + encodeURIComponent(organization),
          { cache: "no-store" },
        ),
        v = await r.json();
      if (gen !== generation.current) return;
      if (!r.ok) throw new Error(v.error);
      setDelivery(v.delivery);setDispatcherEnabled(v.dispatcherEnabled===true);deliveryKey.current=null;
      setMissing(v.missing);
      setConnection(v.connection);
      setCreation(v.creation || null);
      setCalendar(v.connection?.calendarId || "");
      if (view !== "email" && v.connection?.connected) await loadCalendars(gen);
    } catch (e) {
      if (gen === generation.current)
        setMessage(
          messages[(e as Error).message] ||
            "Unable to read Google connection status.",
        );
    } finally {
      if (gen === generation.current) setStatusLoading(false);
    }
  }
  async function loadCalendars(gen = generation.current) {
    setCalendarsLoading(true);
    try {
      const response = await sessionFetch("/api/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "calendars", organization }),
      });
      const value = await response.json();
      if (gen !== generation.current) return;
      if (!response.ok) throw new Error(value.error);
      setCalendars(value.calendars);
    } catch {
      if (gen === generation.current) setMessage("Your calendar list could not be loaded. Press Refresh calendars to try again.");
    } finally {
      if (gen === generation.current) setCalendarsLoading(false);
    }
  }
  useEffect(() => {
    setConnection(null);setDelivery(null);setReceived(false);deliveryKey.current=null;
    setCalendars([]);setCreation(null);setBusy(false);setMessage("");setCalendarsLoading(false);
    testKey.current = null;
    void load();
    const outcome = new URLSearchParams(window.location.search).get("google");
    if (outcome)
      setMessage(
        outcome === "connected"
          ? "Google connected. Select a calendar and run the Gmail test."
          : "Google connection was not completed. Check configuration and try Connect Google again.",
      );
    return () => {
      generation.current++;
    };
  }, [organization, view]);
  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const gen = generation.current;
    try {
      const r = await sessionFetch("/api/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, organization, ...extra }),
        }),
        v = await r.json();
      if (gen !== generation.current) return;
      if (!r.ok) throw new Error(v.error);
      if (v.url) {
        window.location.assign(v.url);
        return;
      }
      if (action === "sync")
        setMessage(
          "Calendar sync: " +
            v.results.length + " queued change(s) checked" +
            ". " +
            (v.status || []).filter(
              (s: { state: string }) => s.state === "needs_review",
            ).length +
            " event(s) need owner review.",
        );
      if (v.creation) {
        setCreation(v.creation);
        setMessage(v.creation.status === "created"
          ? "Your business calendar is ready. Choose it below and press Use this calendar."
          : v.creation.status === "failed"
            ? "Google rejected calendar creation. Check Google permissions before trying again."
            : "Calendar creation is uncertain. Load your calendars and check for the business calendar before continuing. Another calendar will not be created automatically.");
      }
      if (v.creation) await loadCalendars(gen);
      if (gen !== generation.current) return;
      if (v.calendars) setCalendars(v.calendars);
      if (v.connection) setConnection(v.connection);
      if(v.delivery){setDelivery(v.delivery);setDispatcherEnabled(v.dispatcherEnabled===true);deliveryKey.current=null;setReceived(false);setMessage(v.delivery.enabled?'CRM email delivery authorized for this company. The dispatcher must also be enabled and scheduled.':'CRM email delivery paused for this company.');}
      if(action==='send_pending')setMessage('Processed '+v.deliveries.length+' queued communication(s). Provider acceptance is shown separately from delivery.');
      if (action === "disconnect") {
        setCalendars([]);
        setCalendar("");
        testKey.current = null;
        setMessage(
          v.revoked
            ? "Google disconnected. Existing calendar events were retained."
            : publicError(v.message, "Google disconnected. Check Settings before reconnecting."),
        );
        await load();
      }
      if (action === "test_email" && ['accepted','failed'].includes(v.connection.gmailTest)) testKey.current=null;
      if (action === "test_email")
        setMessage(
          v.connection.gmailTest === "accepted"
            ? "Google accepted the test message. Confirm it arrived in your Gmail account. Website email is unchanged."
            : v.connection.gmailTest === "failed"
              ? "Google rejected the test. Check configuration before retrying."
              : "Delivery is uncertain. Check Gmail Sent; this test will not be resent automatically.",
        );
      if (action === "calendar") setMessage("Business calendar saved. Open the Calendar tab to review appointments or block time.");
      if (action === "health")
        setMessage(
          view === "calendar" ? "Google connection checked." : "Connection checked. Send the Gmail test below to check email.",
        );
      if(['test_email','calendar','health'].includes(action))await load(false);
    } catch (e) {
      if (gen !== generation.current) return;
      setMessage(
        messages[(e as Error).message] ||
          publicError(e, "Google could not complete this action. Please try again in Settings."),
      );
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  }
  return (
    <section className="card" aria-labelledby={"google-"+view+"-heading"}>
      <p className="eyebrow">{view === "settings" ? "Google connection" : view === "calendar" ? "Business calendar" : "Email connection"}</p>
      <h2 id={"google-"+view+"-heading"}>{view === "settings" ? "Google Calendar & Gmail" : view === "calendar" ? "Choose your business calendar" : "Gmail"}</h2>
      {missing.length > 0 && <p>Google setup needs attention before connecting. Technical configuration is available on the private setup page.</p>}
      {statusLoading && <p role="status">Loading Google connection…</p>}
      {!connection?.connected ? (
        <button
          type="button"
          disabled={busy || statusLoading || missing.length > 0}
          onClick={() => void act("connect")}
        >
          Connect Google
        </button>
      ) : (
        <>
          <p><strong>Google connected</strong> · {connection.email}</p>
          {view !== "email" && <>
            <p>{connection.calendarId ? "Business calendar: " + (calendars.find(c => c.id === connection.calendarId)?.summary || "Saved calendar") : "Choose an existing calendar or create a separate one for your business."}</p>
            <form onSubmit={e => { e.preventDefault(); void act("calendar", { calendarId: calendar }); }}>
              <label>Business calendar
                <select value={calendar} required disabled={busy || calendarsLoading} onChange={e => setCalendar(e.target.value)}>
                  <option value="">{calendarsLoading ? "Loading your calendars…" : "Press to choose a calendar"}</option>
                  {calendars.map(c => <option key={c.id} value={c.id}>{c.summary}{c.timeZone ? " · " + c.timeZone : ""}</option>)}
                </select>
              </label>
              <div className="actions">
                <button disabled={busy || calendarsLoading || !calendar || calendar === connection.calendarId}>Use this calendar</button>
                <button type="button" className="secondary" disabled={busy || calendarsLoading} onClick={() => void loadCalendars()}>Refresh calendars</button>
              </div>
            </form>
            {!calendarsLoading && !calendars.length && <p>No owned calendars are available in this list. Try refreshing or create your business calendar below.</p>}
            {!connection.calendarId && <>
              <h3>Need a separate calendar?</h3>
              <p>Create one named for your business, then choose it above.</p>
              <button type="button" disabled={busy || !connection.canCreateCalendar || (!!creation && creation.status !== "failed")} onClick={() => void act("create_calendar")}>Create business calendar</button>
              {!connection.canCreateCalendar && <p>Calendar creation requires additional Google permission. You can still choose an existing business calendar.</p>}
              {creation && <p role="status">{creation.status === "created" ? "Created: " + creation.summary + ". Choose it above to finish." : ["unknown", "sending"].includes(creation.status) ? "Creation is still being checked. Refresh calendars before trying anything else; another calendar will not be created automatically." : "Google rejected creation. Check permissions before trying again."}</p>}
            </>}
            <p className="note">Keep business appointments separate from personal events. Personal calendars do not block bookings yet. Open Calendar and use Block calendar time to make time unavailable to customers.</p>
            <details><summary>Calendar connection tools</summary>
              <div className="actions">
                <button type="button" disabled={busy} onClick={() => void act("health")}>Check connection</button>
                <button type="button" disabled={busy || !connection.calendarId} onClick={() => void act("sync")}>Sync calendar now</button>
              </div>
              <p>Changes made in Google need owner review before they move or approve a CRM appointment.</p>
            </details>
          </>}
          {view !== "calendar" && <>
          <p>
            The test sends one message to the connected Google account, not to a
            customer. No inbox-reading permission is requested.
          </p>
          <button
            type="button"
            disabled={
              busy || ["sending", "unknown"].includes(connection.gmailTest)
            }
            onClick={() => {
              testKey.current ??= crypto.randomUUID();
              void act("test_email", { key: testKey.current });
            }}
          >
            Send Gmail test to myself
          </button>
          <section aria-labelledby="mail-activation"><h3 id="mail-activation">CRM email delivery</h3><p>Company authorization: {delivery?.enabled?'enabled':'off'}. Background dispatcher: {dispatcherEnabled?'enabled':'paused'}.</p>
          {delivery?.enabled?<><button type="button" disabled={busy} onClick={()=>{deliveryKey.current??=crypto.randomUUID();void act('disable_delivery',{key:deliveryKey.current});}}>Pause CRM email delivery</button><button type="button" disabled={busy||!dispatcherEnabled} onClick={()=>void act('send_pending')}>Process pending CRM notices now</button></>:<><p>Verify the test arrived and that the configured sender matches this Gmail account before authorizing queued customer and owner notices. The website's current request email remains separate.</p><label><input type="checkbox" checked={received} disabled={busy||connection.gmailTest!=='accepted'} onChange={e=>setReceived(e.target.checked)}/>I received the Gmail test and reviewed the company sender.</label><button type="button" disabled={busy||!received||connection.gmailTest!=='accepted'||!delivery?.senderMatches||!delivery.testKey} onClick={()=>{deliveryKey.current??=crypto.randomUUID();void act('enable_delivery',{revision:delivery!.connectionRevision,configurationVersion:delivery!.configurationVersion,testKey:delivery!.testKey,receiptConfirmed:true,key:deliveryKey.current});}}>Authorize CRM email delivery</button></>}
          {!dispatcherEnabled&&<p>The server delivery switch and an approved recurring worker still need setup. Authorizing this company alone will not send messages.</p>}</section>
          </>}
          <details>
            <summary>Disconnect Google</summary>
            <p>
              Stops new CRM Google operations and revokes the stored grant.
              Existing events and your website email remain in place.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("disconnect")}
            >
              Disconnect this account
            </button>
          </details>
        </>
      )}
      <button type="button" disabled={busy} onClick={() => void load()}>
        Refresh status
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
