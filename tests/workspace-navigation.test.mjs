import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readWorkspaceRoute,workspaceRouteUrl,workspaceSectionAllowed,createWorkspaceHistory} from '../apps/web/lib/workspace-navigation.ts';
const org='20000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002',id='50000000-0000-4000-8000-000000000001';
const members=[{organization_id:org,role:'owner'},{organization_id:other,role:'bookkeeper'}];
test('deep links retain an authorized company and only valid selected records for their section',()=>{
 for(const section of ['Work','Requests','Customers','Money']){
  const route=readWorkspaceRoute(new URL(`https://example.invalid/owner?section=${section}&request=${id}&customer=${id}&organization=${org}`),members);
  assert.equal(route.organization,org);assert.equal(route.request,['Work','Requests'].includes(section)?id:null);assert.equal(route.customer,section==='Customers'?id:null);
  const url=workspaceRouteUrl(new URL('https://example.invalid/owner?google=connected&setup=google'),route);
  assert.deepEqual(readWorkspaceRoute(url,members),route);assert.equal(url.searchParams.has('google'),false);assert.equal(url.searchParams.has('setup'),false);
 }
 assert.equal(readWorkspaceRoute(new URL('https://example.invalid/owner?section=Work&request=------------------------------------'),members).request,null);
 assert.equal(readWorkspaceRoute(new URL('https://example.invalid/owner?organization=foreign'),members,other).organization,other);
});
test('revoked and unknown roles cannot use URL values to gain owner screens',()=>{
 for(const [role,home] of [['dispatcher','Requests'],['bookkeeper','Money'],['technician','Today'],['unknown','Dashboard']]){
  const route=readWorkspaceRoute(new URL('https://example.invalid/owner?section=Settings&request='+id),[{organization_id:org,role}]);assert.equal(route.section,home);assert.equal(route.request,null);
  assert.equal(workspaceSectionAllowed('Settings',role),false);
 }
 assert.equal(workspaceSectionAllowed('Work',undefined),false);assert.equal(workspaceSectionAllowed('Invalid','owner'),false);
});
const moved=window=>new Promise(resolve=>window.addEventListener('popstate',()=>resolve(),{once:true}));
test('canceling browser Back restores the cursor and preserves earlier and Forward destinations',async()=>{
 const dom=new JSDOM('',{url:'https://example.invalid/owner?section=Requests'}),w=dom.window;
 let blocked=false,screen='Requests';
 const history=createWorkspaceHistory(w,url=>{if(blocked)return false;screen=url.searchParams.get('section');return true;});
 const push=(section)=>{history.push(new URL('https://example.invalid/owner?section='+section));screen=section;};
 try{
  push('Calendar');push('Work');blocked=true;
  // The first pop is the attempted Back; the second restores Work without a new entry.
  const restored=new Promise(resolve=>{let count=0;const listen=()=>{if(++count===2){w.removeEventListener('popstate',listen);resolve();}};w.addEventListener('popstate',listen);});
  w.history.back();await restored;assert.equal(screen,'Work');assert.equal(new URL(w.location.href).searchParams.get('section'),'Work');assert.equal(w.history.length,3);
  blocked=false;let next=moved(w);w.history.back();await next;assert.equal(screen,'Calendar');next=moved(w);w.history.back();await next;assert.equal(screen,'Requests');next=moved(w);w.history.forward();await next;assert.equal(screen,'Calendar');next=moved(w);w.history.forward();await next;assert.equal(screen,'Work');
 }finally{history.dispose();w.close();}
});
test('same screen does not create extra history and replacement retains the history cursor',()=>{
 const dom=new JSDOM('',{url:'https://example.invalid/owner?section=Work'}),w=dom.window,history=createWorkspaceHistory(w,()=>true);
 try{history.push(new URL(w.location.href));assert.equal(w.history.length,1);history.replace(new URL('https://example.invalid/owner?section=Money'));assert.equal(w.history.length,1);history.push(new URL('https://example.invalid/owner?section=Calendar'));assert.equal(w.history.length,2);}finally{history.dispose();w.close();}
});
