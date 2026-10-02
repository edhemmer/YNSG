import {NextResponse} from 'next/server';
import {emailClient,saveEmailVerifier} from '../../../lib/email-auth';
import {saveSession} from '../../../lib/session';

export const dynamic='force-dynamic';
export async function GET(request:Request){
 const code=new URL(request.url).searchParams.get('code');
 const origin=process.env.APP_ORIGIN;
 if(!origin)return new NextResponse('Sign-in is not configured.',{status:503,headers:{'Cache-Control':'no-store'}});
 const redirect=(failed:boolean)=>NextResponse.redirect(origin+(failed?'/?auth=failed#':'/#'),{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 // Default Supabase email verification returns a single-use PKCE code.
 // Arbitrary redirect targets and unbound token_hash links are not accepted.
 if(!code||code.length>2048)return redirect(true);
 try{
  const auth=await emailClient();
  if(!auth.currentVerifier())return redirect(true);
  const {data,error}=await auth.client.auth.exchangeCodeForSession(code);
  if(error||!data.session)return saveEmailVerifier(redirect(true),null);
  return saveEmailVerifier(saveSession(redirect(false),data.session),null);
 }catch{return saveEmailVerifier(redirect(true),null);}
}
