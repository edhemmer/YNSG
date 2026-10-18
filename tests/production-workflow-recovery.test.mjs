import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid/owner'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLFormElement','Event','MouseEvent','FormData'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),React=require('react');globalThis.React=React;
const {act}=React,{createRoot}=require('react-dom/client');
const {EntrySafety,useEntrySafety}=await import('../apps/web/app/entry-safety.tsx');
const {default:Mileage}=await import('../apps/web/app/mileage-activity.tsx');
const {default:Settings}=await import('../apps/web/app/company-settings.tsx');
const {default:Delivery}=await import('../apps/web/app/invoice-delivery.tsx');
const {default:Delegates}=await import('../apps/web/app/customer-delegates.tsx');
const {default:Export}=await import('../apps/web/app/customer-export.tsx');
const org='20000000-0000-4000-8000-000000000001',id='30000000-0000-4000-8000-000000000001',other='30000000-0000-4000-8000-000000000002';
const node=document.querySelector('#root'),tick=()=>new Promise(resolve=>setImmediate(resolve));
const response=(data,status=200)=>Response.json(data,{status});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const button=text=>[...node.querySelectorAll('button')].find(b=>b.textContent===text);
async function click(text){await act(async()=>{assert.ok(button(text),text);button(text).click();await tick();await tick();});}
async function fill(label,value){const field=[...node.querySelectorAll('label')].find(l=>l.textContent.startsWith(label))?.querySelector('input,textarea,select');assert.ok(field,label);await act(async()=>{Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field),'value').set.call(field,value);field.dispatchEvent(new window.Event(field instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});}
async function mount(Component,props){let leave;function Probe(){leave=useEntrySafety().canLeave;return null;}const root=createRoot(node);const render=async p=>act(async()=>{root.render(React.createElement(EntrySafety,null,React.createElement(Probe),React.createElement(Component,p)));await tick();await tick();});window.confirm=()=>false;await render(props);return {render,leave:()=>leave(),close:()=>act(async()=>root.unmount())};}
function report(path){const q=new URL(String(path),'https://example.invalid').searchParams;return {from:q.get('from'),to:q.get('to'),page:Number(q.get('page')),trips:[],businessMiles:0,activeTrips:0,hasMore:false};}
async function tripDraft(){for(const [name,value] of [['Purpose','Synthetic business trip'],['Starting location','10 Test Street'],['Destination','20 Test Street'],['Vehicle','Test truck'],['Odometer start','100'],['Odometer end','120']])await fill(name,value);}

test('mileage refresh cannot clear uncertain attempt; replay keeps the same trip/key and blocks double submit',async()=>{
 const bodies=[];let reads=0;
 globalThis.fetch=async(path,init)=>{if(!init?.method){reads++;return response(report(path));}bodies.push(init.body);if(bodies.length===1)return response({error:'lost'},503);const v=JSON.parse(init.body);return response({result:{id:v.entry.id,miles:20,businessMiles:20,reversed:false}});};
 const h=await mount(Mileage,{organization:org,timezone:'America/Chicago'});
 try{await tripDraft();await act(async()=>{node.querySelector('form').requestSubmit();node.querySelector('form').requestSubmit();await tick();});assert.equal(bodies.length,1);assert.equal(h.leave(),false);await click('Refresh trips');assert.ok(reads>=2);assert.ok(button('Check same saved trip attempt'));assert.equal(node.querySelector('form fieldset').disabled,true);await click('Check same saved trip attempt');assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1]);assert.match(node.textContent,/Mileage record saved/);assert.equal(h.leave(),true);}finally{await h.close();}
});
test('mileage rejects mismatched command receipts and malformed private reports',async()=>{
 let bad=false;globalThis.fetch=async(path,init)=>init?.method?response({result:{id:other,miles:20,businessMiles:20,reversed:false}}):response({...report(path),...(bad?{businessMiles:-1}:{})});
 const h=await mount(Mileage,{organization:org,timezone:'America/Chicago'});
 try{await tripDraft();await act(async()=>{node.querySelector('form').requestSubmit();await tick();});assert.ok(button('Check same saved trip attempt'));bad=true;await click('Refresh trips');assert.match(node.textContent,/Trip records could not be confirmed/);assert.equal(button('Export visible trip page (CSV)').disabled,true);assert.equal(h.leave(),false);}finally{await h.close();}
});

