'use client';
import {useCallback, useEffect, useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {marketingSummary, campaignEntries, campaignDraw, BASIS_LABEL, type MarketingSummary, type CampaignEntries} from '../lib/marketing-list';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
const label = (campaign: string) => campaign.replace(/-/g, ' ').replace(/\b(\w)/g, c => c.toUpperCase()).replace(/(\d{4}) (\d{2})$/, '$1-$2');

// Owner marketing list: who is on it, a CSV for email tools, the CRM feed switch and giveaway drawings.
export default function MarketingList({organization, owner}: {organization: string; owner: boolean}) {
  const [summary, setSummary] = useState<MarketingSummary | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const r = await sessionFetch('/api/marketing-list?' + new URLSearchParams({organization, view: 'summary'}), {cache: 'no-store'});
      const d = await r.json(); if (!r.ok) throw Error(d.error);
      setSummary(marketingSummary.parse(d));
    } catch (e) { setError(e instanceof Error && e.message ? e.message : 'The marketing list could not be loaded.'); }
  }, [organization]);
  useEffect(() => { setSummary(null); load(); }, [load]);

  async function feed(enabled: boolean) {
    if (enabled && !confirm('Start adding new website leads and clients to the email list? Only people who contact you from now on are added, and anyone can unsubscribe.')) return;
    setBusy(true); setNotice('');
    try {
      const r = await sessionFetch('/api/marketing-list', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'crmFeed', organization, enabled})});
      const d = await r.json(); if (!r.ok) throw Error(d.error);
      setNotice(enabled ? 'New leads and clients will now be added automatically.' : 'Automatic adding is off. Existing contacts stay on the list.');
      await load();
    } catch (e) { setNotice(e instanceof Error && e.message ? e.message : 'That change could not be confirmed. Reload before trying again.'); }
    finally { setBusy(false); }
  }

  if (error) return <section className="card marketing-list"><p className="eyebrow">Email list</p><p role="alert">{error}</p><button className="secondary" onClick={load}>Try again</button></section>;
  if (!summary) return <section className="card marketing-list" aria-busy="true"><p className="eyebrow">Email list</p><p>Loading…</p></section>;
  const exportUrl = '/api/marketing-list?' + new URLSearchParams({organization, view: 'export'});
  return <>
    <section className="card marketing-list">
      <p className="eyebrow">Email list</p>
      <h2>{summary.subscribed.toLocaleString()} {summary.subscribed === 1 ? 'person' : 'people'} you can email</h2>
      <ul className="marketing-counts">
        {(['opt_in', 'customer', 'lead'] as const).map(k => <li key={k}><strong>{(summary.byBasis[k] || 0).toLocaleString()}</strong> {BASIS_LABEL[k]}</li>)}
        <li><strong>{summary.optedOut.toLocaleString()}</strong> Opted out (never emailed)</li>
      </ul>
      <p><a className="button" href={exportUrl} download>Download email list (CSV)</a></p>
      <p className="note">Import this file into your email tool (MailerLite, Mailchimp, Brevo and others accept it). It only includes people who haven’t opted out, and each row has the person’s one-click unsubscribe link. Download a fresh copy before every send.</p>
      <h3>Website leads and clients</h3>
      {summary.crmFeedStartsAt
        ? <p>Adding new leads and clients automatically since {when(summary.crmFeedStartsAt)}.{owner && <> <button className="secondary" disabled={busy} onClick={() => feed(false)}>Turn off</button></>}</p>
        : <p>Not adding leads and clients yet.{owner && <> <button disabled={busy} onClick={() => feed(true)}>Start adding them</button></>}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
    {summary.campaigns.length > 0 && <CampaignPanel key={summary.campaigns[0].campaign} organization={organization} campaigns={summary.campaigns.map(c => c.campaign)} onChange={load}/>}
  </>;
}

function CampaignPanel({organization, campaigns, onChange}: {organization: string; campaigns: string[]; onChange: () => void}) {
  const [campaign, setCampaign] = useState(campaigns[0]), [data, setData] = useState<CampaignEntries | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [result, setResult] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const r = await sessionFetch('/api/marketing-list?' + new URLSearchParams({organization, view: 'entries', campaign}), {cache: 'no-store'});
      const d = await r.json(); if (!r.ok) throw Error(d.error);
      setData(campaignEntries.parse(d));
    } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Entries could not be loaded.'); }
  }, [organization, campaign]);
  useEffect(() => { setData(null); setResult(''); load(); }, [load]);

  async function draw() {
    const again = (data?.draws.length || 0) > 0;
    if (!confirm(again ? 'Draw an alternate winner? Earlier winners stay recorded and won’t be picked again.' : 'Draw the winner now? This picks one entry at random and is recorded.')) return;
    setBusy(true); setResult('');
    try {
      const r = await sessionFetch('/api/marketing-list', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'draw', organization, campaign})});
      const d = await r.json(); if (!r.ok) throw Error(d.error);
      const drawn = campaignDraw.parse(d);
      await load(); onChange();
      setResult('Drawn at random from ' + drawn.eligible + ' eligible ' + (drawn.eligible === 1 ? 'entry' : 'entries') + '. Contact the winner below.');
    } catch (e) { setResult(e instanceof Error && e.message ? e.message : 'The drawing could not be confirmed. Reload before drawing again.'); }
    finally { setBusy(false); }
  }

  const byId = new Map((data?.entries || []).map(e => [e.id, e]));
  return <section className="card marketing-campaign">
    <p className="eyebrow">Giveaways</p>
    <h2>{label(campaign)}</h2>
    {campaigns.length > 1 && <label>Giveaway <select value={campaign} onChange={e => setCampaign(e.target.value)}>{campaigns.map(c => <option key={c} value={c}>{label(c)}</option>)}</select></label>}
    {error && <p role="alert">{error} <button className="secondary" onClick={load}>Try again</button></p>}
    {!data && !error && <p aria-busy="true">Loading entries…</p>}
    {data && <>
      <p><strong>{data.entries.length}</strong> {data.entries.length === 1 ? 'entry' : 'entries'}</p>
      {data.draws.map(d => { const e = byId.get(d.entryId); return <div key={d.round} className="marketing-winner"><p className="eyebrow">{d.round === 1 ? 'Winner' : 'Alternate ' + (d.round - 1)} · drawn {when(d.drawnAt)} from {d.eligible}</p>
        <p><strong>{d.name}</strong>{d.nominee && <> nominated <strong>{d.nominee}</strong></>}</p>
        {e && <p>{e.workAddress}<br/><a href={'mailto:' + e.email}>{e.email}</a>{e.phone && <> · <a href={'tel:' + e.phone.replace(/[^+0-9]/g, '')}>{e.phone}</a></>}</p>}</div>; })}
      <p><button disabled={busy || data.entries.length === data.draws.length} onClick={draw}>{data.draws.length ? 'Draw an alternate' : 'Draw winner'}</button></p>
      {result && <p role="status">{result}</p>}
      {data.entries.length > 0 && <details><summary>See all entries</summary><ul className="marketing-entries">{data.entries.map(e => <li key={e.id}>
        <p><strong>{e.name}</strong>{e.type === 'nominate' && e.nominee ? <> nominated <strong>{e.nominee}</strong>{e.relationship ? ' (' + e.relationship + ')' : ''}</> : ' (own home)'} · {when(e.createdAt)}</p>
        <p>{e.helpWith} · {e.workAddress}</p><p className="note">{e.story}</p></li>)}</ul></details>}
    </>}
  </section>;
}
