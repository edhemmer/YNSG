import {randomBytes} from 'node:crypto';
import {NextResponse} from 'next/server';
import {ownerRequestContext,ownerReturnTarget} from '../../../lib/email-links';
export const dynamic='force-dynamic';
// Commit a same-origin document before using Strict session cookies. A direct
// redirect from a cross-site email navigation can omit them on the first page.
// This route carries navigation only; destination pages still authenticate.
export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const destinations:Record<string,string>={password:'/auth/password',owner:'/owner',account:'/account',team:'/',google:'/owner?setup=google'};
 const selected=params.get('destination')||'',base=Object.hasOwn(destinations,selected)?destinations[selected]:'/sign-in?error=expired';
 const target=base==='/owner'?ownerReturnTarget(base,ownerRequestContext(Object.fromEntries(params))):base;
 const nonce=randomBytes(18).toString('base64');
 // All destinations and context are fixed paths/reviewed UUIDs. Never include
 // provider codes or tokens in the document, script, URL or browser storage.
 const script='window.location.replace('+JSON.stringify(target)+');';
 const href=target.replaceAll('&','&amp;');
 return new NextResponse('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Continue to your account</title></head><body><main><h1>Continue to your account</h1><p>Opening your account screen.</p><p><a href="'+href+'">Continue</a></p></main><script nonce="'+nonce+'">'+script+'</script></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}});
}
