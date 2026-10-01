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
 const db=authClient(access);const {data,error}=await db.auth.getUser(access);
 if(error||!data.user)throw new Error('UNAUTHORIZED');
 return {db,user:data.user,access};
}
export function saveSession(response:NextResponse,session:{access_token:string;refresh_token:string;expires_in:number}){
 const opts={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/'};
 response.cookies.set('ynsg-access',session.access_token,{...opts,maxAge:session.expires_in});
 response.cookies.set('ynsg-refresh',session.refresh_token,{...opts,maxAge:60*60*24*7});
 return response;
}
export function failure(error:unknown){
 const code=error instanceof Error?error.message:'FAILED';
 return NextResponse.json({error:code==='UNAUTHORIZED'?'Sign in to continue.':code==='SETUP_REQUIRED'?'This workspace connection is not configured yet.':'The action could not be completed. Your saved records have not been discarded.',code:['UNAUTHORIZED','SETUP_REQUIRED'].includes(code)?code:'FAILED'},{status:code==='UNAUTHORIZED'?401:code==='SETUP_REQUIRED'?503:400,headers:{'Cache-Control':'no-store'}});
}
