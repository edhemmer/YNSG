import {NextResponse} from 'next/server';
import {authenticated,authClient,sameOrigin,saveSession} from '../../../lib/session';
import {authorizeRecordExport,exportReauthentication} from '../../../lib/export-reauthentication';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 let raw:unknown;try{const text=await request.text();if(Buffer.byteLength(text)>2048)return NextResponse.json({error:'Details too long.'},{status:413,headers});raw=JSON.parse(text);}catch{return NextResponse.json({error:'Check the confirmation fields.'},{status:400,headers});}
 const p=exportReauthentication.safeParse(raw);if(!p.success)return NextResponse.json({error:'Check the confirmation fields.'},{status:400,headers});
 try{
  const current=await authenticated();try{await authorizeRecordExport(current.db,p.data.organization);return NextResponse.json({confirmed:true},{headers});}catch(e){if(!(e instanceof Error)||e.message!=='REAUTHENTICATION_REQUIRED')throw e;}
  if(!current.user.email||!current.user.email_confirmed_at)throw Error('FORBIDDEN');
  const fresh=authClient(),r=await fresh.auth.signInWithPassword({email:current.user.email,password:p.data.password});
  if(r.error||!r.data.session)return NextResponse.json({error:'Password confirmation failed. Check it or sign in again using your normal email link.'},{status:400,headers});
  if(r.data.user?.id!==current.user.id)throw Error('FORBIDDEN');
  await authorizeRecordExport(authClient(r.data.session.access_token),p.data.organization);
  return saveSession(NextResponse.json({confirmed:true},{headers}),r.data.session);
 }catch(e){const code=e instanceof Error?e.message:'';return NextResponse.json({error:code==='UNAUTHORIZED'?'Sign in to continue.':code==='FORBIDDEN'?'This account cannot export these records.':'Confirmation could not be verified. Retry the export to check your current sign-in before confirming again.'},{status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:503,headers});}
}
