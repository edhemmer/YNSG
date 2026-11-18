'use client';
import {useMemo, useState, type CSSProperties} from 'react';
import {CATEGORIES, GUIDES, PLUMBING_LAW_URL, PLUMBING_SCOPE_NOTE, searchGuides, type CategoryId, type Guide} from '../lib/home-repair-guides';
import RepairDiagram from './repair-diagrams';

const SCOPE: Record<Guide['scope'], {label: string; tone: string}> = {
  ok: {label: 'YNSG can do', tone: 'good'},
  'minor-plumbing': {label: 'Minor repair only', tone: 'warn'},
  refer: {label: 'Refer out', tone: 'bad'},
};
const Icon = ({d, color, size = 20}: {d: string; color: string; size?: number}) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d}/></svg>;
const SUGGESTIONS = ['door sticking', 'door won\'t latch', 'running toilet', 'dripping faucet', 'drawer slide', 'cabinet door', 'grout', 'threshold', 'outdoor faucet', 'grab bar'];

// The home repair field guide: search in plain words, browse by color-coded area, then follow a
// guide with a quick check, a drawing, numbered steps, trade tricks and a clear stop-and-refer line.
export default function RepairGuideLibrary({onRefer}: {onRefer?: (task: string) => void}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | ''>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const results = useMemo(() => searchGuides(query, category), [query, category]);
  const guide = GUIDES.find(g => g.id === openId) || null;
  const counts = useMemo(() => Object.fromEntries((Object.keys(CATEGORIES) as CategoryId[]).map(c => [c, GUIDES.filter(g => g.category === c).length])), []);

  if (guide) {
    const cat = CATEGORIES[guide.category], style = {'--cat': cat.color} as CSSProperties;
    const stepsDone = guide.steps.filter((_, i) => done[guide.id + i]).length;
    return <article className="repair-guide" style={style} aria-label={guide.title}>
      <button type="button" className="secondary repair-back" onClick={() => setOpenId(null)}>← All repair guides</button>
      <header className="repair-head">
        <span className="repair-head-icon"><Icon d={cat.icon} color="#fff" size={26}/></span>
        <div><p className="repair-eyebrow">{cat.label}</p><h3>{guide.title}</h3>
          <div className="repair-badges"><span>{guide.level}</span><span>⏱ {guide.time}</span><span className={'repair-scope ' + SCOPE[guide.scope].tone}>{SCOPE[guide.scope].label}</span></div></div>
      </header>
      <p className="repair-symptom"><strong>Sounds like this?</strong> {guide.symptoms}</p>
      {guide.scope === 'minor-plumbing' && <div className="repair-callout warn" role="note"><strong>Know the line</strong><p>{PLUMBING_SCOPE_NOTE}</p><a href={PLUMBING_LAW_URL} target="_blank" rel="noopener noreferrer">Illinois Plumbing License Law ↗</a></div>}
      <section className="repair-block"><h4>1 · Quick check first</h4><ul className="repair-checks">{guide.quickCheck.map(c => <li key={c}>{c}</li>)}</ul></section>
      {guide.diagram && <RepairDiagram id={guide.diagram} color={cat.color}/>}
      <section className="repair-block"><h4>2 · Step by step <span className="repair-progress">{stepsDone}/{guide.steps.length} done</span></h4>
        <ol className="repair-steps">{guide.steps.map((s, i) => {const key = guide.id + i; return <li key={s.title} className={done[key] ? 'done' : ''}>
          <button type="button" className="repair-step-num" aria-pressed={!!done[key]} aria-label={'Mark step ' + (i + 1) + ' done'} onClick={() => setDone(d => ({...d, [key]: !d[key]}))}>{done[key] ? '✓' : i + 1}</button>
          <div><strong>{s.title}</strong><p>{s.detail}</p></div></li>;})}</ol></section>
      <section className="repair-callout tip"><h4>★ Trade tricks</h4><ul>{guide.tricks.map(t => <li key={t}>{t}</li>)}</ul></section>
      <div className="repair-kit"><section><h4>Tools</h4><ul>{guide.tools.map(t => <li key={t}>{t}</li>)}</ul></section><section><h4>Parts & materials</h4><ul>{guide.parts.map(t => <li key={t}>{t}</li>)}</ul></section></div>
      <section className="repair-callout stop" role="note"><h4>Stop and refer when</h4><p>{guide.stop}</p>{onRefer && <button type="button" className="secondary" onClick={() => onRefer(guide.title)}>Find a referral</button>}</section>
      <p className="repair-source">{guide.source ? <a href={guide.source.url} target="_blank" rel="noopener noreferrer">Reference: {guide.source.name} ↗</a> : 'YNSG field notes.'} Training reference, not a certified procedure — follow the product's own instructions, and these notes never expand YNSG's approved services.</p>
    </article>;
  }

  return <section className="repair-library" aria-label="Home repair field guide">
    <div className="repair-hero"><h3>Home repair field guide</h3><p>The little things people live with — doors, locks, cabinets, drawers, faucets, toilets, trim, thresholds, grout. Find the fix, the drawing, the steps and the trade tricks.</p></div>
    <label className="repair-search">What needs fixing?<input type="search" value={query} maxLength={80} placeholder="Try: door sticking, running toilet, drawer slide" onChange={e => setQuery(e.target.value)}/></label>
    {!query && <div className="repair-suggest" aria-label="Common searches">{SUGGESTIONS.map(s => <button type="button" key={s} className="repair-chip plain" onClick={() => setQuery(s)}>{s}</button>)}</div>}
    <div className="repair-cats" role="group" aria-label="Browse by area">
      <button type="button" className={'repair-chip' + (category === '' ? ' on' : '')} aria-pressed={category === ''} onClick={() => setCategory('')}>All · {GUIDES.length}</button>
      {(Object.keys(CATEGORIES) as CategoryId[]).filter(c => counts[c]).map(c => <button type="button" key={c} className={'repair-chip' + (category === c ? ' on' : '')} aria-pressed={category === c} style={{'--cat': CATEGORIES[c].color} as CSSProperties} onClick={() => setCategory(v => v === c ? '' : c)}><Icon d={CATEGORIES[c].icon} color={CATEGORIES[c].color} size={16}/>{CATEGORIES[c].label} · {counts[c]}</button>)}
    </div>
    {results.length === 0 ? <p role="status" className="repair-empty">No guide for that yet. Try a simpler word (like "door", "drawer" or "faucet"), or use the Service Rolodex for work outside our scope.</p>
      : <ul className="repair-results">{results.map(g => {const cat = CATEGORIES[g.category]; return <li key={g.id}><button type="button" className="repair-card" style={{'--cat': cat.color} as CSSProperties} onClick={() => setOpenId(g.id)}>
        <span className="repair-card-icon"><Icon d={cat.icon} color={cat.color}/></span>
        <span className="repair-card-body"><strong>{g.title}</strong><span>{g.symptoms}</span><span className="repair-badges small"><span>{g.level}</span><span>⏱ {g.time}</span><span className={'repair-scope ' + SCOPE[g.scope].tone}>{SCOPE[g.scope].label}</span></span></span>
        <span aria-hidden="true" className="repair-card-go">›</span></button></li>;})}</ul>}
  </section>;
}
