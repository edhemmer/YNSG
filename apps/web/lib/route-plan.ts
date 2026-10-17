import type {DayCall} from './day-plan.js';
export type RouteEstimate={minutes:number;meters:number;polyline?:string};
export type RouteLeg={fromId:string;toId:string;departureAt:string;gapMinutes:number;minutes:number|null;meters:number|null;lateMinutes:number|null;reason?:string;polyline?:string};
export type RoutePlan={legs:RouteLeg[];warnings:string[];grouping:{firstId:string;nearbyId:string;betweenId:string}[];complete:boolean;mapsUrls:string[]};
export type RouteProvider=(from:string,to:string,departure:string)=>Promise<RouteEstimate>;
const sameStop=(a:string,b:string)=>a.trim().toLowerCase().replace(/[^a-z0-9]/g,'')===b.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
// Mobile Maps supports at most three intermediate waypoints. Split long days,
// sharing the last stop of each segment so no appointment disappears.
export function dayRouteUrls(calls:Pick<DayCall,'address'>[]):string[]{
 if(calls.some(c=>!c.address.trim()))return [];
 if(calls.length<2)return calls.length===1?[`https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(calls[0]!.address)}`]:[];
 const urls:string[]=[];
 for(let start=0;start<calls.length;start+=4){
  const segment=calls.slice(start,start+5);if(!segment.length)break;
  const url=new URL('https://www.google.com/maps/dir/');url.searchParams.set('api','1');url.searchParams.set('travelmode','driving');
  url.searchParams.set('destination',segment.at(-1)!.address);
  url.searchParams.set('origin',segment[0]!.address);
  const via=segment.slice(1,-1).map(c=>c.address);
  if(via.length)url.searchParams.set('waypoints',via.join('|'));urls.push(url.toString());if(start+5>=calls.length)break;
 }return urls;
}
export async function buildRoutePlan(calls:DayCall[],provider:RouteProvider|null,now=new Date()):Promise<RoutePlan>{
 const route:RoutePlan={legs:[],warnings:[],grouping:[],complete:true,mapsUrls:dayRouteUrls(calls)};
 if(calls.some(c=>c.status!=='reserved')){route.complete=false;route.warnings.push('Visits needing review are excluded from travel estimates. Confirm them before planning the route.');}
 const booked=calls.filter(c=>c.status==='reserved').sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));route.mapsUrls=dayRouteUrls(booked);
 if(booked.some(c=>c.arrivalAt!==c.startAt)){route.complete=false;route.mapsUrls=[];route.warnings.push('Supplier pickup needs its own location. Review the route before departure.');}
 if(booked.some(c=>!c.address.trim()||!c.address.includes(','))){route.complete=false;route.mapsUrls=[];route.warnings.push('One or more confirmed visits have incomplete addresses. Check all locations before opening directions.');}
 if(booked.some(c=>!Number.isFinite(Date.parse(c.startAt))||!Number.isFinite(Date.parse(c.endAt))||!Number.isFinite(Date.parse(c.arrivalAt))||Date.parse(c.endAt)<=Date.parse(c.startAt))){route.complete=false;route.mapsUrls=[];route.warnings.push('One or more confirmed visits have invalid appointment times. Review the schedule before departure.');}
 if(booked.length>12){route.complete=false;route.warnings.push('Travel estimates support up to 12 confirmed visits per day. All visits remain listed.');return route;}
 await Promise.all(booked.slice(1).map(async(next,offset)=>{
  const i=offset+1;
  const previous=booked[i-1]!;
  const leg:RouteLeg={fromId:previous.id,toId:next.id,departureAt:previous.endAt,gapMinutes:Math.floor((Date.parse(next.startAt)-Date.parse(previous.endAt))/60000),minutes:null,meters:null,lateMinutes:null};route.legs[offset]=leg;
  if(!Number.isFinite(leg.gapMinutes))leg.reason='Appointment times could not be read. Review the schedule before routing.';
  else if(leg.gapMinutes<0)leg.reason='Confirmed appointments overlap. Review the schedule before routing.';
  else if(next.startAt!==next.arrivalAt||previous.startAt!==previous.arrivalAt)leg.reason='Supplier pickup needs its own location. Review this route leg.';
  else if(!previous.address.trim()||!next.address.trim())leg.reason='A complete customer address is required.';
  else if(!previous.address.includes(',')||!next.address.includes(','))leg.reason='Review the street and city for both visits before routing.';
  else if(Date.parse(previous.endAt)<=now.getTime())leg.reason='This departure is in the past. Use Maps for a current route.';
  else if(sameStop(previous.address,next.address)){leg.minutes=0;leg.meters=0;leg.lateMinutes=0;}
  else if(!provider)leg.reason='Live travel estimates are not connected. Check travel in Maps before confirming the schedule.';
  else try{const estimate=await provider(previous.address,next.address,previous.endAt);if(!Number.isFinite(estimate.minutes)||estimate.minutes<0||!Number.isFinite(estimate.meters)||estimate.meters<0)throw Error();if(estimate.polyline)leg.polyline=estimate.polyline;leg.minutes=Math.ceil(estimate.minutes);leg.meters=estimate.meters;leg.lateMinutes=Math.max(0,leg.minutes-leg.gapMinutes);}catch{leg.reason='Travel could not be verified. Check this leg in Maps.';}
  if(leg.lateMinutes!==null&&leg.lateMinutes>0){route.complete=false;route.warnings.push('A confirmed visit has insufficient driving time before the next appointment. Review the route and contact the customer before changing the schedule.');}
  if(leg.reason){route.complete=false;route.warnings.push(leg.reason);}
 }));
 // Flag A → B → C where A and C are much closer. This is a geographic review
 // suggestion, never permission to move a customer's committed arrival time.
 if(provider)await Promise.all(booked.slice(0,-2).map(async(a,i)=>{
  const b=booked[i+1]!,c=booked[i+2]!,ab=route.legs[i],bc=route.legs[i+1];
  if(ab?.meters===null||bc?.meters===null||ab?.meters===undefined||bc?.meters===undefined)return;
  try{const ac=await provider(a.address,c.address,a.endAt);if(ac.meters<=1609&&ab.meters+bc.meters>=Math.max(4828,ac.meters*4))route.grouping.push({firstId:a.id,nearbyId:c.id,betweenId:b.id});}catch{/* No unsupported grouping claim. */}
 }));
 route.grouping.sort((a,b)=>a.firstId.localeCompare(b.firstId));
 route.warnings=[...new Set(route.warnings)];return route;
}
