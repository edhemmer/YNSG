import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {serverDatabase} from '../../../../lib/google-server';
import {pushConfigured,sendApplePush} from '../../../../lib/apple-push';
import {unseal} from '../../../../lib/google-core';
export const runtime='nodejs';export const maxDuration=60;export const dynamic='force-dynamic';
async function run(request:Request){
 const secret=process.env.OWNER_PUSH_WORKER_SECRET,provided=request.headers.get('authorization')?.replace(/^Bearer /,'');const headers={'Cache-Control':'private, no-store'};
 if(!secret||secret.length<32||!provided||Buffer.byteLength(secret)!==Buffer.byteLength(provided)||!timingSafeEqual(Buffer.from(secret),Buffer.from(provided)))return NextResponse.json({error:'Access is required.'},{status:401,headers});
 if(!pushConfigured())return NextResponse.json({processed:0,configured:false},{headers});
 try{const db=serverDatabase();let processed=0,needsAttention=0;
 for(let i=0;i<5;i++){
  const claim=await db.rpc('claim_owner_mobile_push');if(claim.error)throw Error('CLAIM_FAILED');if(!claim.data)break;const p=claim.data;
  let outcome:{state:'accepted'|'rejected'|'unknown';code:string;disable:boolean};
  try{const token=unseal<string>(p.cipher,process.env.PUSH_TOKEN_ENCRYPTION_KEY!,p.organization+':'+p.device);outcome=await sendApplePush({...p,token});}catch{outcome={state:'unknown',code:'provider_result_unconfirmed',disable:false};}
  const finish=await db.rpc('finish_owner_mobile_push',{p_org:p.organization,p_id:p.id,p_lease:p.lease,p_state:outcome.state,p_outcome:outcome.code,p_disable:outcome.disable});if(finish.error)throw Error('FINISH_FAILED');processed++;if(outcome.state!=='accepted')needsAttention++;
 }
 return NextResponse.json({processed,needsAttention},{headers});
 }catch{return NextResponse.json({error:'Phone notification delivery needs attention.'},{status:503,headers});}
}
export const POST=run;export const GET=run;
