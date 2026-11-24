import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid/owner'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','Event','MouseEvent'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.scrollTo=()=>{};
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),React=require('react');globalThis.React=React;const {act}=React,{createRoot}=require('react-dom/client');
const {GUIDES}=await import('../apps/web/lib/home-repair-guides.ts');const {COACH,GLOSSARY}=await import('../apps/web/lib/home-repair-coach.ts');
const {default:Library}=await import('../apps/web/app/repair-guide-library.tsx');

test('coaching targets real guides and real step numbers, with substance',()=>{
 assert.equal(Object.keys(COACH).length,GUIDES.length,'every guide is coached');
 for(const [id,c] of Object.entries(COACH)){
  const g=GUIDES.find(x=>x.id===id);assert.ok(g,'real guide '+id);
  for(const [i,s] of Object.entries(c.steps||{})){assert.ok(g.steps[Number(i)],id+' step '+i+' exists');assert.ok(s.see||s.help||s.avoid||s.careful,id+' step '+i+' has coaching');}
  assert.ok((c.mistakes||[]).length>=3,id+' mistakes');
  assert.ok(Object.keys(c.steps||{}).length>=2,id+' coached steps');
 }
 assert.equal(new Set(GLOSSARY.map(w=>w.term)).size,GLOSSARY.length);
});

test('a coached guide shows before-you-start, color-coded step help, mistakes and plain words, with no checklists',async()=>{
 const node=document.querySelector('#root'),root=createRoot(node);
 try{
  await act(async()=>root.render(React.createElement(Library,{})));
  const card=[...node.querySelectorAll('button.repair-card')].find(b=>/Patch|hole/i.test(b.querySelector('strong')?.textContent||'')&&/drywall/i.test(b.textContent));assert.ok(card,'drywall card');
  await act(async()=>{card.click();});
  const t=node.textContent;
  assert.match(t,/Before you start/);assert.match(t,/You should see/);assert.match(t,/Hand-holding/);assert.match(t,/Avoid/);assert.match(t,/Common mistakes/);assert.match(t,/Bring/);assert.match(t,/Plain words/);
  assert.ok(node.querySelector('.repair-meter'));assert.equal(node.querySelectorAll('input[type=checkbox]').length,0,'reference guide has no checklists');assert.doesNotMatch(t,/Confirm before you leave/);
  }finally{await act(async()=>root.unmount());}
});
