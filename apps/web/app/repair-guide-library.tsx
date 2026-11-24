'use client';
import {useMemo, useState, type CSSProperties} from 'react';
import {CATEGORIES, GUIDES, JULIE_NOTE, JULIE_URL, PLUMBING_LAW_URL, PLUMBING_SCOPE_NOTE, guideForChip, searchGuides, type CategoryId, type Guide} from '../lib/home-repair-guides';
import RepairDiagram from './repair-diagrams';
import {COACH, GLOSSARY} from '../lib/home-repair-coach';

const SCOPE: Record<Guide['scope'], {label: string; tone: string}> = {
  ok: {label: 'YNSG can do', tone: 'good'},
  'minor-plumbing': {label: 'Minor repair only', tone: 'warn'},
  refer: {label: 'Refer out', tone: 'bad'},
};
const Icon = ({d, color, size = 20}: {d: string; color: string; size?: number}) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d}/></svg>;
const LEVEL: Record<Guide['level'], number> = {Easy: 1, Moderate: 2, Skilled: 3};
const Meter = ({level}: {level: Guide['level']}) => <span className="repair-meter" role="img" aria-label={'Difficulty: ' + level}>{[1, 2, 3].map(n => <i key={n} className={n <= LEVEL[level] ? 'on' : ''}/>)}<b>{level}</b></span>;
const SUGGESTIONS = ['hole in wall', 'door sticking', 'running toilet', 'clogged toilet', 'install washer', 'dryer vent', 'drawer slide', 'hang pictures', 'mount tv', 'caulk window', 'mulch', 'prune shrubs', 'garage door', 'grab bar', 'ice melt'];

// Plain-text job sheet: what to bring and the steps, ready to paste into a text, note or task.
export function jobSheet(g: Guide): string {
  return [
    g.title, `Level: ${g.level} · Time: ${g.time} · ${SCOPE[g.scope].label}`, '',
    'BRING', ...g.tools.map(t => '☐ ' + t), ...g.parts.filter(p => p !== '—').map(p => '☐ ' + p), '',
    'QUICK CHECK', ...g.quickCheck.map(c => '• ' + c), '',
    'STEPS', ...g.steps.map((x, i) => `${i + 1}. ${x.title}: ${x.detail}`), '',
    'STOP AND REFER', g.stop,
  ].join('\n');
}

