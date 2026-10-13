import {merchantMap} from './stripe-core.ts';
type State='configured'|'missing'|'invalid'|'unassigned';
export function liveStripeKey(key:string|undefined){return /^(?:sk|rk)_live_[A-Za-z0-9]+$/.test(key||'');}
// Presence and syntax only. Merchant capability and webhook/payment evidence stay separate.
export function stripeSetup(org:string,env:Record<string,string|undefined>){
 const apiKey:State=!env.STRIPE_SECRET_KEY?'missing':liveStripeKey(env.STRIPE_SECRET_KEY)?'configured':'invalid';
 const webhook:State=!env.STRIPE_WEBHOOK_SECRET?'missing':/^whsec_[A-Za-z0-9+/=_-]+$/.test(env.STRIPE_WEBHOOK_SECRET)?'configured':'invalid';
 let merchant:State='missing';
 if(env.STRIPE_MERCHANTS_JSON){try{merchant=merchantMap(env.STRIPE_MERCHANTS_JSON)[org]?'configured':'unassigned';}catch{merchant='invalid';}}
 let workspace:State='missing';
 if(env.APP_ORIGIN&&env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY){try{const origin=new URL(env.APP_ORIGIN),db=new URL(env.SUPABASE_URL);workspace=origin.protocol==='https:'&&origin.origin===env.APP_ORIGIN&&!origin.username&&!origin.password&&db.protocol==='https:'&&!db.username&&!db.password?'configured':'invalid';}catch{workspace='invalid';}}
 const checks={apiKey,webhook,merchant,workspace};return {configured:Object.values(checks).every(v=>v==='configured'),checks};
}
