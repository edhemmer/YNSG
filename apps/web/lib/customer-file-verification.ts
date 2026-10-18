import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
const uuid=z.uuid();
// Called only after authenticated() validated the access token with getUser.
// The service-only RPC rechecks this exact live session and current membership.
export function verifiedFileSession(access:string,userId:string){
 try{if(access.length>16000)throw Error();const claims=JSON.parse(Buffer.from(access.split('.')[1]||'','base64url').toString('utf8'));if(claims.sub!==userId)throw Error();return uuid.parse(claims.session_id);}catch{throw Error('UNAUTHORIZED');}
}
export async function confirmVerifiedCustomerFile(input:{organization:string;file:string;actor:string;session:string;mime:string;bytes:number;sha256:string}){
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('SETUP_REQUIRED');
 // Deliberately limited server authority: no table/storage operations, and never
 // exposed to client modules. All stored bytes were read with the actor's RLS.
 const verifier=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return verifier.rpc('confirm_verified_customer_file',{p_org:input.organization,p_file:input.file,p_actor:input.actor,p_session:input.session,p_mime:input.mime,p_bytes:input.bytes,p_sha:input.sha256});
}
