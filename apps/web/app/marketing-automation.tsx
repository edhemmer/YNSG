'use client';
import {useCallback, useEffect, useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {automationSummary, type AutomationSummary} from '../lib/marketing-automation';
import {JOURNEYS, JOURNEY_LABELS, type Journey} from '../lib/marketing-emails';

const friendly = (e: unknown, fallback: string) => e instanceof Error && e.message && !/^[\[{]/.test(e.message.trim()) && e.message.length < 200 ? e.message : fallback;
const dateTime = (iso: string) => new Date(iso).toLocaleString('en-US', {timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Automated email: customers and prospects each get their own monthly series plus status-based emails
// (welcome, estimate follow-up, check-in, anniversary, second chance). Sends go out in small hourly
// batches at each person's best time, inside the owner's monthly and daily caps.
export default function MarketingAutomation({organization, owner}: {organization: string; owner: boolean}) {
  const [data, setData] = useState<AutomationSummary | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<{journey: Journey; audience: 'customer' | 'prospect'; month: number}>({journey: 'monthly', audience: 'customer', month: new Date().getMonth() + 1});
  const [html, setHtml] = useState(''), [subject, setSubject] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const r = await sessionFetch('/api/marketing-automation?' + new URLSearchParams({organization}), {cache: 'no-store'});
      const d = await r.json(); if (!r.ok) throw Error(d.error);
      setData(automationSummary.parse(d));
    } catch (e) { setError(friendly(e, 'Email automation could not be loaded.')); }
  }, [organization]);
  useEffect(() => { setData(null); load(); }, [load]);
  useEffect(() => {
    let live = true; setHtml('');
    sessionFetch('/api/marketing-automation?' + new URLSearchParams({organization, view: 'preview', journey: preview.journey, audience: preview.audience, month: String(preview.month)}), {cache: 'no-store'})
      .then(async r => { if (!r.ok) throw Error(); const text = await r.text(); if (live) { setHtml(text); setSubject(decodeURIComponent(r.headers.get('X-Subject') || '')); } })
      .catch(() => { if (live) setHtml(''); });
    return () => { live = false; };
  }, [organization, preview]);

  async function save(next: Partial<Pick<AutomationSummary, 'enabled' | 'journeysOff' | 'monthlyCap' | 'dailyCap'>>, message: string) {
    if (!data) return;
    if (next.enabled === true && !confirm('Start sending automated emails? Customers and prospects get their own monthly email plus the status-based emails you have turned on, inside your caps. Anyone can unsubscribe in one click.')) return;
    setBusy(true); setNotice('');
    try {
      const body = {organization, enabled: next.enabled ?? data.enabled, journeysOff: next.journeysOff ?? data.journeysOff, monthlyCap: next.monthlyCap ?? data.monthlyCap, dailyCap: next.dailyCap ?? data.dailyCap};
      const r = await sessionFetch('/api/marketing-automation', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      const d = await r.json(); if (!r.ok) throw Error(d.error);
      setData(automationSummary.parse(d)); setNotice(message);
    } catch (e) { setNotice(friendly(e, 'That change could not be confirmed. Reload before trying again.')); }
    finally { setBusy(false); }
  }

  if (error) return <section className="card marketing-auto"><p className="eyebrow">Email automation</p><p role="alert">{error}</p><button className="secondary" onClick={load}>Try again</button></section>;
  if (!data) return <section className="card marketing-auto" aria-busy="true"><p className="eyebrow">Email automation</p><p>Loading…</p></section>;
  const queued = Object.values(data.queued).reduce((a, b) => a + (b || 0), 0);
  const pct = (n: number, cap: number) => cap ? Math.min(100, Math.round(n / cap * 100)) : 0;
  return <section className="card marketing-auto">
    <p className="eyebrow">Email automation</p>
    <div className="marketing-auto-head">
      <h2>{data.enabled ? 'Automated emails are on' : 'Automated emails are off'}</h2>
      {owner && <button className={data.enabled ? 'secondary' : ''} disabled={busy} onClick={() => save({enabled: !data.enabled}, data.enabled ? 'Paused. Nothing more will send until you turn it back on.' : 'On. The first batch goes out at the next sending hour.')}>{data.enabled ? 'Pause all' : 'Turn on'}</button>}
    </div>
    <p className="note">Customers get the customer series; everyone else (leads, estimates, sign-ups, partners) gets the prospect series. Emails go out in small hourly batches, Monday–Saturday 8am–7pm Central, timed to when each person usually reads email, and never more than one every 3 days.</p>
    <ul className="marketing-counts">
      <li><strong>{data.audiences.customer.toLocaleString()}</strong> Customers</li>
      <li><strong>{data.audiences.prospect.toLocaleString()}</strong> Prospects</li>
      <li><strong>{queued.toLocaleString()}</strong> Waiting to send{data.nextSend ? ' · next ' + dateTime(data.nextSend) : ''}</li>
      <li><strong>{data.last30.sent.toLocaleString()}</strong> Sent in 30 days · {data.last30.sent ? Math.round(data.last30.clicked / data.last30.sent * 100) : 0}% clicked</li>
    </ul>
    <div className="marketing-meters">
      <p>This month <strong>{data.usage.month.toLocaleString()}</strong> of {data.monthlyCap.toLocaleString()}<span className="meter"><span style={{width: pct(data.usage.month, data.monthlyCap) + '%'}}/></span></p>
      <p>Today <strong>{data.usage.today}</strong> of {data.dailyCap}<span className="meter"><span style={{width: pct(data.usage.today, data.dailyCap) + '%'}}/></span></p>
    </div>
    <p className="note">Half of the free email plan (3,000 a month, 100 a day) is kept for request, estimate and invoice emails. Marketing also pauses for the day if all email together nears the daily limit.</p>
    {owner && <details><summary>Limits</summary>
      <label>Monthly limit <select value={data.monthlyCap} disabled={busy} onChange={e => save({monthlyCap: Number(e.target.value)}, 'Monthly limit saved.')}>{[250, 500, 750, 1000, 1500].map(n => <option key={n} value={n}>{n.toLocaleString()}</option>)}</select></label>
      <label>Daily limit <select value={data.dailyCap} disabled={busy} onChange={e => save({dailyCap: Number(e.target.value)}, 'Daily limit saved.')}>{[10, 25, 40, 50, 60].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
    </details>}
    <h3>Emails</h3>
    <ul className="marketing-journeys">
      {JOURNEYS.map(j => { const on = !data.journeysOff.includes(j); return <li key={j}>
        <div><strong>{JOURNEY_LABELS[j].title}</strong><span className="marketing-detail">{JOURNEY_LABELS[j].detail}</span>{data.queued[j] ? <span className="marketing-detail">{data.queued[j]} waiting</span> : null}</div>
        <div className="marketing-journey-actions">
          <button className="secondary" onClick={() => setPreview(p => ({...p, journey: j}))} aria-pressed={preview.journey === j}>Preview</button>
          {owner && <label className="switch"><input type="checkbox" checked={on} disabled={busy} onChange={() => save({journeysOff: on ? [...data.journeysOff, j] : data.journeysOff.filter(x => x !== j)}, JOURNEY_LABELS[j].title + (on ? ' turned off.' : ' turned on.'))}/> {on ? 'On' : 'Off'}</label>}
        </div>
      </li>; })}
    </ul>
    {notice && <p role="status">{notice}</p>}
    <h3>Preview</h3>
    <div className="marketing-preview-controls">
      <label>Email <select value={preview.journey} onChange={e => setPreview(p => ({...p, journey: e.target.value as Journey}))}>{JOURNEYS.map(j => <option key={j} value={j}>{JOURNEY_LABELS[j].title}</option>)}</select></label>
      <label>Version <select value={preview.audience} onChange={e => setPreview(p => ({...p, audience: e.target.value as 'customer' | 'prospect'}))}><option value="customer">Customer</option><option value="prospect">Prospect</option></select></label>
      <label>Month <select value={preview.month} onChange={e => setPreview(p => ({...p, month: Number(e.target.value)}))}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
    </div>
    {subject && <p className="marketing-subject">Subject: <strong>{subject}</strong></p>}
    {html ? <iframe className="marketing-preview" title="Email preview" sandbox="" srcDoc={html}/> : <p aria-busy="true">Loading preview…</p>}
    {data.recent.length > 0 && <details><summary>Recent sends</summary><ul className="marketing-recent">{data.recent.map((r, i) => <li key={i}>
      <span>{r.name || r.email}</span><span className="marketing-detail">{JOURNEY_LABELS[r.journey].title} · {r.audience === 'customer' ? 'Customer' : 'Prospect'}{r.sentAt ? ' · ' + dateTime(r.sentAt) : ''}</span>
      <span className={'marketing-tag ' + (r.status === 'failed' ? 'bad' : r.clicked ? 'good' : '')}>{r.status === 'failed' ? 'Not delivered' : r.clicked ? 'Clicked' : 'Sent'}</span></li>)}</ul></details>}
  </section>;
}
