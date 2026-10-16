import test from 'node:test';
import assert from 'node:assert/strict';
import {repeatRequest,repeatRequestContext} from '../packages/contracts/customer-intake.ts';
const id='20000000-0000-4000-8000-000000000001';
test('rejects incomplete customer intake context',()=>{
 assert.equal(repeatRequestContext.safeParse(null).success,false);
 assert.equal(repeatRequestContext.safeParse({contacts:[],properties:[],services:[]}).success,true);
 assert.equal(repeatRequestContext.safeParse({contacts:[],properties:null,services:[]}).success,false);
});
test('requires detail for uncategorized task',()=>{
 const data={organization:id,contact:id,property:id,key:'synthetic-repeat-request-key',input:{services:[{service:'Custom service',task:'Describe below'}],description:'',preferredTime:'',communityRate:'No'}};
 assert.equal(repeatRequest.safeParse(data).success,false);
 assert.equal(repeatRequest.safeParse({...data,input:{...data.input,description:'Customer describes the requested work here.'}}).success,true);
});
