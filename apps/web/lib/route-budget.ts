import {createClient} from '@supabase/supabase-js';
export function routeDatabase(){
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('ROUTE_BUDGET_UNAVAILABLE');
 return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function reserveRouteRequest(){
 const {data,error}=await routeDatabase().rpc('reserve_google_route_request');
 if(error)throw Error('ROUTE_BUDGET_UNAVAILABLE');
 return data===true;
}
