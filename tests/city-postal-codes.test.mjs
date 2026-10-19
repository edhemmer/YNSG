import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {postalCodesForCity,cityPostalPicker} from '../site/city-postal-codes.js';
import {readFileSync} from 'node:fs';
import {requestRecovery} from '../site/request-recovery.js';
import handler from '../api/requests.js';
test('city selection offers only its configured ZIP and changing city clears an earlier ZIP',()=>{
 const dom=new JSDOM(readFileSync('site/pages/form.html','utf8')),form=dom.window.document.querySelector('form');cityPostalPicker(form);const city=form.elements.city,zip=form.elements.postalCode;
 assert.equal(zip.checkValidity(),false);
 for(const [name,code] of [['DeKalb','60115'],['Sycamore','60178'],['Cortland','60112']]){city.value=name;city.dispatchEvent(new dom.window.Event('change'));assert.equal(zip.value,'');assert.deepEqual([...zip.options].filter(o=>o.value).map(o=>o.value),[code]);zip.value=code;assert.equal(zip.checkValidity(),true);}
 city.value='';city.dispatchEvent(new dom.window.Event('change'));assert.equal(zip.value,'');assert.deepEqual(postalCodesForCity('DeKalb','GA'),[]);assert.deepEqual(postalCodesForCity('constructor'),[]);dom.window.close();
});
test('new ZIP survives tab recovery while frozen legacy payload is left byte-for-byte unchanged',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},recovery=requestRecovery(storage);
 const data={description:'',name:'Synthetic',phone:'5550100000',email:'a@example.invalid',street:'100 Test Street',city:'DeKalb',communityRate:'No',services:[{service:'Lawn care',task:'Mowing'}],requestKey:'11111111-1111-4111-8111-111111111111'};
 for(const value of [data,{...data,postalCode:'60115'}]){recovery.savePending(value);assert.deepEqual(recovery.read().data,value);}
});
test('public intake rejects a city/ZIP mismatch before contacting a provider',async()=>{
 const req={method:'POST',headers:{host:'example.invalid',origin:'https://example.invalid'},body:{services:[{service:'Lawn care',task:'Mowing'}],name:'Synthetic',phone:'5550100000',email:'a@example.invalid',street:'100 Test Street',city:'DeKalb',postalCode:'60178',communityRate:'No'}};let status;
 const res={setHeader(){},status(v){status=v;return this;},json(v){return v;}};await handler(req,res);assert.equal(status,400);
});
