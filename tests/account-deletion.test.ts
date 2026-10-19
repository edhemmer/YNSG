import test from 'node:test';import assert from 'node:assert/strict';
import {privacyInput} from '../apps/web/lib/privacy.ts';
import {processDeletion} from '../apps/web/lib/deletion-processing.ts';
const request='98000000-0000-4000-8000-000000000001',user='00000000-0000-4000-8000-000000000003',secret='a'.repeat(64),lease='96000000-0000-4000-8000-000000000001';
test('privacy input rejects foreign targets, missing review, malformed receipts and partial irreversible confirmation',()=>{
 for(const p of [{action:'resume',request,secret,user},{action:'prepare',request,revision:1,confirmation:'DELETE MY ACCOUNT'},{action:'policy',organization:request,key:request,revision:0,recordDays:0,auditDays:10,basis:'Test basis',notice:'Test notice',reviewed:true},{action:'request',request,key:request,secret:'short'}])assert.equal(privacyInput.safeParse(p).success,false);
 assert.equal(privacyInput.safeParse({action:'prepare',request,key:request,revision:1,secret,confirmation:'DELETE MY ACCOUNT'}).success,true);
});
test('identity processing reconciles persisted deletion before retry, and never exposes the target',async()=>{
 for(const alreadyDeleted of [true,false]){let deleted=0,finished=0;const db={rpc:async(_n:string,p:Record<string,unknown>)=>{assert.equal(p.p_id,request);assert.equal(p.p_secret,secret);assert.equal(p.p_lease,lease);if(p.p_finish){finished++;return {data:{status:'completed'},error:null};}return {data:{status:'processing',user,identityDeleted:alreadyDeleted},error:null};},auth:{admin:{deleteUser:async(id:string,soft:boolean)=>{assert.equal(id,user);assert.equal(soft,true);deleted++;return {error:null};}}}};assert.deepEqual(await processDeletion(db as never,{request,secret},lease),{status:'completed',busy:false});assert.equal(deleted,alreadyDeleted?0:1);assert.equal(finished,1);}
});
test('receipt status and active processing lease cannot call the identity provider',async()=>{
 for(const [state,key] of [[{status:'processing'},null],[{status:'processing',busy:true},lease],[{status:'completed'},lease],[{status:'requested'},lease]] as const){let calls=0;const db={rpc:async()=>({data:state,error:null}),auth:{admin:{deleteUser:async()=>{calls++;throw Error('must not call');}}}};await processDeletion(db as never,{request,secret},key);assert.equal(calls,0);}
});
test('unknown provider result or unconfirmed completion never claims successful deletion',async()=>{
 for(const failAt of ['provider','finish','missing-target']){const db={rpc:async(_n:string,p:Record<string,unknown>)=>p.p_finish?{error:{message:'unknown'},data:null}:{data:failAt==='missing-target'?{status:'processing'}:{status:'processing',user,identityDeleted:false},error:null},auth:{admin:{deleteUser:async()=>({error:failAt==='provider'?{message:'unknown'}:null})}}};await assert.rejects(processDeletion(db as never,{request,secret},lease),/PROCESSING_UNCERTAIN/);}
});
