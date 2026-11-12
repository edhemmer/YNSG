'use client';
import {useState} from 'react';
import {monthPlans,monthPlanFor,evergreenPosts,channels,reviewScripts,measures,marketingRules,weeklyRoutine} from '../lib/marketing-playbook';
import {emailTemplates} from '../lib/email-templates';
type Tab='plan'|'posts'|'channels'|'reviews'|'measure';
const tabs:[Tab,string][]=[['plan','Monthly plan'],['posts','Ready-to-post'],['channels','Where to post'],['reviews','Reviews'],['measure','What to track']];
function Copy({text}:{text:string}){const [done,setDone]=useState(false);return <button type="button" className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(text);setDone(true);window.setTimeout(()=>setDone(false),1800);}catch{window.prompt('Copy this text',text);}}}>{done?'Copied':'Copy'}</button>;}
export default function MarketingPlaybook({timezone}:{timezone?:string}){
 const now=monthPlanFor(new Date(),timezone||'America/Chicago'),[tab,setTab]=useState<Tab>('plan'),[month,setMonth]=useState(now.month),plan=monthPlans.find(m=>m.month===month)||now;
 const label=(id:string)=>emailTemplates.find(t=>t.id===id)?.label||id;
 return <section className="card marketing-playbook" aria-label="Marketing playbook">
  <p className="eyebrow">Marketing playbook</p><h2>Your month, planned for you</h2>
  <p>Everything here is free to do. Ten minutes, three times a week, is enough.</p>
  <div className="help-chips" role="tablist" aria-label="Playbook sections">{tabs.map(([k,l])=><button key={k} role="tab" aria-selected={tab===k} type="button" className={'help-chip'+(tab===k?' active':'')} onClick={()=>setTab(k)}>{l}</button>)}</div>
  {tab==='plan'&&<div role="tabpanel">
   <label>Month<select value={month} onChange={e=>setMonth(Number(e.target.value))}>{monthPlans.map(m=><option key={m.month} value={m.month}>{m.name}{m.month===now.month?' (this month)':''}</option>)}</select></label>
   <h3>{plan.name}: {plan.focus}</h3>
   <p><strong>Push these services:</strong> {plan.services.join(', ')}</p>
   <p><strong>Emails to send (Email templates):</strong> {plan.emails.map(label).join(' · ')}</p>
   <p><strong>Google Business Profile:</strong> {plan.gbp}</p>
   <h3>Posts</h3>
   {plan.posts.map(p=><article key={p.id} className="playbook-post"><h4>{p.title}</h4><p>{p.text}</p><p className="tiny">Photo: {p.photo}</p><Copy text={p.text}/></article>)}
   <h3>Your weekly rhythm</h3><ul>{weeklyRoutine.map(w=><li key={w.when}><strong>{w.when}:</strong> {w.what}</li>)}</ul>
  </div>}
  {tab==='posts'&&<div role="tabpanel"><p>Always-useful posts. Swap in a real photo each time.</p>{evergreenPosts.map(p=><article key={p.id} className="playbook-post"><h4>{p.title}</h4><p>{p.text}</p><p className="tiny">Photo: {p.photo}</p><Copy text={p.text}/></article>)}</div>}
  {tab==='channels'&&<div role="tabpanel">{channels.map(c=><article key={c.name} className="playbook-post"><h4>{c.name}</h4><p className="tiny">{c.cadence}</p><p><strong>Do:</strong> {c.do.join('; ')}.</p><p><strong>Avoid:</strong> {c.avoid.join('; ')}.</p></article>)}</div>}
  {tab==='reviews'&&<div role="tabpanel"><p>Reviews are the best free marketing you have. Ask every happy customer.</p>{reviewScripts.map(r=><article key={r.when} className="playbook-post"><h4>{r.when}</h4><p>{r.text}</p><Copy text={r.text}/></article>)}</div>}
  {tab==='measure'&&<div role="tabpanel"><p>Look at these once a month. Ten minutes.</p>{measures.map(m=><article key={m.what} className="playbook-post"><h4>{m.what}</h4><p className="tiny">Where: {m.how}</p><p>Goal: {m.goal}</p></article>)}</div>}
  <h3>Marketing rules</h3><ul>{marketingRules.map(r=><li key={r}>{r}</li>)}</ul>
 </section>;
}
