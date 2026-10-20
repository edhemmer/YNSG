import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes,createRequire} from 'node:module';import {runInNewContext} from 'node:vm';
import {signInTarget} from '../apps/web/lib/sign-in-target.ts';import {ownerReturnTarget,ownerRequestContext} from '../apps/web/lib/email-links.ts';import {recoveryDestination} from '../apps/web/lib/auth-flow.ts';
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),{NextResponse}=require('next/server');
const origin='https://crm.example.invalid',source=stripTypeScriptTypes(readFileSync('apps/web/app/auth/confirm/route.ts','utf8').replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm,'')).replace(/^export /gm,'');
function harness({destination='password',error=null,verifier='synthetic-verifier',throws=false}={}){
 let calls=0,clears=0,saves=0;
 const result={data:{session:error?null:{access_token:'synthetic',refresh_token:'synthetic',expires_in:3600,user:{id:'20000000-0000-4000-8000-000000000001'}}},error};
 const exchange=async()=>{calls++;if(throws)throw Error('Synthetic transport outage');return result;};
 const env={exports:{},NextResponse,URL,URLSearchParams,Number,Error,process:{env:{APP_ORIGIN:origin}},cookies:async()=>({get:key=>key==='ynsg-auth-destination'?{value:destination}:undefined}),ownerReturnTarget,ownerRequestContext,signInTarget,recoveryDestination,emailClient:async()=>({currentVerifier:()=>verifier,client:{auth:{exchangeCodeForSession:exchange,verifyOtp:exchange}}}),authClient:()=>{throw Error('Unexpected membership lookup');},saveSession:r=>{saves++;return r;},saveEmailVerifier:(r,value)=>{if(value===null)clears++;return r;}};
 runInNewContext(source+'\nexports.GET=GET;',env);return {GET:env.exports.GET,counts:()=>({calls,clears,saves})};
}
test('callback temporary failure keeps verifier and routes directly to reviewed recovery errors',async()=>{
 for(const [options,code] of [[{error:{status:429}},'limited'],[{error:{status:503}},'unavailable'],[{throws:true},'unavailable'],[{error:{status:400}},'expired']]){const h=harness(options),r=await h.GET(new Request(origin+'/auth/confirm?code=synthetic-code'));assert.equal(new URL(r.headers.get('location')).pathname+new URL(r.headers.get('location')).search,'/sign-in?mode=reset&error='+code);assert.deepEqual(h.counts(),{calls:1,clears:0,saves:0});}
});
test('missing or malformed callback never exchanges, saves, destroys verifier or redirects externally',async()=>{
 for(const query of ['','?code=a&token_hash=b&type=recovery','?token_hash=a&type=unsupported','?code='+('a'.repeat(2049))]){const h=harness(),r=await h.GET(new Request(origin+'/auth/confirm'+query));assert.equal(new URL(r.headers.get('location')).origin,origin);assert.match(r.headers.get('location'),/error=expired/);assert.deepEqual(h.counts(),{calls:0,clears:0,saves:0});}
 const h=harness({verifier:null});await h.GET(new Request(origin+'/auth/confirm?code=a'));assert.deepEqual(h.counts(),{calls:0,clears:0,saves:0});
});
test('accepted PKCE and recovery token-hash save session exactly once and clear only after success',async()=>{
 for(const query of ['?code=synthetic-code','?token_hash=synthetic-hash&type=recovery']){const h=harness(),r=await h.GET(new Request(origin+'/auth/confirm'+query));assert.equal(new URL(r.headers.get('location')).pathname+new URL(r.headers.get('location')).search,'/auth/continue?destination=password');assert.deepEqual(h.counts(),{calls:1,clears:1,saves:1});assert.equal(r.headers.get('referrer-policy'),'no-referrer');}
});
test('continuation carries only fixed destinations/UUID context, no external redirect or authentication material',async()=>{
 const {randomBytes}=await import('node:crypto'),env={exports:{},NextResponse,URL,Object,JSON,randomBytes,ownerRequestContext,ownerReturnTarget};
 const bridge=stripTypeScriptTypes(readFileSync('apps/web/app/auth/continue/route.ts','utf8').replace(/^import[^\n]+\n/gm,'')).replace(/^export /gm,'');runInNewContext(bridge+'\nexports.GET=GET;',env);
 for(const [query,target] of [['?destination=password','/auth/password'],['?destination=https://evil.example.invalid&code=never-echo-code&token=never-echo-token','/sign-in?error=expired'],['?destination=__proto__','/sign-in?error=expired'],['?destination=owner&request=30000000-0000-4000-8000-000000000001&organization=20000000-0000-4000-8000-000000000001','/owner?request=30000000-0000-4000-8000-000000000001&organization=20000000-0000-4000-8000-000000000001']]){
  const r=await env.exports.GET(new Request(origin+'/auth/continue'+query)),html=await r.text();assert.equal(r.status,200);assert.ok(html.includes('window.location.replace('+JSON.stringify(target)+')'));assert.ok(!html.includes('never-echo'));assert.ok(!html.includes('evil.example'));assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('content-security-policy'),/default-src 'none'; script-src 'nonce-/);assert.match(html,/>Continue<\/a>/);
 }
});
