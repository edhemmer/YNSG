import {isIP} from 'node:net';
import type {SupabaseClient} from '@supabase/supabase-js';

export function trustedVisitorIp(request:Request){
 if(!process.env.VERCEL)return null;
 const ip=request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
 if(!ip||!isIP(ip))throw Error('SECURITY_LOG_UNAVAILABLE');
 return ip;
}
export async function recordOwnerSessionIp(db:SupabaseClient,request:Request,organizationId:string){
 const ip=trustedVisitorIp(request);
 if(!ip)return; // Local development has no Vercel edge IP.
 const {error}=await db.rpc('record_owner_session_ip',{p_org:organizationId,p_ip:ip});
 if(error)throw Error('SECURITY_LOG_UNAVAILABLE');
}
