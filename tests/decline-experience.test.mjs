import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid/owner'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','Event','MouseEvent','FormData'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),React=require('react');globalThis.React=React;const {act}=React,{createRoot}=require('react-dom/client');
const {DeclineDecisionFields}=await import('../apps/web/app/decline-message-fields.tsx');const {default:Reply}=await import('../apps/web/app/request-reply-draft.tsx');
const node=document.querySelector('#root');async function select(el,value){await act(async()=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));});}
test('time decision offers only time/custom, service decision offers all reasons and editable message',async()=>{
 const root=createRoot(node);try{await act(async()=>root.render(React.createElement('form',{},React.createElement(DeclineDecisionFields,{proposal:true,organization:'a933d657-14d3-46b6-85e6-21d973e4ed97'}))));
 assert.equal(node.querySelector('select').value,'decline_service');await select(node.querySelector('select'),'decline_time');assert.equal(node.querySelectorAll('select')[1].options.length,3);assert.equal(node.querySelector('form').checkValidity(),false);
 await select(node.querySelectorAll('select')[1],'time');assert.match(node.querySelector('textarea').value,/not available/);assert.equal(node.querySelector('form').checkValidity(),true);
 await select(node.querySelector('select'),'decline_service');assert.equal(node.querySelectorAll('select')[1].options.length,5);assert.equal(node.querySelector('textarea').value,'');
 await select(node.querySelectorAll('select')[1],'service');assert.match(node.querySelector('textarea').value,/outside the services/);assert.match(node.textContent,/future project/);
 await select(node.querySelectorAll('select')[1],'other');assert.equal(node.querySelector('textarea').value,'');assert.equal(node.querySelector('form').checkValidity(),false);
 }finally{await act(async()=>root.unmount());}
});
test('existing lead reply opens only an encoded mail draft; reason change and copy fallback do not fetch',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('No network allowed');};const root=createRoot(node);try{await act(async()=>root.render(React.createElement(Reply,{name:'Synthetic Customer',email:'test@example.invalid',organization:'a933d657-14d3-46b6-85e6-21d973e4ed97'})));
 const href=node.querySelector('a').href;assert.match(href,/^mailto:/);assert.match(new URL(href).searchParams.get('body'),/outside the services/);
 await select(node.querySelector('select'),'area');assert.match(new URL(node.querySelector('a').href).searchParams.get('body'),/outside the area/);
 await act(async()=>node.querySelector('button').click());assert.match(node.textContent,/copy it manually/);assert.equal(calls,0);
 }finally{await act(async()=>root.unmount());}
});
test('quick decline freezes the selected wording after an unknown result and retries the identical command',async()=>{
 const {default:Quick}=await import('../apps/web/app/request-quick-actions.tsx');const bodies=[];let changed=0;
 globalThis.fetch=async(_url,init)=>{bodies.push(init.body);return new Response(JSON.stringify(bodies.length===1?{error:'Unknown'}:{ok:true,result:{id:'50000000-0000-4000-8000-000000000001',revision:2,status:'declined'}}),{status:bodies.length===1?503:200});};
 const root=createRoot(node);try{await act(async()=>root.render(React.createElement(Quick,{organization:'a933d657-14d3-46b6-85e6-21d973e4ed97',request:{id:'50000000-0000-4000-8000-000000000001',status:'submitted',revision:1,appointments:[],original_submission:{name:'Synthetic'}},canManage:true,onReview(){},onChanged(){changed++;}})));
 await act(async()=>[...node.querySelectorAll('button')].find(b=>b.textContent==='Decline request').click());await select(node.querySelector('select'),'service');
 await act(async()=>node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 assert.match(node.textContent,/Check saved decline/);assert.equal(node.querySelector('fieldset').disabled,true);assert.equal(changed,0);
 await act(async()=>node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1]);assert.match(JSON.parse(bodies[0]).reason,/outside the services/);assert.equal(changed,1);
 }finally{await act(async()=>root.unmount());}
});
