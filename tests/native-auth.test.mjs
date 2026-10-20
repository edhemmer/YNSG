import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes,createRequire} from 'node:module';import {runInNewContext} from 'node:vm';import {z} from 'zod';
import {nativeAuthInput,nativeAuthError} from '../apps/web/lib/native-auth-contract.ts';import {ownerRequestContext,ownerReturnTarget} from '../apps/web/lib/email-links.ts';import {passwordSignInFailure,passwordUpdateFailure,authProviderFailure} from '../apps/web/lib/auth-flow.ts';
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),{NextResponse}=require('next/server');
const origin='https://crm.example.invalid',actor='20000000-0000-4000-8000-000000000001',other='30000000-0000-4000-8000-000000000001';
const raw=path=>stripTypeScriptTypes(readFileSync(path,'utf8').replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm,'')).replace(/^export /gm,'');
function harness(options={}){
 const jar=new Map(Object.entries(options.initialCookies||{})),calls=[];
 const user={id:options.wrongActor?other:actor,email:'synthetic@example.invalid',email_confirmed_at:options.unconfirmed?null:'2026-01-01T00:00Z'};
 const session={access_token:'synthetic-new-access',refresh_token:'synthetic-new-refresh',expires_in:3600,user};
 const db={auth:{
  signInWithPassword:async value=>{calls.push(['password',value]);return options.loginFailure?{data:{session:null},error:options.loginFailure}:{data:{session,user},error:null};},
  setSession:async value=>{calls.push(['bind',value]);return options.bindFailure?{data:{session:null},error:options.bindFailure}:{data:{session},error:null};},
  refreshSession:async value=>{calls.push(['refresh',value]);return options.bindFailure?{data:{session:null},error:options.bindFailure}:{data:{session},error:null};},
  getUser:async token=>{calls.push(['identity']);return token?{data:{user},error:null}:{data:{user:null},error:{status:401}};},
  updateUser:async value=>{calls.push(['update',value]);return options.updateFailure?{data:{user:null},error:options.updateFailure}:{data:{user},error:null};},
  getSession:async()=>({data:{session:options.uncertain?null:session},error:null}),
 },from:()=>{const chain={select:()=>chain,eq:()=>chain,is:async()=>({data:options.revoked?[]:[{organization_id:actor,role:'owner'}],error:null})};return chain;}};
 const base={exports:{},z,Buffer,NextResponse,Error,Request,URL,URLSearchParams,process:{env:{SUPABASE_URL:'https://provider.example.invalid',SUPABASE_PUBLISHABLE_KEY:'synthetic-key',APP_ORIGIN:origin,NODE_ENV:'production'}},cookies:async()=>({get:key=>jar.has(key)?{value:jar.get(key)}:undefined}),createClient:()=>db};
 runInNewContext(raw('apps/web/lib/session.ts')+'\nObject.assign(exports,{authClient,authenticated,saveSession,failure,sameOrigin});',base);
 const state={...base,exports:{},...base.exports,ownerRequestContext,authProviderFailure,passwordSignInFailure,passwordUpdateFailure,emailClient:async()=>({client:{auth:{resetPasswordForEmail:async value=>{calls.push(['recover',value]);return {error:options.emailFailure||null};}}},currentVerifier:()=> 'synthetic-verifier'}),saveEmailVerifier:(r,value)=>{r.cookies.set('ynsg-email-pkce',value||'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:value?3600:0});return r;}};
 runInNewContext(raw('apps/web/lib/auth-session-handler.ts')+'\nexports.handleSessionPost=handleSessionPost;',state);
 const route={...base,...base.exports,exports:{},nativeAuthInput,nativeAuthError,ownerReturnTarget,ownerRequestContext,handleSessionPost:state.exports.handleSessionPost};
 runInNewContext(raw('apps/web/app/auth/access/route.ts')+'\nexports.POST=POST;',route);
 const api={...base,...base.exports,exports:{},recordOwnerSessionIp:async()=>{},handleSessionPost:state.exports.handleSessionPost};
 runInNewContext(raw('apps/web/app/api/session/route.ts')+'\nObject.assign(exports,{GET,POST});',api);
 return {POST:route.exports.POST,api:api.exports,calls,apply:response=>{for(const c of response.cookies.getAll()){if(c.maxAge===0)jar.delete(c.name);else jar.set(c.name,c.value);}},cookies:jar};
}
function request(values,{sentOrigin=origin,body,type='application/x-www-form-urlencoded'}={}){return new Request(origin+'/auth/access',{method:'POST',headers:{origin:sentOrigin,'content-type':type},body:body??new URLSearchParams(values)});}
function path(response){const url=new URL(response.headers.get('location'));assert.equal(url.origin,origin);return url.pathname+url.search;}
test('native password POST uses shared provider action, returns host-only cookies and enables live owner membership reads',async()=>{
 const h=harness();assert.equal((await h.api.GET(new Request(origin+'/api/session'))).status,401);
 const result=await h.POST(request({action:'password',email:' SYNTHETIC@example.invalid ',password:'synthetic-only',request:other,organization:actor}));
 assert.equal(result.status,303);assert.equal(path(result),'/owner?request='+other+'&organization='+actor);assert.equal(h.calls[0][1].email,'synthetic@example.invalid');
 for(const cookie of result.cookies.getAll()){assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);assert.equal(cookie.sameSite,'strict');assert.equal(cookie.domain,undefined);assert.equal(cookie.path,'/');}
 assert.equal(result.cookies.get('ynsg-refresh').maxAge,2592000);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.ok(!result.headers.get('location').includes('synthetic-only'));h.apply(result);
 const read=await h.api.GET(new Request(origin+'/api/session'));assert.equal(read.status,200);assert.equal((await read.json()).memberships[0].role,'owner');
});
test('native contract rejects cross-origin, unknown/duplicate/oversized input and mismatch before provider work',async()=>{
 const h=harness();assert.equal((await h.POST(request({action:'password'},{sentOrigin:'https://evil.example.invalid'}))).status,403);
 for(const req of [request({action:'password',email:'synthetic@example.invalid',password:'x',returnTo:'https://evil.example.invalid'}),request({}, {body:'action=password&action=recover'}),request({}, {body:'x'.repeat(16001)}),request({}, {type:'application/json',body:'{}'}),request({action:'set-password',password:'synthetic-password',confirmation:'different-password',expectedUser:actor})]){
  const response=await h.POST(req);assert.equal(response.status,303);assert.match(path(response),/error=(invalid_form|mismatch)/);assert.equal(h.calls.length,0);
 }
});
test('invalid credentials, provider throttling and outage stay on the correct reviewed error screen',async()=>{
 for(const [failure,code] of [[{status:400,code:'invalid_credentials'},'invalid'],[{status:429},'limited'],[{status:500,code:'private-provider-detail'},'unavailable']]){
  const h=harness({loginFailure:failure}),r=await h.POST(request({action:'password',email:'synthetic@example.invalid',password:'never-echo-this'}));assert.equal(path(r),'/sign-in?error='+code);assert.equal(r.cookies.getAll().length,0);assert.ok(!(await r.text()).includes('never-echo-this'));
 }
});
test('recovery sends only on explicit POST and retains the older browser verifier on rate limit',async()=>{
 for(const failure of [null,{status:429,code:'over_email_send_rate_limit'}]){
  const h=harness({emailFailure:failure,initialCookies:{'ynsg-email-pkce':'synthetic-old-verifier'}}),r=await h.POST(request({action:'recover',email:'synthetic@example.invalid'}));
  assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'recover');
  assert.equal(path(r),failure?'/sign-in?mode=reset&error=limited':'/sign-in?mode=sent');
  if(failure){assert.equal(r.cookies.getAll().length,0);assert.equal(h.cookies.get('ynsg-email-pkce'),'synthetic-old-verifier');}else{assert.equal(r.cookies.get('ynsg-email-pkce').httpOnly,true);assert.equal(r.cookies.get('ynsg-auth-destination').value,'password');}
 }
});
test('password update renews missing access, validates the expected confirmed actor and saves once',async()=>{
 const form={action:'set-password',password:'synthetic-new-password',confirmation:'synthetic-new-password',expectedUser:actor};
 for(const access of [undefined,'synthetic-expired-access']){
  const h=harness({initialCookies:{'ynsg-refresh':'synthetic-old-refresh',...(access?{'ynsg-access':access}:{})}}),r=await h.POST(request(form));assert.equal(path(r),'/auth/password?status=saved');assert.equal(h.calls[0][0],access?'bind':'refresh');assert.equal(h.calls.filter(c=>c[0]==='update').length,1);assert.ok(r.cookies.get('ynsg-refresh'));
 }
 for(const options of [{wrongActor:true},{unconfirmed:true},{bindFailure:{status:401}}]){const h=harness({...options,initialCookies:{'ynsg-refresh':'synthetic-old-refresh'}}),r=await h.POST(request(form));assert.match(path(r),/error=expired/);assert.equal(h.calls.filter(c=>c[0]==='update').length,0);}
 const unavailable=harness({bindFailure:{status:500},initialCookies:{'ynsg-refresh':'synthetic-old-refresh'}});assert.match(path(await unavailable.POST(request(form))),/error=unavailable/);
});
test('failed or uncertain password update retains safe session behavior and is never retried automatically',async()=>{
 const form={action:'set-password',password:'synthetic-new-password',confirmation:'synthetic-new-password',expectedUser:actor};
 for(const [opts,code] of [[{updateFailure:{status:400,code:'weak_password'}},'weak_password'],[{updateFailure:{status:400,code:'same_password'}},'same_password'],[{updateFailure:{status:400,code:'reauthentication_needed'}},'reauthenticate'],[{uncertain:true},'password_uncertain']]){
  const h=harness({...opts,initialCookies:{'ynsg-refresh':'synthetic-old-refresh'}}),r=await h.POST(request(form));assert.equal(path(r),'/auth/password?error='+code);assert.equal(h.calls.filter(c=>c[0]==='update').length,1);if(!opts.uncertain)assert.ok(r.cookies.get('ynsg-refresh'));
 }
});
