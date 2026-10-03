import test from 'node:test';import assert from 'node:assert/strict';
import {repeatRequest} from '../packages/contracts/customer-intake.ts';
const base={organization:'20000000-0000-4000-8000-000000000001',contact:'40000000-0000-4000-8000-000000000001',property:'40000000-0000-4000-8000-000000000002',key:'repeat-request-key-0001',input:{services:[{service:'Lawn care',task:'Mowing'},{service:'Yard & garden',task:'Pulling weeds by hand'}],description:'',preferredTime:'Next week',communityRate:'No'}};
test('repeat request retains jobs across categories and needs no supplied contact strings',()=>{assert.ok(repeatRequest.safeParse(base).success);assert.ok(!repeatRequest.safeParse({...base,email:'other@example.invalid'}).success)});
test('repeat request rejects duplicates, missing other description and excess selections',()=>{
 assert.ok(!repeatRequest.safeParse({...base,input:{...base.input,services:[base.input.services[0],base.input.services[0]]}}).success);
 assert.ok(!repeatRequest.safeParse({...base,input:{...base.input,services:[{service:'Something else',task:'Describe below'}]}}).success);
 assert.ok(!repeatRequest.safeParse({...base,input:{...base.input,services:Array(16).fill(base.input.services[0])}}).success);
});
