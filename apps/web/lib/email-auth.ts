import {cookies} from 'next/headers';
import {type NextResponse} from 'next/server';
import {configured} from './session';
import {createEmailClient,EMAIL_VERIFIER_COOKIE} from './email-auth-core';

export async function emailClient(){
 if(!configured())throw new Error('SETUP_REQUIRED');
 const jar=await cookies();
 return createEmailClient(process.env.SUPABASE_URL!,process.env.SUPABASE_PUBLISHABLE_KEY!,jar.get(EMAIL_VERIFIER_COOKIE)?.value||null);
}
export function saveEmailVerifier(response:NextResponse,value:string|null){
 response.cookies.set(EMAIL_VERIFIER_COOKIE,value||'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:value?3600:0});
 return response;
}
