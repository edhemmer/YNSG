// Browser-only synthetic entry. This is never an application route or production bypass.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import RequestDetail from '../../apps/web/app/request-detail';
import ServiceWorkflow from '../../apps/web/app/service-workflow';
import RequestQuickActions from '../../apps/web/app/request-quick-actions';
import {EntrySafety} from '../../apps/web/app/entry-safety';
const fixture=(window as any).__ownerFixture;
function Harness(){
 const [open,setOpen]=useState(true),[mode,setMode]=useState(fixture.mode||'detail'),[data,setData]=useState(fixture.data);
 const refresh=async()=>{const response=await fetch('/api/request-inbox');if(response.ok)setData(await response.json());};
 const request=data.requests[0],props={organization:fixture.organization,requestId:request.id,timezone:'America/Chicago',canManage:true,onClose:()=>setOpen(false),onChanged:refresh,onWork:()=>{setOpen(false);setMode('work');}};
 return <EntrySafety><main className="company-workspace"><button onClick={()=>setOpen(true)}>Open synthetic request</button>{mode==='quick'?<RequestQuickActions request={request} organization={fixture.organization} canManage onReview={()=>{setMode('detail');setOpen(true);}} onChanged={refresh}/>:mode==='work'?<ServiceWorkflow organization={fixture.organization} request={request} quotes={data.quotes} jobs={data.jobs} invoices={data.invoices} timezone="America/Chicago" canManage canQuote canWork busy={false} onBusy={()=>{}} onReview={()=>{setMode('detail');setOpen(true);}} act={async input=>{const r=await fetch('/api/commands',{method:'POST',body:JSON.stringify(input)});const v=await r.json();await refresh();return v;}} fieldAction={async()=>{}} onChanged={refresh}/>:open?<RequestDetail {...props}/>:<p>Request closed</p>}</main></EntrySafety>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
