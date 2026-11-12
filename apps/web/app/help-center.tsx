'use client';
import {useId,useMemo,useState} from 'react';
import {helpArticles,helpCategories,searchHelp,type HelpCategory} from '../lib/help-articles';
export default function HelpCenter({onGo}:{onGo?:(section:string)=>void}){
 const id=useId(),[query,setQuery]=useState(''),[category,setCategory]=useState<HelpCategory|'All'>('All'),[open,setOpen]=useState<string|null>(null);
 const results=useMemo(()=>searchHelp(query).filter(a=>category==='All'||a.category===category),[query,category]);
 const jump:Record<string,string>={Today:'Dashboard',Requests:'Requests',Billing:'Money','Field guide':'Learning'};
 return <section className="card help-center" aria-labelledby={id+'h'}>
  <p className="eyebrow">How-to help</p><h2 id={id+'h'}>How do I…?</h2>
  <p>Search in everyday words, like “record cash”, “reschedule” or “review request”.</p>
  <label className="help-search">Search help<input type="search" value={query} maxLength={100} placeholder="Try: invoice, cash, review, holiday" onChange={e=>{setQuery(e.target.value);setOpen(null);}}/></label>
  <div className="help-chips" role="group" aria-label="Help categories">{(['All',...helpCategories] as const).map(c=><button key={c} type="button" className={'help-chip'+(category===c?' active':'')} aria-pressed={category===c} onClick={()=>{setCategory(c);setOpen(null);}}>{c}</button>)}</div>
  <p className="tiny" role="status">{results.length} {results.length===1?'article':'articles'}{query?` for “${query}”`:''}</p>
  {results.length===0&&<p>No match. Try a simpler word, or clear the search. Still stuck? Tell me what you were trying to do and I will add it here.</p>}
  <ul className="help-list">{results.map(a=><li key={a.id} className="help-item">
   <button type="button" className="help-q" aria-expanded={open===a.id} onClick={()=>setOpen(open===a.id?null:a.id)}><span><strong>{a.title}</strong><span className="tiny"> · {a.category}</span></span><span aria-hidden="true">{open===a.id?'−':'+'}</span></button>
   {open===a.id&&<div className="help-a"><p>{a.summary}</p><ol>{a.steps.map((s,i)=><li key={i}>{s}</li>)}</ol>{a.tips?.map((t,i)=><p key={i} className="help-tip"><strong>Tip:</strong> {t}</p>)}{a.where&&jump[a.where]&&onGo&&<p><button type="button" className="secondary" onClick={()=>onGo(jump[a.where!]!)}>Go to {a.where}</button></p>}</div>}
  </li>)}</ul>
  <p className="tiny">{helpArticles.length} articles. These steps follow how the app works today.</p>
 </section>;
}
