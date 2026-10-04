"use client";
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
type Event={occurredAt:string;ip:string;actorId:string};
export default function OwnerSecurity({organization}:{organization:string}){
 const [events,setEvents]=useState<Event[]|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{let active=true;setEvents(null);setError('');sessionFetch('/api/owner-security?'+new URLSearchParams({organization})).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.error||'Could not load sign-in history.');if(active)setEvents(body.events)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[organization,reload]);
 return <section className="card" aria-label="Owner sign-in activity"><h2>Owner sign-in activity</h2><p>Recent signed-in sessions for this company. IP addresses can change on phones, shared networks and VPNs, so they are a clue, not proof of who used the account.</p>{error&&<p role="alert">{error}</p>}{!events&&!error&&<p role="status">Checking sign-in activity…</p>}{events&&<>{!events.length?<p>No owner sessions recorded in the past 30 days.</p>:<ul>{events.map((event,index)=><li key={event.occurredAt+event.actorId+index}>{new Date(event.occurredAt).toLocaleString()} · IP {event.ip}</li>)}</ul>}<p>Only owners and admins can view this list. Records older than 30 days are removed when the next security event is saved.</p></>}<button type="button" onClick={()=>setReload(n=>n+1)}>Refresh sign-ins</button></section>
}
