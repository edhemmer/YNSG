'use client';
import {useEffect, useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {customerMarketingStatus, STAGE_LABEL} from '../lib/marketing-automation';
import {JOURNEY_LABELS} from '../lib/marketing-emails';
import type {z} from 'zod';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', {timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric'});
// Marketing email status on the customer record: the same list entry the Marketing screen uses.
// Owners and admins only; other roles simply don't see the card.
export default function CustomerMarketingStatus({organization, customer}: {organization: string; customer: string}) {
  const [rows, setRows] = useState<z.infer<typeof customerMarketingStatus> | null>(null);
  useEffect(() => {
    let live = true;
    sessionFetch('/api/marketing-automation?' + new URLSearchParams({organization, view: 'customer', customer}), {cache: 'no-store'})
      .then(async r => { if (!r.ok) throw Error(); const d = customerMarketingStatus.parse(await r.json()); if (live) setRows(d); })
      .catch(() => { if (live) setRows(null); });
    return () => { live = false; };
  }, [organization, customer]);
  if (!rows) return null;
  return <section className="card customer-marketing">
    <p className="eyebrow">Marketing email</p>
    {rows.length === 0 ? <p className="marketing-detail">Not on the email list. Customers added before November 17, 2026 join only if they sign up themselves.</p>
      : <ul className="marketing-recent">{rows.map(r => <li key={r.email}>
        <span>{r.email}<span className="marketing-detail">{STAGE_LABEL[r.stage]} · {r.stage === 'customer' ? 'customer series' : 'prospect series'}</span></span>
        <span className="marketing-detail">{r.subscribed ? <>
          {r.last ? 'Last: ' + JOURNEY_LABELS[r.last.journey].title + ', ' + day(r.last.sentAt) : 'Nothing sent yet'}
          {r.next ? ' · Next: ' + JOURNEY_LABELS[r.next.journey].title + ', ' + day(r.next.at) : ''}
          {r.lastClickedAt ? ' · Clicked ' + day(r.lastClickedAt) : ''}</> : 'Unsubscribed' + (r.unsubscribedAt ? ' ' + day(r.unsubscribedAt) : '') + '. No marketing email will be sent.'}</span>
        <span className={'marketing-tag ' + (r.subscribed ? 'good' : 'bad')}>{r.subscribed ? 'Subscribed' : 'Opted out'}</span>
      </li>)}</ul>}
  </section>;
}