const settings={schemaVersion:1,displayName:'Synthetic',sellerLegalName:'Synthetic Seller',timezone:'America/Chicago',currency:'USD',region:'IL',policyVersion:'test',privacyVersion:'test',cities:['DeKalb'],brand:{navy:'#10283c',forest:'#315842',gold:'#edbd6b',cream:'#f8f6ef',ownerName:null,logoUrl:'https://example.invalid/logo.jpg'},sender:'owner@example.invalid',notificationRecipient:'owner@example.invalid',intakeEnabled:false,hourly:{standardCents:6000,communityCents:4500,minimumMinutes:120,incrementMinutes:30,partialExtension:null},scheduling:{weekdays:[1,2,3,4,5],earliestStart:480,latestStart:900,endOfDay:1020,bufferMinutes:30,selectionMinutes:10,proposalMinutes:120,leadMinutes:1440,horizonMinutes:43200,pendingLimit:1},sellerVerified:false,invoiceTerms:null,taxTreatmentVerified:false,laborTaxTreatment:'unreviewed',review:{enabled:false,url:null}};
const config=()=>response({ready:true,configuration:{version:1,settings},catalog:[]});
test('settings protect edits before preview and freeze every fieldset after an uncertain publish',async()=>{
 const bodies=[];globalThis.fetch=async(_path,init)=>{if(!init?.method)return config();bodies.push(init.body);if(bodies.length===1)return response({error:'unknown'},503);return response({ok:true,result:{version:2}});};
 const h=await mount(Settings,{organization:org,name:'Synthetic'});
 try{assert.equal(h.leave(),true);await fill('Business name','Updated Synthetic Seller');assert.equal(h.leave(),false);await act(async()=>{node.querySelector('form').requestSubmit();await tick();});await act(async()=>{button('Publish reviewed settings').click();button('Publish reviewed settings').click();await tick();});assert.equal(bodies.length,1);assert.ok(button('Check saved settings result'));assert.ok([...node.querySelectorAll('fieldset')].every(f=>f.matches(':disabled')));await click('Check saved settings result');assert.equal(bodies[1],bodies[0]);assert.equal(h.leave(),true);}finally{await h.close();}
});
test('settings read outage offers a retry rather than pretending no configuration exists',async()=>{
 let fail=true;globalThis.fetch=async()=>fail?response({error:'unavailable'},503):config();const h=await mount(Settings,{organization:org,name:'Synthetic'});
 try{assert.ok(button('Retry loading company settings'));assert.equal(button('Review YNSG settings template'),undefined);fail=false;await click('Retry loading company settings');assert.ok(node.querySelector('[name=sellerLegalName]'));}finally{await h.close();}
});
test('late settings publication cannot update another company',async()=>{
 const pending=deferred();globalThis.fetch=async(_path,init)=>init?.method?pending.promise:config();const h=await mount(Settings,{organization:org,name:'Synthetic'});
 try{await fill('Business name','Pending Synthetic Seller');await act(async()=>{node.querySelector('form').requestSubmit();await tick();});await act(async()=>button('Publish reviewed settings').click());await h.render({organization:other,name:'Other'});await act(async()=>{pending.resolve(response({ok:true,result:{version:2}}));await tick();});assert.equal(node.querySelector('[name=sellerLegalName]').value,'Synthetic Seller');assert.doesNotMatch(node.textContent,/version 2 published/);}finally{await h.close();}
});
test('invoice delivery locks an uncertain send, rejects malformed receipts, and preserves exact retry',async()=>{
 const bodies=[];globalThis.fetch=async(_path,init)=>{if(!init?.method)return response({enabled:true,recipient:'customer@example.invalid',status:'not_requested',paidStatus:'not_queued'});bodies.push(init.body);return bodies.length===1?response({delivery:{id:'invalid',status:'accepted'}}):response({delivery:{id,status:'pending'}});};const h=await mount(Delivery,{organization:org,invoice:id});
 try{await act(async()=>node.querySelector('input[type=checkbox]').click());await act(async()=>{button('Send invoice & PDF').click();button('Send invoice & PDF').click();await tick();await tick();});assert.equal(bodies.length,1);assert.equal(h.leave(),false);await click('Check saved email request');assert.equal(bodies[1],bodies[0]);assert.equal(h.leave(),true);assert.doesNotMatch(node.textContent,/Delivery: Delivered/);}finally{await h.close();}
});
test('late delegate permission change cannot appear on another customer',async()=>{
 const pending=deferred();globalThis.fetch=async(_path,init)=>init?.method?pending.promise:response({delegates:[{user:id,email:'delegate@example.invalid',canApprove:false,canViewBilling:false,revoked:false,expired:false}]});const h=await mount(Delegates,{organization:org,customer:id});
 try{window.confirm=()=>true;await act(async()=>button('Allow approval').click());await h.render({organization:org,customer:other});await act(async()=>{pending.resolve(response({result:{customer:id,user:id}}));await tick();});assert.doesNotMatch(node.textContent,/access change was saved|outcome could not be confirmed/);}finally{await h.close();}
});
test('customer export cannot download a previous customer after selection changes',async()=>{
 const pending=deferred();let downloads=0;const saved=URL.createObjectURL;URL.createObjectURL=()=>{downloads++;return 'blob:synthetic';};globalThis.fetch=async()=>pending.promise;const h=await mount(Export,{organization:org,customer:id});
 try{await act(async()=>button('Download customer record').click());await h.render({organization:org,customer:other});await act(async()=>{pending.resolve(response({format:'ynsg-customer-record-v1',organization:org,customer:{id},requests:[],history:[]}));await tick();await tick();});assert.equal(downloads,0);}finally{URL.createObjectURL=saved;await h.close();}
});

