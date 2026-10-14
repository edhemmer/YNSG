import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {bookingJourney} from '../site/booking-journey.js';
const html=await readFile(new URL('../site/pages/form.html',import.meta.url),'utf8');
function harness({pending=false}={}){
 const dom=new JSDOM(html,{url:'https://example.invalid/request'}),form=dom.window.document.querySelector('form');let jobs=[];
 form.dataset.deliveryUnknown=pending?'true':'false';
 const journey=bookingJourney({form,services:()=>jobs,requestData:()=>Object.fromEntries(new dom.window.FormData(form))});
 form.querySelector('#calendar-clear').addEventListener('click',()=>{form.dataset.appointmentStart='';form.dataset.appointmentHoldToken='';form.querySelector('#preferredTime').value='';form.dispatchEvent(new dom.window.CustomEvent('appointment-selection-changed'));});
 const click=id=>form.querySelector(id).click(),stage=()=>Number([...form.querySelectorAll('[data-stage]')].find(s=>!s.hidden).dataset.stage),held=()=>{form.dataset.appointmentStart='2030-10-16T15:00:00Z';form.dataset.appointmentHoldToken='synthetic';form.querySelector('#preferredTime').value='2030-10-16 at 10:00';form.dispatchEvent(new dom.window.CustomEvent('appointment-selection-changed'));};
 return {dom,form,journey,click,stage,held,select:()=>{jobs=[{service:'Lawn care',task:'Leaf management'}];}};
}
test('guided customer cannot skip services or pretend an unheld time is selected',()=>{
 const h=harness();assert.equal(h.stage(),1);h.click('#booking-services-next');assert.equal(h.stage(),1);assert.match(h.form.querySelector('#form-message').textContent,/Choose at least one/);
 h.select();h.click('#booking-services-next');assert.equal(h.stage(),2);assert.equal(h.form.querySelector('#booking-time-next').disabled,true);
 h.held();assert.equal(h.form.querySelector('#booking-time-next').disabled,false);h.click('#booking-time-next');assert.equal(h.stage(),3);
 h.form.querySelector('#name').value='Synthetic customer';h.click('[data-booking-back="2"]');assert.equal(h.stage(),2);h.click('#booking-time-next');assert.equal(h.form.querySelector('#name').value,'Synthetic customer');h.dom.window.close();
});
test('arrange-time path explicitly clears a previous selection and leads directly to contact details',()=>{
 const h=harness();h.select();h.click('#booking-services-next');h.held();h.click('#calendar-clear');assert.equal(h.stage(),3);assert.equal(h.form.dataset.appointmentStart,'');assert.match(h.form.querySelector('#booking-summary').textContent,/arrange a time/);h.dom.window.close();
});
test('expired held time returns to time selection without discarding contact entries or silently choosing a fallback',()=>{
 const h=harness();h.select();h.click('#booking-services-next');h.held();h.click('#booking-time-next');h.form.querySelector('#phone').value='5550100999';h.form.dataset.appointmentStart='';h.form.dataset.appointmentHoldToken='';h.form.dispatchEvent(new h.dom.window.CustomEvent('appointment-selection-changed'));
 assert.equal(h.stage(),2);assert.equal(h.form.querySelector('#phone').value,'5550100999');assert.equal(h.form.querySelector('#booking-time-next').disabled,true);h.dom.window.close();
});
test('unknown delivery recovery keeps the final stage and prevents navigation or selection changes',()=>{
 const h=harness({pending:true});assert.equal(h.stage(),3);h.click('[data-booking-back="2"]');assert.equal(h.stage(),3);h.click('#calendar-clear');assert.equal(h.stage(),3);assert.ok([...h.form.querySelectorAll('[data-booking-step]')].every(b=>b.disabled));h.dom.window.close();
});
test('invalid details become visible and Enter advances the current step rather than submitting early',()=>{
 const h=harness();h.select();let submissions=0;h.form.addEventListener('submit',()=>submissions++);const event=new h.dom.window.Event('submit',{cancelable:true,bubbles:true});h.form.dispatchEvent(event);assert.equal(h.stage(),2);assert.equal(submissions,0);assert.equal(event.defaultPrevented,true);
 h.held();h.click('#booking-time-next');h.click('[data-booking-back="2"]');h.form.querySelector('#name').dispatchEvent(new h.dom.window.Event('invalid',{cancelable:true}));assert.equal(h.stage(),3);h.dom.window.close();
});
