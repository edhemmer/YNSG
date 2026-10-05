import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {localDay,addDays,appointmentSelection} from '../lib/appointment-window.js';
const source=(await readFile(new URL('../site/appointment-picker.js',import.meta.url),'utf8')).replace(/^import .*\n/,'');
class Element {
 children=[];hidden=false;disabled=false;dataset={};attributes={};handlers={};value='once';textContent='';
 setAttribute(k,v){this.attributes[k]=v;} addEventListener(k,fn){this.handlers[k]=fn;} append(el){this.children.push(el);} replaceChildren(){this.children=[];} focus(){} querySelector(){return this.children[0];}
}
async function harness(responses){
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const form=new Element(),picker=new Element();form.querySelector=get;picker.querySelector=get;
 const sections=['.calendar-toolbar','.appointment-weekdays','#appointment-days'].map(get);picker.querySelectorAll=selector=>selector.startsWith('.calendar-toolbar')?sections:[];
 const document={querySelector:id=>id==='#request-form'?form:picker,createElement:()=>new Element()};
 let calls=0;vm.runInNewContext(source,{document,localDay,addDays,appointmentSelection,Intl,Date,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async()=>{const r=responses[calls++];if(r instanceof Error)throw r;return r;}});
 const settle=async()=>{for(let n=0;n<10;n++)await Promise.resolve();};await settle();return {get,picker,sections,settle,calls:()=>calls};
}
test('failed check retains a disabled month grid, explains failure and enables retry',async()=>{
 const h=await harness([Response.json({error:'unavailable'},{status:503})]);
 assert.ok(h.sections.every(el=>!el.hidden));assert.ok(h.get('#appointment-days').children.length>=28);
 assert.ok(h.get('#appointment-days').children.filter(el=>el.handlers.click).every(el=>el.disabled));
 assert.match(h.get('#calendar-status').textContent,/couldn’t load/);assert.equal(h.get('#calendar-refresh').disabled,false);assert.equal(h.picker.attributes['aria-busy'],'false');
});
test('retry replaces failure with fresh open dates and selectable times',async()=>{
 const first=addDays(localDay(),1);let day=first;while([0,6].includes(new Date(day+'T12:00Z').getUTCDay()))day=addDays(day,1);
 const start=day+'T15:00:00Z',data={reserved:false,timezone:'America/Chicago',validUntil:new Date(Date.now()+60000).toISOString(),times:[{start,end:day+'T17:00:00Z'}]};
 const h=await harness([Response.json({},{status:503}),Response.json(data)]);await h.get('#calendar-refresh').handlers.click();await h.settle();
 const open=h.get('#appointment-days').children.find(el=>el.handlers.click&&!el.disabled);assert.ok(open);open.handlers.click();assert.equal(h.get('#appointment-times').children.length,1);
 h.get('#appointment-times').children[0].handlers.click();assert.match(h.get('#appointment-selection').textContent,/Requested visit/);assert.equal(h.calls(),2);
});
