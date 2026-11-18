'use client';
import {useEffect, useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {emailHistory, SERVICE_EMAIL_LABELS, type EmailHistory} from '../lib/customer-email-history-contract';
import {JOURNEY_LABELS} from '../lib/marketing-emails';

const STATE: Record<EmailHistory['items'][number]['state'], {label: string; tone: string}> = {
  sent: {label: 'Sent', tone: 'good'},
  queued: {label: 'Waiting to send', tone: ''},
  not_sent: {label: 'Not sent', tone: ''},
  not_delivered: {label: 'Not delivered', tone: 'bad'},
};
const SHOWN = 8;

// Every email this customer has received from us, newest first: service emails tied to their own
// requests, appointments and invoices, plus marketing series emails to their saved addresses.
// Owners and admins only; read-only; message bodies are never shown here.
export default function CustomerEmailHistory({organization, customer, timezone}: {organization: string; customer: string; timezone: string}) {
  const [data, setData] = useState<EmailHistory | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    sessionFetch('/api/customer-email-history?' + new URLSearchParams({organization, customer}), {cache: 'no-store'})
      .then(async r => { if (!r.ok) throw Error(); const d = emailHistory.parse(await r.json()); if (live) { setData(d); setFailed(false); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [organization, customer, retry]);
  const when = (iso: string) => new Intl.DateTimeFormat('en-US', {timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'}).format(new Date(iso));
  const items = data ? (all ? data.items : data.items.slice(0, SHOWN)) : [];
  return <section className="card customer-emails" aria-label="Emails to this customer">
    <div className="customer-heading"><h3>Emails to this customer</h3>{data && <span className="marketing-detail">{data.total === 1 ? '1 email' : data.total + ' emails'}</span>}</div>
    {failed && !data && <p className="note" role="alert">Email history could not be loaded. <button className="secondary" onClick={() => setRetry(v => v + 1)}>Try again</button></p>}
    {!failed && !data && <p role="status" className="marketing-detail">Loading emails…</p>}
    {data && data.items.length === 0 && <p className="marketing-detail">No emails yet. Request receipts, appointment notices, invoices and marketing emails will show here once they go out.</p>}
    {data && data.items.length > 0 && <ul className="marketing-recent">{items.map((m, i) => {
      const title = m.channel === 'marketing' ? (JOURNEY_LABELS[m.kind as keyof typeof JOURNEY_LABELS]?.title || 'Marketing email') : (SERVICE_EMAIL_LABELS[m.kind] || 'Service email');
      return <li key={m.channel + m.kind + m.at + i}>
        <span>{title}<span className="marketing-detail">{m.channel === 'marketing' ? 'Marketing series' : 'Service email'} · <time dateTime={m.at}>{when(m.at)}</time>{m.clickedAt ? ' · Clicked ' + when(m.clickedAt) : ''}</span></span>
        <span className={'marketing-tag ' + STATE[m.state].tone}>{STATE[m.state].label}</span>
      </li>;
    })}</ul>}
    {data && data.items.length > SHOWN && <button className="secondary" onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : 'Show all ' + data.items.length}</button>}
    {data && data.total > data.items.length && <p className="marketing-detail">Showing the newest {data.items.length} of {data.total}.</p>}
  </section>;
}
