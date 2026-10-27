import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {postalCodesForCity,cityPostalPicker} from '../site/city-postal-codes.js';
import {readFileSync} from 'node:fs';
import {requestRecovery} from '../site/request-recovery.js';
import handler from '../api/requests.js';
test('public lead intake accepts cities outside the advertised three-town market',()=>{
 const dom=new JSDOM(readFileSync('site/pages/form.html','utf8')),form=dom.window.document.querySelector('form');cityPostalPicker(form);
 const city=form.elements.city,zip=form.elements.postalCode;
 assert.equal(city.tagName,'INPUT');assert.equal(zip.tagName,'INPUT');
 city.value='Genoa';zip.value='60135';assert.equal(city.checkValidity(),true);assert.equal(zip.checkValidity(),true);
 assert.deepEqual(postalCodesForCity('DeKalb'),['60115']);
 zip.value='6013';assert.equal(zip.checkValidity(),false);
 dom.window.close();
});
test('new ZIP survives tab recovery while frozen legacy payload is left byte-for-byte unchanged',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},recovery=requestRecovery(storage);
 const data={description:'',name:'Synthetic',phone:'5550100000',email:'a@example.invalid',street:'100 Test Street',city:'DeKalb',communityRate:'No',services:[{service:'Lawn care',task:'Mowing'}],requestKey:'11111111-1111-4111-8111-111111111111'};
 for(const value of [data,{...data,postalCode:'60115'}]){recovery.savePending(value);assert.deepEqual(recovery.read().data,value);}
});
test('public intake does not reject a genuine request only for a different Illinois ZIP',async()=>{
 const req={method:'POST',headers:{host:'example.invalid',origin:'https://example.invalid'},body:{services:[{service:'Lawn care',task:'Mowing'}],name:'Synthetic',phone:'5550100000',email:'a@example.invalid',street:'100 Test Street',city:'Genoa',postalCode:'60135',communityRate:'No'}};
 let status;const res={setHeader(){},status(v){status=v;return this;},json(v){return v;}};
 await handler(req,res);assert.notEqual(status,400);
});