// The home repair field guide: search in plain words, browse by color-coded area, then follow a
// guide with a quick check, a drawing, numbered steps, trade tricks and a clear stop-and-refer line.
export default function RepairGuideLibrary({onRefer}: {onRefer?: (task: string) => void}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | ''>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const open = (id: string) => {setOpenId(id); setCopied(false); if (typeof window !== 'undefined') window.scrollTo?.({top: 0});};
  const results = useMemo(() => searchGuides(query, category), [query, category]);
  const guide = GUIDES.find(g => g.id === openId) || null;
  const counts = useMemo(() => Object.fromEntries((Object.keys(CATEGORIES) as CategoryId[]).map(c => [c, GUIDES.filter(g => g.category === c).length])), []);

  if (guide) {
    const cat = CATEGORIES[guide.category], style = {'--cat': cat.color} as CSSProperties;
    const coach = COACH[guide.id];
    const text = [guide.title, guide.symptoms, ...guide.quickCheck, ...guide.tools, ...guide.parts, ...guide.steps.map(x => x.title + ' ' + x.detail), ...guide.tricks].join(' ').toLowerCase();
    const words = GLOSSARY.filter(w => text.includes(w.term));
    const pack = [...guide.tools, ...guide.parts.filter(x => x !== '—')];
    const related = GUIDES.filter(g => g.category === guide.category && g.id !== guide.id).slice(0, 4);
    const copy = async () => {try {await navigator.clipboard.writeText(jobSheet(guide)); setCopied(true);} catch {setCopied(false);}};
    return <article className="repair-guide" style={style} aria-label={guide.title}>
      <button type="button" className="secondary repair-back" onClick={() => setOpenId(null)}>← All repair guides</button>
      <header className="repair-head">
        <span className="repair-head-icon"><Icon d={cat.icon} color="#fff" size={26}/></span>
        <div><p className="repair-eyebrow">{cat.label}</p><h3>{guide.title}</h3>
          <div className="repair-badges"><Meter level={guide.level}/><span>⏱ {guide.time}</span><span className={'repair-scope ' + SCOPE[guide.scope].tone}>{SCOPE[guide.scope].label}</span></div></div>
      </header>
      <div className="repair-actions"><button type="button" className="secondary" onClick={copy}>{copied ? '✓ Job sheet copied' : '⧉ Copy job sheet'}</button><button type="button" className="secondary" onClick={() => window.print()}>⎙ Print</button></div>
      <p className="repair-symptom"><strong>Sounds like this?</strong> {guide.symptoms}</p>
      {guide.scope === 'minor-plumbing' && <div className="repair-callout warn" role="note"><strong>Know the line</strong><p>{PLUMBING_SCOPE_NOTE}</p><a href={PLUMBING_LAW_URL} target="_blank" rel="noopener noreferrer">Illinois Plumbing License Law ↗</a></div>}
      {guide.dig && <div className="repair-callout warn" role="note"><strong>Before you dig</strong><p>{JULIE_NOTE}</p><a href={JULIE_URL} target="_blank" rel="noopener noreferrer">JULIE (Illinois 811) ↗</a></div>}
      <section className="repair-callout before" aria-label="Before you start"><h4>🧰 Before you start</h4>
        {coach?.before?.length ? <ul>{coach.before.map(t => <li key={t}>{t}</li>)}</ul> : null}
        <p className="repair-packhead">Bring</p>
        <ul className="repair-bring">{pack.map((t, i) => <li key={t + i}>{t}</li>)}</ul></section>
      <section className="repair-block"><h4>1 · Quick check first</h4><ul className="repair-checks">{guide.quickCheck.map(c => <li key={c}>{c}</li>)}</ul></section>
      {guide.diagram && <RepairDiagram id={guide.diagram} color={cat.color}/>}
      <section className="repair-block"><h4>2 · Step by step</h4>
        <ol className="repair-steps">{guide.steps.map((s, i) => <li key={s.title}>
          <span className="repair-step-num" aria-hidden="true">{i + 1}</span>
          <div><strong>{s.title}</strong>{coach?.steps?.[i]?.careful && <span className="repair-slow">Go slowly</span>}<p>{s.detail}</p>
            {coach?.steps?.[i]?.see && <p className="repair-note see"><b>✓ You should see</b> {coach.steps[i]!.see}</p>}
            {coach?.steps?.[i]?.help && <p className="repair-note help"><b>💡 Hand-holding</b> {coach.steps[i]!.help}</p>}
            {coach?.steps?.[i]?.avoid && <p className="repair-note avoid"><b>✕ Avoid</b> {coach.steps[i]!.avoid}</p>}</div></li>)}</ol></section>
      {coach?.mistakes?.length ? <section className="repair-callout mistakes"><h4>⚠ Common mistakes</h4><ul>{coach.mistakes.map(t => <li key={t}>{t}</li>)}</ul></section> : null}
      {guide.bestPractices?.length ? <section className="repair-callout best"><h4>✔ Best practices</h4><ul>{guide.bestPractices.map(t => <li key={t}>{t}</li>)}</ul></section> : null}
      <section className="repair-callout tip"><h4>★ Trade tricks</h4><ul>{guide.tricks.map(t => <li key={t}>{t}</li>)}</ul></section>
      {words.length > 0 && <details className="repair-glossary"><summary>📖 Plain words ({words.length})</summary><dl>{words.map(w => <div key={w.term}><dt>{w.term}</dt><dd>{w.means}</dd></div>)}</dl></details>}
      <div className="repair-kit"><section><h4>Tools</h4><ul>{guide.tools.map(t => <li key={t}>{t}</li>)}</ul></section><section><h4>Parts & materials</h4><ul>{guide.parts.map(t => <li key={t}>{t}</li>)}</ul></section></div>
      <section className="repair-callout stop" role="note"><h4>Stop and refer when</h4><p>{guide.stop}</p>{onRefer && <button type="button" className="secondary" onClick={() => onRefer(guide.title)}>Find a referral</button>}</section>
      {related.length > 0 && <nav className="repair-related" aria-label="Related guides"><h4>More {cat.label.toLowerCase()} guides</h4><ul>{related.map(r => <li key={r.id}><button type="button" className="repair-chip plain" onClick={() => open(r.id)}>{r.title}</button></li>)}</ul></nav>}
      <p className="repair-source">{guide.source ? <a href={guide.source.url} target="_blank" rel="noopener noreferrer">Reference: {guide.source.name} ↗</a> : 'YNSG field notes.'} Training reference, not a certified procedure — follow the product's own instructions, and these notes never expand YNSG's approved services.</p>
    </article>;
  }

  return <section className="repair-library" aria-label="Home repair field guide">
    <div className="repair-hero"><h3>Home repair field guide</h3><p>Home, yard and appliance jobs, from drywall holes and running toilets to washers, TV mounts, mulch and snow. Every guide has a quick check, numbered steps, best practices, trade tricks, a pack list and when to refer. Copy the job sheet to take it with you.</p></div>
    <label className="repair-search">What needs fixing?<input type="search" value={query} maxLength={80} placeholder="Try: hole in wall, running toilet, install dryer" onChange={e => setQuery(e.target.value)}/></label>
    {!query && <div className="repair-suggest" aria-label="Common searches">{SUGGESTIONS.map(s => <button type="button" key={s} className="repair-chip plain" onClick={() => {const g = guideForChip(s); if (g) open(g.id); else setQuery(s);}}>{s}</button>)}</div>}
    <div className="repair-cats" role="group" aria-label="Browse by area">
      <button type="button" className={'repair-chip' + (category === '' ? ' on' : '')} aria-pressed={category === ''} onClick={() => setCategory('')}>All · {GUIDES.length}</button>
      {(Object.keys(CATEGORIES) as CategoryId[]).filter(c => counts[c]).map(c => <button type="button" key={c} className={'repair-chip' + (category === c ? ' on' : '')} aria-pressed={category === c} style={{'--cat': CATEGORIES[c].color} as CSSProperties} onClick={() => setCategory(v => v === c ? '' : c)}><Icon d={CATEGORIES[c].icon} color={CATEGORIES[c].color} size={16}/>{CATEGORIES[c].label} · {counts[c]}</button>)}
    </div>
    {results.length === 0 ? <p role="status" className="repair-empty">No guide for that yet. Try a simpler word (like "door", "drawer" or "faucet"), or use the Service Rolodex for work outside our scope.</p>
      : <ul className="repair-results">{results.map(g => {const cat = CATEGORIES[g.category]; return <li key={g.id}><button type="button" className="repair-card" style={{'--cat': cat.color} as CSSProperties} onClick={() => open(g.id)}>
        <span className="repair-card-icon"><Icon d={cat.icon} color={cat.color}/></span>
        <span className="repair-card-body"><strong>{g.title}</strong><span>{g.symptoms}</span><span className="repair-badges small"><Meter level={g.level}/><span>⏱ {g.time}</span><span className={'repair-scope ' + SCOPE[g.scope].tone}>{SCOPE[g.scope].label}</span></span></span>
        <span aria-hidden="true" className="repair-card-go">›</span></button></li>;})}</ul>}
  </section>;
}
