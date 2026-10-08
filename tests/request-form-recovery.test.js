import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const main=readFileSync(new URL('../site/main.js',import.meta.url),'utf8');
const source=main.slice(main.indexOf("  let requestKey=''"),main.indexOf('\n}\nconst motion='));
function harness(outcomes){
 const button={disabled:false,tabIndex:0,firstChild:{textContent:''}},field={disabled:false,tabIndex:0},alreadyDisabled={disabled:true,tabIndex:0},heading={tabIndex:0};
 const emailLink={},fallback={hidden:true,querySelector:()=>emailLink},message={textContent:'',focus(){}},events=[];
 const form={dataset:{appointmentStart:'2026-10-12T15:00:00.000Z',appointmentHoldToken:'a'.repeat(64),appointmentClientKey:'client'},hidden:false,attributes:{},fields:{name:'Synthetic',email:'synthetic@example.invalid',visitMode:'once'},
  addEventListener(_event,fn){this.submit=fn;},querySelector:s=>s==='button[type=submit]'?button:fallback,querySelectorAll:()=>[button,field,alreadyDisabled,heading],setAttribute(k,v){this.attributes[k]=v;},reportValidity:()=>true,dispatchEvent:e=>events.push(e.type)};
 const bodies=[];let keys=0;
 runInNewContext(source,{form,message,selected:new Map([['job',{service:'Lawn care',task:'Leaf management'}]]),groups:{querySelector:()=>({focus(){}})},newRequestKey:()=>`key-${++keys}`,FormData:class {constructor(f){return Object.entries(f.fields);}},requestErrorMessage:()=> 'Please try again.',document:{querySelector:()=>({hidden:true,querySelector:()=>({setAttribute(){},focus(){}})})},CustomEvent:class {constructor(type){this.type=type;}},deliverRequest:async data=>{bodies.push(JSON.stringify(data));const value=outcomes.shift();if(value instanceof Error)throw value;}});
 return {form,button,field,alreadyDisabled,heading,message,bodies,events,submit:()=>form.submit({preventDefault(){}})};
}
test('unknown submission freezes editing but keeps an identical-payload retry available',async()=>{
 const h=harness([Error('timeout'),Error('timeout'),true]);await h.submit();assert.equal(h.field.disabled,true);assert.equal(h.heading.tabIndex,-1);assert.equal(h.button.disabled,false);assert.match(h.button.firstChild.textContent,/Try sending again/);assert.match(h.message.textContent,/details are kept/);
 h.form.fields.name='Changed after timeout';h.form.dataset.appointmentStart='';await h.submit();await h.submit();assert.equal(h.bodies.length,3);assert.equal(new Set(h.bodies).size,1);assert.equal(h.form.hidden,true);assert.equal(h.field.disabled,false);assert.equal(h.heading.tabIndex,0);assert.equal(h.alreadyDisabled.disabled,true);
});
test('definitive conflict restores original controls and refreshes the calendar',async()=>{
 const h=harness([Error('timeout'),Object.assign(Error('conflict'),{status:409}),true]);await h.submit();await h.submit();assert.equal(h.field.disabled,false);assert.equal(h.alreadyDisabled.disabled,true);assert.equal(h.heading.tabIndex,0);assert.equal(h.form.dataset.deliveryUnknown,'false');assert.deepEqual(h.events,['appointment-conflict']);h.form.fields.name='Corrected';await h.submit();assert.notEqual(h.bodies[2],h.bodies[1]);assert.match(h.bodies[2],/Corrected/);
});
