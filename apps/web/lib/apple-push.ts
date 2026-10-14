import {connect} from 'node:http2';
import {createPrivateKey,sign} from 'node:crypto';
import {genericPushPayload} from './mobile-push-contract.ts';
export type PushOutcome={state:'accepted'|'rejected'|'unknown';code:string;disable:boolean};
export function pushConfigured(env:NodeJS.ProcessEnv=process.env){
 if(!(env.OWNER_PUSH_ENABLED==='true'&&env.APNS_TEAM_ID?.match(/^[A-Z0-9]{10}$/)&&env.APNS_KEY_ID?.match(/^[A-Z0-9]{10}$/)&&env.APNS_PRIVATE_KEY?.includes('PRIVATE KEY')&&env.APNS_BUNDLE_ID==='com.inlightai.ynsg.owner'&&['sandbox','production'].includes(env.APNS_ENVIRONMENT||'')&&Buffer.from(env.PUSH_TOKEN_ENCRYPTION_KEY||'','base64').length===32))return false;
 try{const key=createPrivateKey(env.APNS_PRIVATE_KEY);return key.asymmetricKeyType==='ec'&&key.asymmetricKeyDetails?.namedCurve==='prime256v1';}catch{return false;}
}
export function appleProviderToken(team:string,keyId:string,pem:string,now=Date.now()){
 if(!/^[A-Z0-9]{10}$/.test(team)||!/^[A-Z0-9]{10}$/.test(keyId))throw Error('PUSH_SETUP_REQUIRED');
 const key=createPrivateKey(pem);if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('PUSH_SETUP_REQUIRED');
 const header=Buffer.from(JSON.stringify({alg:'ES256',kid:keyId})).toString('base64url'),payload=Buffer.from(JSON.stringify({iss:team,iat:Math.floor(now/1000)})).toString('base64url');
 const input=header+'.'+payload;return input+'.'+sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
}
export function classifyAppleResponse(status:number,body:string):PushOutcome{
 if(status===200)return {state:'accepted',code:'apns_accepted',disable:false};
 let reason='apns_rejected';try{const value=JSON.parse(body)?.reason;if(typeof value==='string'&&/^[A-Za-z]{1,80}$/.test(value))reason=value;}catch{}
 return {state:'rejected',code:reason,disable:status===410||['BadDeviceToken','DeviceTokenNotForTopic','Unregistered'].includes(reason)};
}
export async function sendApplePush(value:{id:string;token:string;environment:string;kind:'new_request'|'appointment';organization:string;object:string;sound:boolean},env:NodeJS.ProcessEnv=process.env):Promise<PushOutcome>{
 if(!pushConfigured(env)||value.environment!==env.APNS_ENVIRONMENT||!/^[a-f0-9]{64,256}$/i.test(value.token))return {state:'rejected',code:'push_configuration_mismatch',disable:false};
 const authorization=appleProviderToken(env.APNS_TEAM_ID!,env.APNS_KEY_ID!,env.APNS_PRIVATE_KEY!);
 const payload=JSON.stringify(genericPushPayload(value.kind,value.organization,value.object,value.sound));
 return new Promise(resolve=>{
  const client=connect(value.environment==='sandbox'?'https://api.sandbox.push.apple.com':'https://api.push.apple.com');let settled=false;
  const finish=(result:PushOutcome)=>{if(settled)return;settled=true;clearTimeout(timer);client.destroy();resolve(result);};
  const timer=setTimeout(()=>finish({state:'unknown',code:'apns_timeout',disable:false}),8000);
  client.on('error',()=>finish({state:'unknown',code:'apns_connection_interrupted',disable:false}));
  client.once('connect',()=>{
   const stream=client.request({':method':'POST',':path':'/3/device/'+value.token,'authorization':'bearer '+authorization,'apns-topic':env.APNS_BUNDLE_ID!,'apns-push-type':'alert','apns-priority':'10','apns-expiration':'0','apns-id':value.id});let status=0,body='';
   stream.on('response',headers=>{status=Number(headers[':status']);});stream.setEncoding('utf8');
   stream.on('data',chunk=>{body+=chunk;if(body.length>4096)finish({state:'unknown',code:'apns_invalid_response',disable:false});});
   stream.on('error',()=>finish({state:'unknown',code:'apns_stream_interrupted',disable:false}));
   stream.on('end',()=>finish(status?classifyAppleResponse(status,body):{state:'unknown',code:'apns_invalid_response',disable:false}));stream.end(payload);
  });
 });
}
