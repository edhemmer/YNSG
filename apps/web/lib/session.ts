import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

export function configured(){return Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_PUBLISHABLE_KEY&&process.env.APP_ORIGIN);}
export function authClient(token?:string){
 if(!configured())throw new Error('SETUP_REQUIRED');
 return createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},...(token?{global:{headers:{Authorization:`Bearer ${token}`}}}:{})});
}
export function sameOrigin(request:Request){return configured()&&request.headers.get('origin')===process.env.APP_ORIGIN;}
export async function authenticated(){
 const jar=await cookies();const access=jar.get('ynsg-access')?.value;
 if(!access)throw new Error('UNAUTHORIZED');
 const db=authClient(access);
 const {data,error}=await db.auth.getUser(access).catch(()=>{throw new Error('AUTH_UNAVAILABLE');});
 if(error){
  // A provider outage is not an expired credential. Keep cookies and let the
  // workspace retry saved access rather than initiating sign-in/rotation.
  if(![400,401,403].includes(error.status||0))throw new Error('AUTH_UNAVAILABLE');
  throw new Error('UNAUTHORIZED');
 }
 if(!data.user)throw new Error('UNAUTHORIZED');
 return {db,user:data.user,access};
}
export function saveSession(response:NextResponse,session:{access_token:string;refresh_token:string;expires_in:number}){
 response.headers.set('Cache-Control','no-store');
 const opts={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/'};
 response.cookies.set('ynsg-access',session.access_token,{...opts,maxAge:session.expires_in});
 response.cookies.set('ynsg-refresh',session.refresh_token,{...opts,maxAge:60*60*24*30});
 return response;
}
export function failure(error:unknown){
 const code=error instanceof Error?error.message:'FAILED';
 return NextResponse.json({error:code==='UNAUTHORIZED'?'Sign in to continue.':code==='SETUP_REQUIRED'?'This workspace connection is not configured yet.':code==='AUTH_UNAVAILABLE'?'Your saved sign-in could not be checked right now. Try again shortly; no new email is needed.':code==='SECURITY_LOG_UNAVAILABLE'?'Sign-in protection is temporarily unavailable. Please try again shortly.':'The action could not be completed. Your saved records have not been discarded.'},{status:code==='UNAUTHORIZED'?401:['SETUP_REQUIRED','SECURITY_LOG_UNAVAILABLE','AUTH_UNAVAILABLE'].includes(code)?503:400,headers:{'Cache-Control':'no-store'}});
}
