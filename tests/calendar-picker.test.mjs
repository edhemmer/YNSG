import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {localDay,addDays,appointmentSelection} from '../lib/appointment-window.js';
const source=(await readFile(new URL('../site/appointment-picker.js',import.meta.url),'utf8')).replace(/^import .*\n/gm,'');
class Element {
 children=[];hidden=false;disabled=false;dataset={};attributes={};handlers={};value='once';textContent='';
 setAttribute(k,v){this.attributes[k]=v;} getAttribute(k){return this.attributes[k];} addEventListener(k,fn){this.handlers[k]=fn;} append(el){this.children.push(el);} replaceChildren(){this.children=[];} focus(){} querySelector(){return this.children[0];}
}
async function harness(responses,{holdError=false}={}){
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const form=new Element(),picker=new Element(),window=new Element();form.querySelector=get;picker.querySelector=get;
 const sections=['.calendar-toolbar','.appointment-weekdays','#appointment-days'].map(get);picker.querySelectorAll=selector=>selector.startsWith('.calendar-toolbar')?sections:[];
 const document=new Element();document.querySelector=id=>id==='#request-form'?form:picker;document.createElement=()=>new Element();
 let calls=0,key=0;const holdCalls=[],timers=new Map();let clock=Date.now();
 class Clock extends Date {static now(){return clock;}}
 vm.runInNewContext(source,{document,window,localDay,addDays,appointmentSelection,Intl,Date:Clock,AbortController,
  selectionKey:()=>`selection-${++key}`,appointmentHold:async input=>{holdCalls.push(input);if(input.action==='release')return {ok:true};if(holdError)throw Object.assign(Error('conflict'),{status:409});return {ok:true,token:'a'.repeat(64),start:new Date(input.start).toISOString(),end:new Date(Date.parse(input.start)+7200000).toISOString(),expiresAt:new Date(clock+60000).toISOString()};},
  setTimeout:(fn,ms)=>{const id=Symbol();timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  fetch:async()=>{const r=responses[calls++];if(r instanceof Error)throw r;return r;}});
 const settle=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};await settle();
 const select=async()=>{const open=get('#appointment-days').children.find(el=>el.handlers.click&&!el.disabled);assert.ok(open);await open.handlers.click();await get('#appointment-times').children[0].handlers.click();await settle();};
 return {get,form,picker,window,document,sections,settle,select,holdCalls,advance:ms=>{clock+=ms;},calls:()=>calls};
}
const available=()=>{
 let day=addDays(localDay(),1);while([0,6].includes(new Date(day+'T12:00Z').getUTCDay()))day=addDays(day,1);
 return Response.json({reserved:false,timezone:'America/Chicago',validUntil:new Date(Date.now()+60000).toISOString(),times:[{start:day+'T15:00:00Z',end:day+'T17:00:00Z'}]});
};
test('failed check retains a disabled month grid, explains failure and enables retry',async()=>{
 const h=await harness([Response.json({error:'unavailable'},{status:503})]);
 assert.ok(h.sections.every(el=>!el.hidden));assert.ok(h.get('#appointment-days').children.length>=28);
 assert.ok(h.get('#appointment-days').children.filter(el=>el.handlers.click).every(el=>el.disabled));
 assert.match(h.get('#calendar-status').textContent,/couldn’t load/);assert.equal(h.get('#calendar-refresh').disabled,false);assert.equal(h.picker.attributes['aria-busy'],'false');
});
test('retry replaces failure with fresh dates and a canonical held time',async()=>{
 const h=await harness([Response.json({},{status:503}),available()]);await h.get('#calendar-refresh').handlers.click();await h.settle();await h.select();
 assert.match(h.get('#appointment-selection').textContent,/Selected:.*held while/);assert.ok(h.form.dataset.appointmentStart.endsWith('.000Z'));assert.equal(h.form.dataset.appointmentHoldToken,'a'.repeat(64));assert.equal(h.calls(),2);
 assert.equal(h.get('#appointment-times').children[0].attributes['aria-pressed'],'true');
});
test('lost selection never displays a held time and cancels by selection key',async()=>{
 const h=await harness([available()],{holdError:true});await h.select();assert.equal(h.form.dataset.appointmentStart,'');assert.equal(h.form.dataset.appointmentHoldToken,'');assert.equal(h.holdCalls[1].action,'release');assert.equal(h.holdCalls[0].key,h.holdCalls[1].key);assert.match(h.get('#calendar-status').textContent,/no longer available/);
});
test('page exit clears released state before navigation-cache restoration',async()=>{
 const h=await harness([available()]);await h.select();h.window.handlers.pagehide();await h.settle();assert.equal(h.form.dataset.appointmentStart,'');assert.equal(h.form.dataset.appointmentHoldToken,'');assert.equal(h.holdCalls.at(-1).action,'release');h.window.handlers.pageshow();assert.match(h.get('#appointment-selection').textContent,/arrange a time/);
});
test('returning from background detects expiry even when the timer never fired',async()=>{
 for(const event of ['pageshow','visibilitychange']){
  const h=await harness([available()]);await h.select();h.advance(61000);h.document.visibilityState='visible';(event==='pageshow'?h.window:h.document).handlers[event]();assert.equal(h.form.dataset.appointmentStart,'');assert.match(h.get('#calendar-status').textContent,/hold ended/);
 }
});
test('uncertain delivery retains selection and blocks refresh, clearing and release',async()=>{
 const h=await harness([available()]);await h.select();const start=h.form.dataset.appointmentStart;h.form.dataset.deliveryUnknown='true';h.window.handlers.pagehide();h.advance(61000);h.window.handlers.pageshow();h.get('#calendar-clear').handlers.click();h.get('#calendar-refresh').handlers.click();await h.settle();assert.equal(h.form.dataset.appointmentStart,start);assert.equal(h.holdCalls.length,1);assert.equal(h.calls(),1);
});
test('saved request never releases its reservation when leaving the page',async()=>{
 const h=await harness([available()]);await h.select();h.form.hidden=true;h.window.handlers.pagehide();assert.equal(h.holdCalls.length,1);
});
