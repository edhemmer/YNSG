import {NextResponse} from 'next/server';
import {sameOrigin} from '../../../lib/session';
import {handleSessionPost} from '../../../lib/auth-session-handler';
import {nativeAuthInput,nativeAuthError} from '../../../lib/native-auth-contract';
import {ownerReturnTarget,ownerRequestContext} from '../../../lib/email-links';
export async function POST(request:Request){
 const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
 // A native navigation needs an HTML denial with a safe way back. Never echo
 // the body, origin, credentials or provider response; the guard stays exact.
 if(!sameOrigin(request))return new NextResponse('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Reopen sign in</title></head><body><main><h1>Reopen sign in</h1><p>This form could not be accepted. No sign-in or password change was made.</p><p><a href="/sign-in?error=invalid_form">Open sign in</a></p><p><a href="/sign-in?mode=reset">Open password recovery</a></p></main></body></html>',{status:403,headers:{...headers,'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'}});
 const origin=new URL(request.url).origin;
 let action='password';
 let context:{request:string;organization:string}|null=null;
 const back=(code:string)=>NextResponse.redirect(origin+(action==='set-password'?'/auth/password':'/sign-in')+'?'+new URLSearchParams({...(action==='recover'?{mode:'reset'}:{}),error:code,...(action==='password'&&context?context:{})}),{status:303,headers});
 try{
  if(!(request.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded'))return back('invalid_form');
  const raw=await request.text();if(Buffer.byteLength(raw)>16000)return back('invalid_form');
  const fields=new URLSearchParams(raw),entries=[...fields];
  if(entries.length>8||new Set(entries.map(([key])=>key)).size!==entries.length)return back('invalid_form');
  const proposed=fields.get('action');if(['password','recover','set-password','refresh'].includes(proposed||''))action=proposed!;
  const parsed=nativeAuthInput.safeParse(Object.fromEntries(entries));
  if(!parsed.success)return back('invalid_form');
  const value=parsed.data;action=value.action;if(value.action==='password')context=ownerRequestContext(value);
  if(value.action==='set-password'&&value.password!==value.confirmation)return back('mismatch');
  const payload=value.action==='set-password'?{action:value.action,password:value.password,expectedUser:value.expectedUser}:value.action==='password'?{action:value.action,email:value.email,password:value.password}:value;
  // The public native POST passed sameOrigin above. The in-process session
  // dispatch uses the configured canonical origin for its own guard, not the
  // TLS proxy transport host or a second untrusted browser-supplied origin.
  const canonical=process.env.APP_ORIGIN!;
  const result=await handleSessionPost(new Request(canonical+'/api/session',{method:'POST',headers:{origin:canonical,'Content-Type':'application/json'},body:JSON.stringify(payload)}));
  const data=await result.json();
  let response:NextResponse;
  if(result.ok&&data.ok!==true)response=back(value.action==='set-password'?'password_uncertain':'unavailable');
  else if(!result.ok)response=back(nativeAuthError(data.code|| (result.status===429?'limited':result.status===401?'expired':undefined)));
  else{
   const target=value.action==='recover'?'/sign-in?mode=sent':value.action==='set-password'?'/auth/password?status=saved':value.action==='password'?ownerReturnTarget('/owner',value):value.action==='refresh'&&value.destination==='password'?'/auth/password':'/owner';
   response=NextResponse.redirect(origin+target,{status:303,headers});
   if(value.action==='set-password')response.cookies.set('ynsg-password-saved',value.expectedUser,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/auth/password',maxAge:120});
  }
  // Preserve provider session/verifier cookie attributes exactly. No credential
  // or provider detail is placed into the browser's address/history.
  for(const cookie of result.cookies.getAll())response.cookies.set(cookie);
  return response;
 }catch{return back('unavailable');}
}
