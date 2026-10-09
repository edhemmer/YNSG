import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
globalThis.React=React;
const {default:Actions}=await import('../apps/web/app/request-quick-actions.tsx');
const id='40000000-0000-4000-8000-000000000001';
const proposal={id,request_id:id,status:'proposal',revision:1,start_at:'2099-10-15T13:00Z',arrival_at:'2099-10-15T13:00Z',end_at:'2099-10-15T15:00Z',expires_at:'2099-10-14T13:00Z',replaces_id:null,customer_response:'pending'};
const request={id,status:'reviewing',revision:1,created_at:'2026-10-09T12:00Z',original_submission:{name:'Synthetic Neighbor'},appointments:[proposal]};
const render=(r=request,canManage=true)=>renderToStaticMarkup(React.createElement(Actions,{request:r,canManage,organization:id,onReview(){},onChanged(){}}));
test('owner sees separate approve, decline and review actions; dispatcher gets review only',()=>{
 const owner=render();assert.match(owner,/>Approve<\/button>/);assert.match(owner,/>Decline<\/button>/);assert.match(owner,/>Review<span/);
 const dispatcher=render(request,false);assert.doesNotMatch(dispatcher,/>Approve<|>Decline</);assert.match(dispatcher,/>Review<span/);
});
test('missing or expired slots cannot be approved and confirmed visits cannot be reapproved',()=>{
 for(const appointments of [[],[{...proposal,expires_at:'2000-01-01T00:00Z'}]]){
  const html=render({...request,appointments});assert.match(html,/<button[^>]*disabled=""[^>]*>[\s\S]*?Approve<\/button>/);assert.match(html,/Choose a time in Review before approving/);
 }
 assert.doesNotMatch(render({...request,appointments:[{...proposal,status:'reserved'}]}),/>Approve<|>Decline</);
 assert.match(render({...request,appointments:[{...proposal,status:'reserved'},proposal]}),/>Approve<\/button>/);
 assert.doesNotMatch(render({...request,status:'declined'}),/>Approve<|>Decline</);
});
