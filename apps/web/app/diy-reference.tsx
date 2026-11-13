'use client';
import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {diyDisclaimer,diyGuides,diyReviewedOn,gateLabels,type DiyGuide} from '../lib/diy-reference';
import {areasFor,azLetters,diyIndex,guidesIn,guidesStartingWith,suggestDiy,topicsIn} from '../lib/diy-index';
import DiyDiagram from './diy-diagrams';
type Mode='room'|'trade'|'az';
const RECENT_KEY='ynsg-field-guide-recent';
const byId=new Map(diyGuides.map(g=>[g.id,g]));
const readRecent=():string[]=>{try{const v=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]');return Array.isArray(v)?v.filter((x:unknown)=>typeof x==='string'&&byId.has(x)).slice(0,6):[];}catch{return [];}};
const writeRecent=(l:string[])=>{try{localStorage.setItem(RECENT_KEY,JSON.stringify(l));}catch{}};
function Row({g,id,active,onPick}:{g:DiyGuide;id?:string;active?:boolean;onPick:(g:DiyGuide)=>void}){
 const e=diyIndex[g.id];
 return <li role="option" id={id} aria-selected={!!active} className={'diy-row'+(active?' active':'')} onMouseDown={ev=>ev.preventDefault()} onClick={()=>onPick(g)}>
  <span className="diy-row-main"><strong>{g.title}</strong><span className="tiny">{e?e.topic+' · ':''}{g.category} · {g.time}</span></span><span className={'diy-gate diy-'+g.gate}>{gateLabels[g.gate]}</span></li>;
}
function Checklist({items,label,ordered,storeKey}:{items:string[];label:string;ordered?:boolean;storeKey:string}){
 const [done,setDone]=useState<Record<number,boolean>>({});
 useEffect(()=>{setDone({});},[storeKey]);
 const n=Object.values(done).filter(Boolean).length,Tag=ordered?'ol':'ul';
 return <div className="diy-check"><h4>{label}{ordered&&<span className="tiny diy-progress"> · {n} of {items.length} done</span>}</h4>
  <Tag>{items.map((t,i)=><li key={i}><label className={done[i]?'done':''}><input type="checkbox" checked={!!done[i]} onChange={()=>setDone(d=>({...d,[i]:!d[i]}))}/><span>{t}</span></label></li>)}</Tag></div>;
}
function Detail({g,onBack,crumb,siblings,onPick}:{g:DiyGuide;onBack:()=>void;crumb:string;siblings:DiyGuide[];onPick:(g:DiyGuide)=>void}){
 const [copied,setCopied]=useState(false),idx=siblings.findIndex(x=>x.id===g.id),prev=idx>0?siblings[idx-1]:null,next=idx>=0&&idx<siblings.length-1?siblings[idx+1]:null,ref=useRef<HTMLElement>(null);
 useEffect(()=>{ref.current?.scrollIntoView?.({block:'start',behavior:'smooth'});},[g.id]);
 const copy=async()=>{const text=[g.title,'',g.summary,'','Tools: '+g.tools.join('; '),...(g.materials.length?['Materials: '+g.materials.join('; ')]:[]),'','Steps:',...g.steps.map((s,i)=>(i+1)+'. '+s),'','Stop and refer if:',...g.stop.map(s=>'- '+s)].join('\n');try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{}};
 return <article className="diy-detail" ref={ref} aria-label={g.title}>
  <button type="button" className="diy-back" onClick={onBack}>← {crumb||'Back to the guide'}</button>
  <h3>{g.title}</h3><p className="diy-summary">{g.summary}</p>
  <dl className="diy-glance"><div><dt>Time</dt><dd>{g.time}</dd></div><div><dt>Level</dt><dd>{g.level}</dd></div><div><dt>Fit</dt><dd><span className={'diy-gate diy-'+g.gate}>{gateLabels[g.gate]}</span></dd></div></dl>
  {g.gate==='licensed'&&<p className="help-tip"><strong>Licensed trade.</strong> Use this to understand, shut things off safely and explain the job. Paid work of this kind needs a licensed professional and often a permit.</p>}
  {g.gate==='know-how'&&<p className="help-tip"><strong>Know-how only.</strong> Not part of our offered services. Use it to advise or refer.</p>}
  {g.diagram&&<DiyDiagram kind={g.diagram}/>}
  <Checklist label="Tools" items={g.tools} storeKey={g.id+'t'}/>
  {g.materials.length>0&&<Checklist label="Materials" items={g.materials} storeKey={g.id+'m'}/>}
  <Checklist label="Steps" items={g.steps} ordered storeKey={g.id+'s'}/>
  {g.mistakes.length>0&&<><h4>Common mistakes</h4><ul>{g.mistakes.map((t,i)=><li key={i}>{t}</li>)}</ul></>}
  <div className="diy-stopbox"><h4>Stop and refer if</h4><ul className="diy-stop">{g.stop.map((t,i)=><li key={i}>{t}</li>)}</ul></div>
  {g.source&&<p className="tiny">Source: <a href={g.source.url} target="_blank" rel="noopener noreferrer">{g.source.name}</a></p>}
  <p className="tiny">{diyDisclaimer}</p>
  <div className="diy-actions"><button type="button" className="secondary" onClick={copy}>{copied?'Copied':'Copy steps'}</button>{prev&&<button type="button" className="secondary" onClick={()=>onPick(prev)}>← {prev.title}</button>}{next&&<button type="button" className="secondary" onClick={()=>onPick(next)}>{next.title} →</button>}</div>
 </article>;
}
export default function DiyReference(){
 const uid=useId(),[query,setQuery]=useState(''),[mode,setMode]=useState<Mode>('room'),[area,setArea]=useState<string|null>(null),[topic,setTopic]=useState<string|null>(null),[letter,setLetter]=useState<string|null>(null),[openId,setOpenId]=useState<string|null>(null),[active,setActive]=useState(0),[recent,setRecent]=useState<string[]>([]);
 useEffect(()=>{setRecent(readRecent());},[]);
 const results=useMemo(()=>suggestDiy(query),[query]),searching=query.trim().length>0;
 const open=openId?byId.get(openId)||null:null;
 const pick=(g:DiyGuide)=>{setOpenId(g.id);const r=[g.id,...recent.filter(x=>x!==g.id)].slice(0,6);setRecent(r);writeRecent(r);};
 const close=()=>setOpenId(null);
 const crumb=searching?'Search results':mode==='az'?(letter?'Letter '+letter:'A to Z'):[area,topic].filter(Boolean).join(' › ');
 const topics=area&&mode!=='az'?topicsIn(mode,area):[],topicGuides=topic?topics.find(t=>t.topic===topic)?.guides||[]:[];
 const siblings=searching?results:mode==='az'&&letter?guidesStartingWith(letter):topicGuides.length?topicGuides:area&&mode!=='az'?guidesIn(mode,area):[];
 const onKey=(e:React.KeyboardEvent)=>{
  if(!searching)return;
  if(e.key==='ArrowDown'){e.preventDefault();setActive(a=>Math.min(a+1,Math.max(results.length-1,0)));}
  else if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(a-1,0));}
  else if(e.key==='Enter'&&results[active]){e.preventDefault();pick(results[active]);}
  else if(e.key==='Escape'){setQuery('');}
 };
 const switchMode=(m:Mode)=>{setMode(m);setArea(null);setTopic(null);setLetter(null);close();};
 return <section className="card diy-reference" aria-labelledby={uid+'h'}>
  <p className="eyebrow">Field guide · How-to library</p><h2 id={uid+'h'}>Home repair reference</h2>
  <p className="tiny">{diyGuides.length} step-by-step guides. Reviewed {diyReviewedOn}. Start typing, or browse by room or trade.</p>
  <p role="note" className="diy-banner"><strong>Reference only.</strong> Knowing how is not permission to offer, advertise or perform a trade. Follow the service catalog and refer licensed work (plumbing, electrical, gas, refrigerant) to licensed pros.</p>
  <div className="diy-searchbox">
   <label htmlFor={uid+'q'} className="diy-label">What are you working on?</label>
   <input id={uid+'q'} type="text" role="combobox" aria-expanded={searching&&results.length>0} aria-controls={uid+'list'} aria-autocomplete="list" aria-activedescendant={searching&&results[active]?uid+'o'+active:undefined} autoComplete="off" spellCheck={false} value={query} maxLength={80} placeholder="Type: faucet, cartridge, toilet, door won’t latch…" onChange={e=>{setQuery(e.target.value);setActive(0);close();}} onKeyDown={onKey}/>
   {searching&&<button type="button" className="diy-clear" aria-label="Clear search" onClick={()=>setQuery('')}>×</button>}
  </div>
  {searching&&!open&&<><p className="tiny" role="status" aria-live="polite">{results.length?results.length+(results.length===1?' guide':' guides')+' match. Use the arrow keys and Enter, or tap one.':'No match yet. Try a shorter word like “leak”, “door”, “outlet” or “shelf”.'}</p>
   <ul id={uid+'list'} role="listbox" aria-label="Matching guides" className="diy-list">{results.map((g,i)=><Row key={g.id} g={g} id={uid+'o'+i} active={i===active} onPick={pick}/>)}</ul></>}
  {open&&<Detail g={open} onBack={close} crumb={crumb} siblings={siblings} onPick={pick}/>}
  {!searching&&!open&&<>
   {recent.length>0&&<div className="diy-recent"><h4>Recently opened</h4><div className="help-chips">{recent.map(id=>{const g=byId.get(id);return g?<button key={id} type="button" className="help-chip" onClick={()=>pick(g)}>{g.title}</button>:null;})}</div></div>}
   <div className="help-chips" role="group" aria-label="Browse by">{([['room','By room'],['trade','By trade'],['az','A to Z']] as const).map(([m,l])=><button key={m} type="button" className={'help-chip'+(mode===m?' active':'')} aria-pressed={mode===m} onClick={()=>switchMode(m)}>{l}</button>)}</div>
   {mode==='az'?<>
    <div className="help-chips" role="group" aria-label="Letter">{azLetters().map(l=><button key={l} type="button" className={'help-chip diy-letter'+(letter===l?' active':'')} aria-pressed={letter===l} onClick={()=>setLetter(letter===l?null:l)}>{l}</button>)}</div>
    {letter?<ul className="diy-list" role="list">{guidesStartingWith(letter).map(g=><Row key={g.id} g={g} onPick={pick}/>)}</ul>:<p className="tiny">Pick a letter.</p>}
   </>:!area?<ul className="diy-tiles" role="list">{areasFor(mode).map(a=><li key={a}><button type="button" className="diy-tile" onClick={()=>{setArea(a);setTopic(null);}}><strong>{a}</strong><span className="tiny">{guidesIn(mode,a).length} guides</span></button></li>)}</ul>
   :<>
    <nav className="diy-crumbs" aria-label="Where you are"><button type="button" onClick={()=>{setArea(null);setTopic(null);}}>{mode==='room'?'All rooms':'All trades'}</button><span aria-hidden="true"> › </span>{topic?<><button type="button" onClick={()=>setTopic(null)}>{area}</button><span aria-hidden="true"> › </span><span aria-current="page">{topic}</span></>:<span aria-current="page">{area}</span>}</nav>
    {!topic?<ul className="diy-tiles" role="list">{topics.map(t=><li key={t.topic}><button type="button" className="diy-tile" onClick={()=>setTopic(t.topic)}><strong>{t.topic}</strong><span className="tiny">{t.guides.length} {t.guides.length===1?'job':'jobs'}: {t.guides.slice(0,2).map(g=>g.title.split(' (')[0]).join(', ')}{t.guides.length>2?'…':''}</span></button></li>)}</ul>
    :<ul className="diy-list" role="list">{topicGuides.map(g=><Row key={g.id} g={g} onPick={pick}/>)}</ul>}
   </>}
  </>}
 </section>;
}
