import {createHash} from 'node:crypto';
import {routeDatabase} from './route-budget.ts';
import {googleRouteProvider} from './google-routes.ts';
export type RoutesHealth={key_fingerprint:string;status:'active'|'error'|'disabled';checked_at:string}|null;
export function needsRoutesProbe(saved:RoutesHealth,fingerprint:string,now=Date.now()){
 const checked=Date.parse(saved?.checked_at||'');
 return !saved||saved.key_fingerprint!==fingerprint||!Number.isFinite(checked)||checked>now||now-checked>=(saved.status==='active'?86400000:3600000);
}
// One public-town route verifies the connection without sending customer data.
// It uses the same provider and atomic call budget as real planning.
export async function verifyRoutesConnection(organization:string){
 const key=process.env.GOOGLE_ROUTES_API_KEY||'',fingerprint=createHash('sha256').update(key).digest('hex'),db=routeDatabase();
 const saved=await db.rpc('routes_connection_health',{p_org:organization,p_action:'read',p_input:{}});
 if(saved.error)throw Error('ROUTES_HEALTH_UNAVAILABLE');
 if(!needsRoutesProbe(saved.data,fingerprint))return saved.data.status;
 let status:'active'|'error'|'disabled'=key?'error':'disabled';
 if(key){try{const result=await googleRouteProvider(key)!('DeKalb, IL','Sycamore, IL',new Date(Date.now()+300000).toISOString());if(result.minutes>0&&result.meters>0)status='active';}catch{status='error';}}
 const record=await db.rpc('routes_connection_health',{p_org:organization,p_action:'record',p_input:{fingerprint,status}});
 if(record.error)throw Error('ROUTES_HEALTH_UNAVAILABLE');
 return status;
}
