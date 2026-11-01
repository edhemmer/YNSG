import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';

const dom=new JSDOM('<div id="root"></div>',{url:'https://example.invalid/owner'});
for(const key of ['window','document','HTMLElement','Event','MouseEvent'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
const {default:PreparedCustomerReply}=await import('../apps/web/app/prepared-customer-reply.tsx');
const detail=readFileSync(new URL('../apps/web/app/request-detail.tsx',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../apps/web/app/service-workflow.tsx',import.meta.url),'utf8');

test('prepared customer reply is editable, review-only and cannot transmit automatically',async()=>{
 const root=createRoot(document.querySelector('#root'));
 const copied=[];
 Object.defineProperty(globalThis.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied.push(text);}}});
 try{
  await act(async()=>root.render(React.createElement(PreparedCustomerReply,{recipient:'example@example.invalid',draft:{subject:'Follow-up',body:'No appointment confirmed.',status:'draft',requiresOwnerApproval:true}})));
  const box=document.querySelector('.prepared-customer-reply');
  assert.ok(box);
  assert.match(box.textContent,/Not sent/);
  assert.equal(box.querySelectorAll('button').length,1);
  assert.equal(copied.length,0);
  await act(async()=>box.querySelector('button').click());
  assert.equal(copied.length,1);
  assert.match(copied[0],/To: example@example.invalid/);
  assert.match(copied[0],/No appointment confirmed/);
  assert.match(box.textContent,/Review the recipient, details/);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});

test('prepared response is only shown for open unconfirmed owner-reviewed requests',()=>{
 assert.match(detail,/request&&canManage&&!confirmed&&openRequest\?prepareCustomerFollowUp\(request\):null/);
 assert.match(detail,/preparedReply&&submission.email&&<PreparedCustomerReply/);
 assert.match(detail,/key=\{organization\+':'\+request.id\+':'\+request.revision\}/);
 assert.doesNotMatch(detail,/preparedReply.*(?:sendFrozenCommand|command\()/);
});

test('scheduling and invoice preparation stay at the canonical decision points',()=>{
 assert.match(workflow,/Prepared scheduling check/);
 assert.match(workflow,/action.action==='schedule'/);
 assert.match(workflow,/action.action==='invoice'/);
 assert.match(workflow,/No invoice has been issued by this suggestion/);
 assert.match(workflow,/<InvoiceDraft/);
 assert.match(workflow,/<SchedulingReviewPanel/);
});
