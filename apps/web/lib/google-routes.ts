import type {RouteEstimate,RouteProvider} from './route-plan.js';
import {reserveRouteRequest} from './route-budget.ts';
import {googleRoutesKey} from './google-routes-key.ts';
// Server only: key and customer addresses never appear in a client-side API call.
export function googleRouteProvider(key=googleRoutesKey(),send:typeof fetch=fetch,reserve:()=>Promise<boolean>=reserveRouteRequest):RouteProvider|null{
 if(!key)return null;
 return async(from,to,departure):Promise<RouteEstimate>=>{
  if(!await reserve())throw Error('ROUTE_BUDGET_LIMIT');
  const response=await send('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.duration,routes.distanceMeters'},body:JSON.stringify({origin:{address:from},destination:{address:to},travelMode:'DRIVE',routingPreference:'TRAFFIC_AWARE',departureTime:departure,units:'IMPERIAL'})});
  if(!response.ok)throw Error('ROUTE_UNAVAILABLE');const data=await response.json(),route=data.routes?.[0];
  if(!route||typeof route.duration!=='string'||!/^\d+(\.\d+)?s$/.test(route.duration)||typeof route.distanceMeters!=='number'||route.distanceMeters<0)throw Error('ROUTE_UNAVAILABLE');
  return {minutes:Number(route.duration.slice(0,-1))/60,meters:route.distanceMeters};
 };
}
