import {processDeletion} from '../../../lib/deletion-processing';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {authenticated,authClient,sameOrigin,saveSession} from '../../../lib/session';
import {privacyInput,privacyState,privacyActionFailure} from '../../../lib/privacy';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.',code:'INVALID_REQUEST',certainty:'rejected'},{status:403,headers});
 let raw:unknown;try{const text=await request.text();if(Buffer.byteLength(text)>12000)return NextResponse.json({error:'Details too long.',code:'INVALID_REQUEST',certainty:'rejected'},{status:413,headers});raw=JSON.parse(text);}catch{return NextResponse.json({error:'Check the privacy fields.',code:'INVALID_REQUEST',certainty:'rejected'},{status:400,headers});}
 const parsed=privacyInput.safeParse(raw);if(!parsed.success)return NextResponse.json({error:'Check the privacy fields.',code:'INVALID_REQUEST',certainty:'rejected'},{status:400,headers});
 const p=parsed.data;
 try{
  if(p.action==='status'||p.action==='resume'){
   if(!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('SETUP_REQUIRED');
   const admin=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
   // Session proof only controls cleanup, never receipt recovery authority.
   let ownsReceipt=false;try{const current=await authenticated();const own=await current.db.rpc('privacy_command',{p:{action:'read'}});const proof=privacyState.safeParse(own.data);ownsReceipt=!own.error&&proof.success&&proof.data.request?.id===p.request;}catch{}
   const lease=p.action==='resume'?randomUUID():null;
   const state=await processDeletion(admin,p,lease);
   const response=NextResponse.json({status:state.status,busy:Boolean(state.busy)},{headers});
   if(state.status==='completed'&&ownsReceipt){response.cookies.delete('ynsg-access');response.cookies.delete('ynsg-refresh');}
   return response;
  }
  const current=await authenticated();
  if(p.action==='reauthenticate'){
   if(!current.user.email||!current.user.email_confirmed_at)throw Error('FORBIDDEN');
   const result=await authClient().auth.signInWithPassword({email:current.user.email,password:p.password});
   if(result.error||!result.data.session||result.data.user?.id!==current.user.id)throw Error('CONFIRMATION_FAILED');
   const check=await authClient(result.data.session.access_token).rpc('privacy_command',{p:{action:'fresh'}});
   if(check.error||check.data?.fresh!==true)throw Error('CONFIRMATION_FAILED');
   return saveSession(NextResponse.json({confirmed:true},{headers}),result.data.session);
  }
  const result=await current.db.rpc('privacy_command',{p});if(result.error)throw Error(result.error.message==='UNAUTHORIZED'?'UNAUTHORIZED':result.error.code==='42501'?'FORBIDDEN':result.error.message);
  if(p.action==='fresh')return NextResponse.json({fresh:result.data?.fresh===true},{headers});
  return NextResponse.json(privacyState.parse(result.data),{headers});
 }catch(e){const failure=privacyActionFailure(e);return NextResponse.json(failure.body,{status:failure.status,headers});}
}
