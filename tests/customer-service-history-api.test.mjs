import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {serviceHistoryQuery,serviceHistory} from '../apps/web/lib/customer-service-history-contract.ts';
const org='20000000-0000-4000-8000-000000000001',customer='30000000-0000-4000-8000-000000000001';
export const report={items:[{customerId:customer,name:'Synthetic neighbor',archived:false,requestCount:26,generatedVisits:3,firstRequestedAt:'2026-01-01T12:00:00Z',lastRequestedAt:'2026-10-29T12:00:00Z',categories:[{service:'Lawn care',requestCount:26,lastRequestedAt:'2026-10-29T12:00:00Z'}],services:[{service:'Lawn care',task:'Leaf management',requestCount:26,lastRequestedAt:'2026-10-29T12:00:00Z'}],servicesMore:false}],page:0,hasMore:false,matchingCustomers:1,unlinkedRequests:2,linkedRequests:26,generatedVisits:3,checkedAt:'2026-10-30T12:00:00Z'};
function harness(result={data:report,error:null}){const calls=[],exports={};const raw=readFileSync(new URL('../apps/web/app/api/customer-service-history/route.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');const source=stripTypeScriptTypes(raw).replace(/^export /gm,'')+'\nexports.GET=GET;';runInNewContext(source,{exports,URL,Error,serviceHistoryQuery,serviceHistory,NextResponse:{json:(v,o)=>new Response(JSON.stringify(v),o)},authenticated:async()=>({db:{rpc:async(name,args)=>{calls.push({name,args});return result;}}})});return {...exports,calls};}
test('history API validates bounded queries and returns only verified, private results',async()=>{
 const h=harness();assert.equal((await h.GET(new Request('https://example.invalid/api/customer-service-history?organization=bad'))).status,400);assert.equal(h.calls.length,0);const r=await h.GET(new Request('https://example.invalid/api/customer-service-history?'+new URLSearchParams({organization:org,customer,query:'leaf management',page:'2'})));assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.deepEqual({...h.calls[0].args},{p_org:org,p_customer:customer,p_query:'leaf management',p_page:2});assert.equal(serviceHistoryQuery.safeParse({organization:org,page:10001}).success,false);assert.equal(serviceHistoryQuery.safeParse({organization:org,query:'<script>'}).success,false);
});
test('history API distinguishes denied or missing customer from outages and malformed success',async()=>{
 for(const [message,status] of [['FORBIDDEN',403],['UNAUTHORIZED',401],['NOT_FOUND',404],['connection failed',503]]){const h=harness({data:null,error:{message}});assert.equal((await h.GET(new Request('https://example.invalid/api/customer-service-history?organization='+org))).status,status);}
 const h=harness({data:{...report,items:[{...report.items[0],requestCount:-1}]},error:null});assert.equal((await h.GET(new Request('https://example.invalid/api/customer-service-history?organization='+org))).status,503);
});
