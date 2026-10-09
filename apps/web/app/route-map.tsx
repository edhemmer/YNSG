'use client';
import {useEffect,useRef,useState} from 'react';
import {loadGoogleMap,decodePolyline,routeColors,type BrowserMap} from '../lib/google-map-browser';
import {navigationUrl,type DayPlan} from '../lib/day-plan';
export default function RouteMap({plan}:{plan:DayPlan}){
 const host=useRef<HTMLDivElement>(null),map=useRef<BrowserMap|null>(null),positions=useRef(new Map<string,{lat():number;lng():number}>()),[selected,setSelected]=useState(''),[message,setMessage]=useState(''),[ready,setReady]=useState(false);
 const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY||'';
 useEffect(()=>{let live=true;const overlays:{setMap(map:BrowserMap|null):void}[]=[],listeners:{remove():void}[]=[];positions.current.clear();setSelected('');setReady(false);setMessage('');
 if(!key||!plan.calls.length)return;
 async function render(){
  try{
   const g=await loadGoogleMap(key);if(!live||!host.current)return;
   const view=new g.Map(host.current,{center:{lat:41.9295,lng:-88.7504},zoom:11,mapTypeControl:false,streetViewControl:false,gestureHandling:'cooperative'});map.current=view;
   const traffic=new g.TrafficLayer();traffic.setMap(view);overlays.push(traffic);
   const bounds=new g.LatLngBounds(),geo=new g.Geocoder();let missing=0;
   for(const [i,call] of plan.calls.entries()){
    if(!live)return;if(!call.address){missing++;continue;}
    try{
     const r=await geo.geocode({address:call.address});if(!live)return;
     if(r.results.length!==1||r.results[0].partial_match){missing++;continue;}
     const position=r.results[0].geometry.location;positions.current.set(call.id,position);bounds.extend(position);
     const marker=new g.Marker({map:view,position,title:(i+1)+'. '+call.name,label:{text:String(i+1),color:'#fff',fontWeight:'700'},icon:{path:g.SymbolPath.CIRCLE,scale:16,fillColor:call.status==='reserved'?routeColors[i%routeColors.length]:'#b45309',fillOpacity:1,strokeColor:'#fff',strokeWeight:2}});
     listeners.push(marker.addListener('click',()=>{if(live){setSelected(call.id);view.panTo(position);view.setZoom(16);}}));overlays.push(marker);
    }catch{missing++;}
   }
   if(!live)return;
   for(const leg of plan.route?.legs||[])if(leg.polyline){try{const line=new g.Polyline({map:view,path:decodePolyline(leg.polyline),strokeColor:routeColors[plan.calls.findIndex(c=>c.id===leg.toId)%routeColors.length],strokeWeight:5,strokeOpacity:.85});overlays.push(line);}catch{/* Never draw invented road geometry. */}}
   if(positions.current.size){view.fitBounds(bounds);if(positions.current.size===1)view.setZoom(15);}
   setReady(true);setMessage(missing?missing+' appointment address'+(missing===1?'':'es')+' could not be placed accurately. Check the details below.':'');
  }catch{if(live)setMessage('Google map could not load. Use the directions links below and check the browser key restrictions.');}
 }
 void render();return()=>{live=false;for(const listener of listeners)listener.remove();for(const overlay of overlays)overlay.setMap(null);map.current=null;};
 },[plan,key]);
 const call=plan.calls.find(c=>c.id===selected);
 if(!plan.calls.length)return null;
 return <section className="route-map-panel" aria-label="Appointment route map">{!key?<p className="note">Interactive map needs the website Maps key. Directions links below still open Google Maps.</p>:<><div ref={host} className="route-map-canvas" aria-label="Google map of appointments"/>{!ready&&!message&&<p role="status">Locating appointment addresses…</p>}</>}{message&&<p role="status">{message}</p>}<div className="route-stop-chips">{plan.calls.map((c,i)=><button key={c.id} className="secondary" aria-pressed={selected===c.id} onClick={()=>{setSelected(c.id);const position=positions.current.get(c.id);if(position&&map.current){map.current.panTo(position);map.current.setZoom(16);}}}><i style={{background:c.status==='reserved'?routeColors[i%routeColors.length]:'#b45309'}}/>{i+1}. {c.name}</button>)}</div>{call&&<article className="route-selected-stop"><strong>{call.name}</strong><p>{new Date(call.arrivalAt).toLocaleTimeString('en-US',{timeZone:plan.timezone,timeStyle:'short'})} · {call.address}</p><p>{call.tasks.join(' · ')}</p>{navigationUrl(call.address)&&<a className="button" target="_blank" rel="noopener noreferrer" href={navigationUrl(call.address)!}>Get current directions</a>}</article>}<p className="tiny">Numbered colors identify visits. Road traffic colors come from Google. Select a stop to zoom; open directions for current navigation. Estimates and road conditions can change.</p></section>;
}
