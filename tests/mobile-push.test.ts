import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {genericPushPayload,mobileDeviceSchema} from '../apps/web/lib/mobile-push-contract.ts';
import {appleProviderToken,classifyAppleResponse,pushConfigured,sendApplePush} from '../apps/web/lib/apple-push.ts';
import {parseNativeRequest,notificationDestination,appearanceScript} from '../apps/mobile/src/bridge-policy.ts';
import {ownerCommandSchema} from '../apps/web/lib/owner-command-contract.ts';
const org='20000000-0000-4000-8000-000000000001',id='30000000-0000-4000-8000-000000000001',nonce='40000000-0000-4000-8000-000000000001';
test('strict owner contract rejects additional mutation fields and fabricated payment confirmation',()=>{
 const input={command:'RecordPayment',organizationId:org,key:nonce,id,cents:5000,method:'cash',reference:'Actual synthetic fixture',receivedAt:'2026-10-14T16:00:00Z',confirmed:true};
 assert.ok(ownerCommandSchema.safeParse(input).success);assert.equal(ownerCommandSchema.safeParse({...input,confirmed:false}).success,false);assert.equal(ownerCommandSchema.safeParse({...input,skipReview:true}).success,false);
});
test('phone alerts use reviewed bounded inputs and generic private lock-screen text',()=>{
 const input={organization:org,device:id,revision:0,token:'a'.repeat(64),environment:'sandbox',newRequests:true,appointments:true,sound:false,quietStart:1260,quietEnd:420,reviewed:true,key:nonce};
 assert.ok(mobileDeviceSchema.safeParse(input).success);for(const patch of [{reviewed:false},{quietEnd:1440},{token:'javascript:alert(1)'},{userId:id}])assert.equal(mobileDeviceSchema.safeParse({...input,...patch}).success,false);
 for(const kind of ['new_request','appointment'] as const){const p=genericPushPayload(kind,org,id);assert.equal('sound' in p.aps,false);assert.equal(Object.keys(p.ynsg).length,4);assert.ok(!JSON.stringify(p).includes('email'));assert.ok(!JSON.stringify(p).includes('chargedCents'));assert.equal(notificationDestination(p.ynsg)?.startsWith('https://yourneighborhoodserviceguy.app/owner?'),true);}
});
test('native bridge accepts only appearance and device requests from the exact owner origin',()=>{
 const raw=JSON.stringify({type:'ynsg.push.register',nonce,environment:'sandbox',scope:org+'.'+id});assert.ok(parseNativeRequest(raw,'https://yourneighborhoodserviceguy.app/owner'));
 for(const url of ['https://yourneighborhoodserviceguy.app.attacker.invalid/owner','https://yourneighborhoodserviceguy.app/invoice','http://yourneighborhoodserviceguy.app/owner'])assert.equal(parseNativeRequest(raw,url),null);
 for(const body of [{type:'RecordPayment',cents:1},{type:'ynsg.push.register',nonce,environment:'sandbox',accessToken:'forbidden'},{type:'ynsg.theme.changed',theme:'javascript:alert(1)'}])assert.equal(parseNativeRequest(JSON.stringify(body),'https://yourneighborhoodserviceguy.app/owner'),null);
 assert.equal(notificationDestination({version:1,kind:'new_request',organization:org,object:'https://attacker.invalid'}),null);assert.ok(appearanceScript('system',true).includes('location.origin'));assert.ok(!appearanceScript('dark',true).includes('cookie'));
});
test('Apple provider JWT is signed with P-256 and accepted is distinct from actual delivery',()=>{
 const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),pem=keys.privateKey.export({type:'pkcs8',format:'pem'}).toString();
 const jwt=appleProviderToken('ABCDE12345','FGHIJ67890',pem,1791979200000),parts=jwt.split('.');assert.equal(JSON.parse(Buffer.from(parts[1]!,'base64url').toString()).iat,1791979200);
 assert.ok(verify('sha256',Buffer.from(parts[0]+'.'+parts[1]),{key:keys.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(parts[2]!,'base64url')));
 assert.deepEqual(classifyAppleResponse(200,''),{state:'accepted',code:'apns_accepted',disable:false});assert.equal(classifyAppleResponse(410,'{"reason":"Unregistered"}').disable,true);assert.equal(classifyAppleResponse(429,'{"reason":"TooManyRequests"}').state,'rejected');
});
test('disabled provider makes no APNs connection',async()=>{
 assert.equal(pushConfigured({}),false);assert.deepEqual(await sendApplePush({id,token:'a'.repeat(64),environment:'sandbox',kind:'new_request',organization:org,object:id,sound:false},{}),{state:'rejected',code:'push_configuration_mismatch',disable:false});
});
