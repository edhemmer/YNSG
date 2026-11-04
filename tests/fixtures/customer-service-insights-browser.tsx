import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Insights from '../../apps/web/app/customer-service-insights';
function Review(){const [opened,setOpened]=useState('');return <div className="company-workspace"><main style={{padding:16}}><Insights organization="20000000-0000-4000-8000-000000000001" timezone="America/Chicago" onCustomer={setOpened}/>{opened&&<p role="status">Opened {opened}</p>}</main></div>;}
createRoot(document.getElementById('root')!).render(<Review/>);