const {default:ImportPreview}=await import('../apps/web/app/customer-import-preview.tsx');
async function selectFile(snapshot){const field=node.querySelector('input[type=file]');Object.defineProperty(field,'files',{configurable:true,value:[{size:200,text:async()=>JSON.stringify(snapshot)}]});await act(async()=>{field.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();await tick();});}
test('customer import freezes file and navigation until exact receipt confirms all additions',async()=>{
 const bodies=[];const contacts=[{name:'Synthetic One',email:'one@example.invalid',phone:'',relationship:'Owner'},{name:'Synthetic Two',email:'two@example.invalid',phone:'',relationship:'Family'}];
 globalThis.fetch=async(path,init)=>{if(String(path).includes('preview'))return response({previewOnly:true,customerId:id,currentRevision:4,customerNameMatches:true,contacts:contacts.map(value=>({name:value.name,status:'proposed',value})),properties:[],writeCount:0});bodies.push(init.body);return bodies.length===1?response({error:'unknown'},503):response({result:{saved:true,customer:id,revision:6,contactsAdded:2,propertiesAdded:0}});};
 const h=await mount(ImportPreview,{organization:org,customer:id});
 try{await selectFile({format:'ynsg-customer-record-v1',organization:org,customer:{id}});window.confirm=()=>true;await act(async()=>{button('Import proposed new records').click();button('Import proposed new records').click();await tick();});assert.equal(bodies.length,1);assert.equal(node.querySelector('input[type=file]').disabled,true);assert.equal(h.leave(),false);await click('Check same saved import attempt');assert.equal(bodies[1],bodies[0]);assert.match(node.textContent,/contacts and addresses were saved/);assert.equal(h.leave(),true);}finally{await h.close();}
});
test('customer import drops a late preview after customer selection changes',async()=>{
 const pending=deferred();globalThis.fetch=async()=>pending.promise;const h=await mount(ImportPreview,{organization:org,customer:id});
 try{await selectFile({format:'ynsg-customer-record-v1',organization:org,customer:{id}});await h.render({organization:org,customer:other});await act(async()=>{pending.resolve(response({previewOnly:true,customerId:id,currentRevision:4,customerNameMatches:true,contacts:[],properties:[],writeCount:0}));await tick();});assert.equal(button('Import proposed new records'),undefined);assert.doesNotMatch(node.textContent,/Current customer revision/);}finally{await h.close();}
});

