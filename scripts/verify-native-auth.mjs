// Production-runtime HTTP proof with an isolated synthetic Auth provider.
// No browser credentials, production records or external messages are used.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import https from 'node:https';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const actor='20000000-0000-4000-8000-000000000001',other='30000000-0000-4000-8000-000000000001';
const user={id:actor,email:'synthetic@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'};
let currentPassword='synthetic-initial-password',challenge='',updates=0,recoveries=0,signIns=0,refreshes=0,usedCode=false;
const faults={recovery:false,callback:false,revoked:false};
const token=()=>['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:actor,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-test-only'].join('.');
const session=()=>({access_token:token(),refresh_token:'synthetic-refresh-token',token_type:'bearer',expires_in:3600,user});
const provider=http.createServer(async(req,res)=>{
 let raw='';for await(const part of req)raw+=part;const body=raw?JSON.parse(raw):{},url=new URL(req.url,'http://provider.invalid');
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Supabase-Api-Version':'2024-01-01'});res.end(JSON.stringify(data));};
 if(url.pathname==='/origin-policy'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><meta name="referrer" content="'+(url.searchParams.get('policy')==='same-origin'?'same-origin':'no-referrer')+'"><form method="post" action="/origin-result"><button>Submit probe</button></form>');return;}
 if(url.pathname==='/origin-result')return send(200,{origin:req.headers.origin||null});
 if(url.pathname==='/email-link'){const target=new URL(url.searchParams.get('target'));assert.equal(target.hostname,'127.0.0.1');res.writeHead(200,{'Content-Type':'text/html','Referrer-Policy':'no-referrer'});res.end('<!doctype html><a href="'+target.href+'">Open reset email</a>');return;}
 if(url.pathname==='/auth/v1/token'){
  const grant=url.searchParams.get('grant_type');
  if(grant==='password'){signIns++;return body.email===user.email&&body.password===currentPassword?send(200,session()):send(400,{code:'invalid_credentials',msg:'Synthetic credential rejection'});}
  if(grant==='refresh_token'){refreshes++;return body.refresh_token==='synthetic-refresh-token'?send(200,session()):send(400,{code:'refresh_token_not_found'});}
  if(grant==='pkce'){if(faults.callback)return send(429,{code:'over_request_rate_limit'});if(!usedCode&&body.auth_code==='synthetic-code'&&createHash('sha256').update(body.code_verifier).digest('base64url')===challenge){usedCode=true;return send(200,session());}return send(400,{code:'bad_code_verifier'});}
 }
 if(url.pathname==='/auth/v1/recover'){recoveries++;if(faults.recovery)return send(429,{code:'over_email_send_rate_limit'});challenge=body.code_challenge;usedCode=false;return send(200,{});}
 if(url.pathname==='/auth/v1/user'){
  if(!req.headers.authorization?.startsWith('Bearer '))return send(401,{code:'bad_jwt'});
  if(req.method==='PUT'){assert.equal(typeof body.password,'string');currentPassword=body.password;updates++;}
  return send(200,user);
 }
 if(url.pathname==='/auth/v1/logout')return send(200,{});
 if(url.pathname==='/rest/v1/memberships')return send(200,faults.revoked?[]:[{organization_id:actor,role:'owner',revoked_at:null}]);
 return send(404,{error:'Unsupported synthetic provider path'});
});
await new Promise(r=>provider.listen(0,'127.0.0.1',r));
const spare=http.createServer();await new Promise(r=>spare.listen(0,'127.0.0.1',r));const port=spare.address().port;await new Promise(r=>spare.close(r));
const transportOrigin='http://127.0.0.1:'+port;
let origin=transportOrigin,proxy=null,tlsDirectory=null;
if(process.argv.includes('--browsers')){
 tlsDirectory=mkdtempSync(resolve(tmpdir(),'ynsg-synthetic-tls-'));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',tlsDirectory+'/key.pem','-out',tlsDirectory+'/cert.pem','-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
 proxy=https.createServer({key:readFileSync(tlsDirectory+'/key.pem'),cert:readFileSync(tlsDirectory+'/cert.pem')},(req,res)=>{const upstream=http.request(transportOrigin+req.url,{method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});upstream.on('error',()=>{res.writeHead(503);res.end();});req.pipe(upstream);});
 await new Promise(r=>proxy.listen(0,'127.0.0.1',r));origin='https://127.0.0.1:'+proxy.address().port;
}
const env={...process.env};for(const key of Object.keys(env))if(/^(SUPABASE_|CRM_|GOOGLE_|RESEND_|STRIPE_|TRANSACTIONAL_EMAIL_|REQUEST_FROM_EMAIL$|APP_ORIGIN$|VERCEL_AUTOMATION_BYPASS_SECRET$)/.test(key))delete env[key];
Object.assign(env,{NODE_ENV:'production',APP_ORIGIN:origin,SUPABASE_URL:'http://127.0.0.1:'+provider.address().port,SUPABASE_PUBLISHABLE_KEY:'synthetic-publishable-key',NEXT_TELEMETRY_DISABLED:'1'});
let processLog='';const child=spawn(process.execPath,[resolve('apps/web/node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),env,stdio:['ignore','pipe','pipe']});
child.stdout.on('data',d=>{processLog=(processLog+d).slice(-2000);});child.stderr.on('data',d=>{processLog=(processLog+d).slice(-2000);});
const jar=new Map();
async function request(path,{form,cookies=jar,sentOrigin=origin}={}){
 const response=await fetch(transportOrigin+path,{redirect:'manual',headers:{...(cookies.size?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}:{}),...(form?{origin:sentOrigin,'Content-Type':'application/x-www-form-urlencoded'}:{})},...(form?{method:'POST',body:new URLSearchParams(form)}:{})});
 for(const line of response.headers.getSetCookie()){const [pair]=line.split(';'),split=pair.indexOf('=');const name=pair.slice(0,split),value=pair.slice(split+1);if(/max-age=0(?:;|$)/i.test(line))cookies.delete(name);else cookies.set(name,value);}
 return response;
}
const location=response=>{const value=response.headers.get('location');assert.ok(value);return new URL(value,origin).pathname+new URL(value,origin).search;};
try{
 let started=false;for(let n=0;n<80;n++){if(child.exitCode!==null)throw Error('Synthetic app stopped before startup');try{const r=await fetch(transportOrigin+'/sign-in');if(r.ok){started=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(started,'Synthetic application did not start');
 const guest=await request('/owner');assert.equal(location(guest),'/sign-in');
 const page=await(await request('/sign-in')).text();assert.ok(page.includes('action="/auth/access"'));assert.ok(page.includes('name="password"'));assert.ok(!page.includes('Privacy and account deletion'));
 const credentials={action:'password',email:user.email,password:currentPassword};const signed=await request('/auth/access',{form:credentials});assert.equal(signed.status,303,'Native login returned '+signed.status+' '+(await signed.clone().text()).slice(0,250));assert.equal(location(signed),'/owner');assert.ok(signed.headers.getSetCookie().some(c=>c.startsWith('ynsg-refresh=')&&/httponly/i.test(c)&&/secure/i.test(c)));
 const membership=await(await request('/api/session')).json();assert.equal(membership.memberships[0].role,'owner');
 const rejected=await request('/auth/access',{form:credentials,sentOrigin:'https://evil.example.invalid'});assert.equal(rejected.status,403);
 jar.clear();const reset=await request('/auth/access',{form:{action:'recover',email:user.email}});assert.equal(location(reset),'/sign-in?mode=sent');assert.equal(recoveries,1);assert.ok(jar.get('ynsg-email-pkce'));
 const callback=await request('/auth/confirm?code=synthetic-code');assert.equal(location(callback),'/auth/continue?destination=password');const continuation=await(await request(location(callback))).text();assert.ok(continuation.includes('window.location.replace("/auth/password")'));
 const passwordPage=await(await request('/auth/password')).text();assert.ok(passwordPage.includes('aria-label="Set password"'));assert.ok(passwordPage.includes('name="expectedUser"'));assert.ok(!passwordPage.includes('Privacy and account deletion'));assert.ok(!passwordPage.includes('service history'));
 const fabricated=await(await request('/auth/password?status=saved')).text();assert.ok(!fabricated.includes('<h1>Password saved</h1>'));
 const change={action:'set-password',password:'synthetic-new-password',confirmation:'synthetic-new-password',expectedUser:actor};jar.delete('ynsg-access');
 const changed=await request('/auth/access',{form:change});assert.equal(location(changed),'/auth/password?status=saved');assert.equal(updates,1);
 const success=await(await request(location(changed))).text();assert.ok(success.includes('<h1>Password saved</h1>'));assert.ok(success.includes('Open your workspace'));
 const before=updates;const wrong=await request('/auth/access',{form:{...change,expectedUser:other,password:'synthetic-wrong-account',confirmation:'synthetic-wrong-account'}});assert.ok(location(wrong).includes('error=expired'));assert.equal(updates,before);
 const fresh=new Map();const old=await request('/auth/access',{form:credentials,cookies:fresh});assert.ok(location(old).includes('error=invalid'));
 const renewed=await request('/auth/access',{form:{...credentials,password:'synthetic-new-password'},cookies:fresh});assert.equal(location(renewed),'/owner');assert.equal((await request('/api/session',{cookies:fresh})).status,200);
 if(process.argv.includes('--browsers')){const {verifyBrowserAuth}=await import('./verify-browser-auth.mjs');await verifyBrowserAuth({origin,providerOrigin:'http://127.0.0.1:'+provider.address().port,actor,email:user.email,faults,password:()=>currentPassword,counts:()=>({updates,recoveries,signIns,refreshes})});}
 console.log('PASS: production-runtime native sign-in, PKCE recovery, password save, secure-cookie redirect, same-account denial and fresh owner sign-in; isolated synthetic provider, no external delivery.');
}catch(error){console.error('Native auth runtime verification failed:',error.message);if(processLog)console.error(processLog);process.exitCode=1;}
finally{child.kill('SIGTERM');if(proxy)await new Promise(r=>proxy.close(r));if(tlsDirectory)rmSync(tlsDirectory,{recursive:true,force:true});await new Promise(r=>provider.close(r));}
