'use client';
import {useEffect,useId,useState} from 'react';
import {z} from 'zod';
import {companySettings,type CompanySettings} from '../../../packages/contracts/index';
import {marketingDraft,type MarketingService} from '../lib/business-assistant';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';

const catalogSchema=z.array(z.object({name:z.string().min(2).max(80),scope:z.string().min(10).max(4000),exclusions:z.string().min(10).max(4000),compliance:z.enum(['approved','review','held']),pricing_mode:z.enum(['hourly','starting','quote','review'])})).max(100);
export default function MarketingDrafts({organization}:{organization:string}){
 const [open,setOpen]=useState(false);
 return <section className="card marketing-assistant"><p className="eyebrow">Marketing assistant</p><h2>A ready-to-review draft</h2><p>Prepare a post or flyer from your published services and rates.</p><button className="secondary" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'Close drafts':'Prepare a draft'}</button>{open&&<DraftEditor key={organization} organization={organization}/>}</section>;
}
function DraftEditor({organization}:{organization:string}){
 const id=useId(),[settings,setSettings]=useState<CompanySettings|null>(null),[services,setServices]=useState<MarketingService[]>([]),[selected,setSelected]=useState(''),[format,setFormat]=useState<'post'|'flyer'>('post'),[draft,setDraft]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;const controller=new AbortController();setSettings(null);setServices([]);setDraft('');setError('');setNotice('');
  async function read(){try{const r=await sessionFetch('/api/configuration?'+new URLSearchParams({organization}),{cache:'no-store',signal:controller.signal});const d=await r.json();if(!r.ok)throw Error(d.error);if(!d.configuration)throw Error('Published company settings are unavailable.');const approved=companySettings.parse(d.configuration.settings),catalog=catalogSchema.parse(d.catalog).filter(s=>s.compliance==='approved');if(live){setSettings(approved);setServices(catalog);setSelected(catalog[0]?.name||'');}}catch(e){if(live&&!controller.signal.aborted)setError(publicError(e));}}
  void read();return()=>{live=false;controller.abort();};
 },[organization,retry]);
 function prepare(){try{const service=services.find(s=>s.name===selected);if(!settings||!service)return;setDraft(marketingDraft(settings,service,format));setNotice('Draft prepared. Review the scope, conditions and wording before posting.');setError('');}catch(e){setError(publicError(e));}}
 async function copy(){try{await navigator.clipboard.writeText(draft);setNotice('Copied. Nothing has been published or sent.');}catch{setNotice('Clipboard is unavailable. Select and copy the draft below.');}}
 return <div className="marketing-editor">{error?<><p className="error" role="alert">Published business details could not load. {error}</p><button className="secondary" onClick={()=>setRetry(n=>n+1)}>Retry</button></>:!settings?<p role="status">Loading published services and rates…</p>:!services.length?<p>No approved services are available for a draft. Review your service catalog in Settings.</p>:<><label htmlFor={id+'-service'}>Service<select id={id+'-service'} value={selected} onChange={e=>{setSelected(e.target.value);setDraft('');setNotice('');}}>{services.map(s=><option key={s.name} value={s.name}>{s.name}</option>)}</select></label><label htmlFor={id+'-format'}>Format<select id={id+'-format'} value={format} onChange={e=>{setFormat(e.target.value as 'post'|'flyer');setDraft('');setNotice('');}}><option value="post">Social post</option><option value="flyer">Flyer copy</option></select></label><button onClick={prepare}>{draft?'Prepare again':'Prepare draft'}</button>{draft&&<><label htmlFor={id+'-copy'}>Edit your draft<textarea id={id+'-copy'} rows={12} maxLength={12000} value={draft} onChange={e=>{setDraft(e.target.value);setNotice('');}}/></label><button className="secondary" onClick={()=>void copy()}>Copy draft</button><p className="muted">Draft only. Copy before closing; drafts are not saved. Appointment availability is not promised and customers are not contacted.</p></>}</>}{notice&&<p role="status">{notice}</p>}</div>;
}