test('malformed settings response fails closed with retry rather than rendering broken controls',async()=>{
 globalThis.fetch=async()=>response({ready:true,configuration:{version:1,settings:{displayName:'Incomplete'}},catalog:[]});const h=await mount(Settings,{organization:org,name:'Synthetic'});
 try{assert.ok(button('Retry loading company settings'));assert.equal(node.querySelector('form'),null);}finally{await h.close();}
});
const {default:RepeatRequest}=await import('../apps/web/app/account/repeat-request.tsx');
const repeatContext={contacts:[{id,customer_id:id,name:'Synthetic Customer',email:'customer@example.invalid',phone:'5550100001'}],properties:[{id,customer_id:id,street:'10 Synthetic Street',city:'DeKalb',region:'IL'}],services:[{name:'Lawn care',scope:'Synthetic lawn work'}]};
test('repeat request recovers a failed context read and preserves known save if async overview refresh fails',async()=>{
 let reads=0,writes=0;globalThis.fetch=async(_path,init)=>{if(init?.method){writes++;return response({request:{id}});}reads++;return reads===1?response({error:'unavailable'},503):response(repeatContext);};const h=await mount(RepeatRequest,{organization:org,onSaved:async()=>{throw Error('overview unavailable');}});
 try{await click('Retry loading saved details');await act(async()=>node.querySelector('input[type=checkbox]').click());await act(async()=>{node.querySelector('form').requestSubmit();node.querySelector('form').requestSubmit();await tick();await tick();});assert.equal(writes,1);assert.match(node.textContent,/Your request is saved/);assert.match(node.textContent,/overview could not refresh/);assert.equal(button('Check saved request result'),undefined);assert.equal(h.leave(),true);}finally{await h.close();}
});

test('company change can read mileage while a previous company save is pending',async()=>{
 const pending=deferred();globalThis.fetch=async(path,init)=>init?.method?pending.promise:response(report(path));const h=await mount(Mileage,{organization:org,timezone:'America/Chicago'});
 try{await tripDraft();await act(async()=>node.querySelector('form').requestSubmit());await h.render({organization:other,timezone:'America/Chicago'});assert.equal(button('Refresh trips').disabled,false);assert.equal(node.querySelector('form fieldset').disabled,false);await act(async()=>{pending.resolve(response({error:'old unknown'},503));await tick();});assert.equal(button('Check same saved trip attempt'),undefined);assert.equal(button('Refresh trips').disabled,false);}finally{await h.close();}
});
test('delegate read denial clears private rows and blocks permission changes',async()=>{
 let denied=false;globalThis.fetch=async()=>denied?response({error:'forbidden'},403):response({delegates:[{user:id,email:'delegate@example.invalid',canApprove:false,canViewBilling:false,revoked:false,expired:false}]});const h=await mount(Delegates,{organization:org,customer:id});
 try{assert.match(node.textContent,/delegate@example.invalid/);denied=true;await click('Refresh account access');assert.doesNotMatch(node.textContent,/delegate@example.invalid/);assert.equal(button('Allow approval'),undefined);}finally{await h.close();}
});
