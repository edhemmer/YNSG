import {serviceCatalog} from '../site/service-catalog.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {cityPostalPicker} from '../site/city-postal-codes.js';
import {addressCheck} from '../site/address-check.js';
import {bookingJourney} from '../site/booking-journey.js';
import {requestRecovery} from '../site/request-recovery.js';
const html=readFileSync(new URL('../site/pages/form.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../site/main.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
function harness(outcomes=[],query=''){
 const dom=new JSDOM(html,{url:'https://example.invalid/request'+query}),w=dom.window,form=w.document.querySelector('form'),bodies=[];
 runInNewContext(source,{document:w.document,window:w,location:w.location,sessionStorage:w.sessionStorage,FormData:w.FormData,CustomEvent:w.CustomEvent,URLSearchParams,crypto:webcrypto,serviceCatalog,cityPostalPicker,addressCheck,bookingJourney,requestRecovery,matchMedia:()=>({matches:true}),deliverRequest:async data=>{bodies.push(JSON.stringify(data));const result=outcomes.shift();if(result instanceof Error)throw result;return {id:'11111111-1111-4111-8111-111111111111'};}});
 const click=s=>form.querySelector(s).click(),stage=()=>Number(form.querySelector('[data-stage]:not([hidden])').dataset.stage);
 return {dom,w,form,bodies,click,stage,choose:()=>click('.service-option input'),details:()=>{for(const [id,value] of Object.entries({name:'Synthetic customer',phone:'5550100999',email:'synthetic@example.invalid',street:'100 Synthetic Street',city:'DeKalb',postalCode:'60115'})){form.querySelector('#'+id).value=value;if(id==='city')form.querySelector('#city').dispatchEvent(new w.Event('change',{bubbles:true}));}},submit:async()=>{form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setImmediate(resolve));}};
}
test('real service selection and guide preserve an identical request through uncertain delivery and retry',async()=>{
 const h=harness([Error('timeout'),true]);h.choose();h.click('#booking-services-next');assert.equal(h.stage(),2);
 // The picker dispatches this after explicitly clearing any previous hold.
 h.click('#calendar-clear');h.form.dispatchEvent(new h.w.CustomEvent('appointment-selection-changed'));h.details();await h.submit();
 assert.equal(h.bodies.length,1);assert.equal(h.form.dataset.deliveryUnknown,'true');assert.equal(h.form.querySelector('#name').disabled,true);assert.equal(h.form.querySelector('button[type=submit]').disabled,false);
 h.click('[data-booking-back="2"]');assert.equal(h.stage(),3);await h.submit();assert.equal(h.bodies[1],h.bodies[0]);assert.equal(h.form.hidden,true);assert.equal(h.w.document.querySelector('#form-success').hidden,false);
 const body=JSON.parse(h.bodies[0]);assert.equal(body.services.length,1);assert.equal(body.appointmentSelection.start,null);assert.equal(body.appointmentHold,null);h.dom.window.close();
});
test('clearing saved details returns to services and final send validates required customer details',async()=>{
 const h=harness();h.choose();h.click('#booking-services-next');h.click('#calendar-clear');await h.submit();assert.equal(h.bodies.length,0);assert.equal(h.stage(),3);
 h.details();h.form.querySelector('#name').dispatchEvent(new h.w.Event('input',{bubbles:true}));assert.equal(h.form.querySelector('#clear-draft').hidden,false);
 h.click('#clear-draft');assert.equal(h.stage(),1);assert.equal(h.form.querySelector('#name').value,'');assert.equal(h.w.document.activeElement.id,'service-heading');h.click('#booking-services-next');assert.equal(h.stage(),1);h.dom.window.close();
});
test('Something else requires a meaningful note before time selection, and job selection stays bounded',()=>{
 const h=harness(),choices=[...h.form.querySelectorAll('.service-option input')];choices.at(-1).click();h.click('#booking-services-next');assert.equal(h.stage(),1);assert.equal(h.form.querySelector('#description').required,true);
 h.form.querySelector('#description').value='Synthetic custom task';h.click('#booking-services-next');assert.equal(h.stage(),2);h.click('[data-booking-back="1"]');for(const input of choices.slice(0,20))input.click();assert.equal(h.form.querySelectorAll('.service-option input:checked').length,15);assert.match(h.form.querySelector('#form-message').textContent,/up to 15/);h.dom.window.close();
});

test('combined booking review names each selected job from the shared catalog before one submission',async()=>{
 const h=harness([true]);const choices=h.form.querySelectorAll('.request-category');choices[0].querySelector('input').click();choices[1].querySelector('input').click();h.click('#booking-skip-time');
 const review=h.form.querySelector('#booking-summary');assert.equal(review.querySelectorAll('li').length,2);assert.match(review.textContent,/Help around the home: Furniture assembly/);assert.match(review.textContent,/Lawn care: Mowing/);assert.match(review.textContent,/One combined request/);h.details();await h.submit();assert.equal(h.bodies.length,1);const body=JSON.parse(h.bodies[0]);assert.equal(body.services.length,2);for(const item of body.services)assert.ok(serviceCatalog[item.service].includes(item.task));h.dom.window.close();
});

test('homepage categories open exact groups without selecting unrequested jobs',()=>{
 const h=harness([], '?category=Lawn+care&category=Help+around+the+home&category=Invalid');
 assert.equal(h.form.querySelectorAll('.request-category[open]').length,2);
 assert.equal(h.form.querySelectorAll('.service-option input:checked').length,0);
 h.click('#booking-services-next');assert.equal(h.stage(),1);assert.equal(h.bodies.length,0);h.dom.window.close();
});
