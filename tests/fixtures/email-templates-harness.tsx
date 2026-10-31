import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Reply from '../../apps/web/app/request-reply-draft';import {EntrySafety} from '../../apps/web/app/entry-safety';
function Harness(){const [org,setOrg]=useState('a933d657-14d3-46b6-85e6-21d973e4ed97');return <EntrySafety><main className="company-workspace"><button onClick={()=>setOrg('00000000-0000-4000-8000-000000000001')}>Other company</button><button onClick={()=>setOrg('a933d657-14d3-46b6-85e6-21d973e4ed97')}>YNSG</button><Reply key={org} organization={org} name="Synthetic Neighbor" email="neighbor@example.invalid"/></main></EntrySafety>;}
createRoot(document.getElementById('root')!).render(<Harness/>);
