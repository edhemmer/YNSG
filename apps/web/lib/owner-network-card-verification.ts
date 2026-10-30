import 'server-only';
import {createClient} from '@supabase/supabase-js';
export async function confirmNetworkCard(input:{organization:string;file:string;actor:string;session:string;mime:string;bytes:number;sha256:string}){
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('SETUP_REQUIRED');
 const verifier=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return verifier.rpc('confirm_network_card',{p_org:input.organization,p_file:input.file,p_actor:input.actor,p_session:input.session,p_mime:input.mime,p_bytes:input.bytes,p_sha:input.sha256});
}
