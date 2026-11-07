import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {leadSources} from '../site/lead-sources.js';
import {leadSourceOptions,requestInput} from '../packages/contracts/index.ts';
import {ownerRequestEmail} from '../lib/owner-request-email.js';

test('lead source list is identical across site, contract, form and database migration',async()=>{
 assert.deepEqual([...leadSourceOptions],[...leadSources]);
 const form=new JSDOM(await readFile('site/pages/form.html','utf8')).window.document;
 const options=[...form.querySelectorAll('select#leadSource option')].map(o=>o.textContent);
 assert.equal(options[0],'Choose one');assert.deepEqual(options.slice(1),[...leadSources]);
 assert.equal(form.querySelector('select#leadSource').required,false);
 assert.match(form.querySelector('label[for="leadSource"]').textContent,/How did you hear about us\?/);
 const migration=await readFile('supabase/migrations/20261106150000_request_lead_source.sql','utf8');
 const sql=migration.match(/not in \(([^)]*)\) then raise exception 'VALIDATION'/)[1].split(/','/).map(x=>x.replace(/^'|'$/g,''));
 assert.deepEqual(sql,[...leadSources]);
});
test('request contract accepts a known lead source, omits blank and rejects unknown',()=>{
 const base={services:[{service:'Lawn care',task:'Mowing'}],name:'Synthetic',phone:'5550000000',email:'synthetic@example.invalid',street:'100 Test Street',city:'DeKalb',communityRate:'No'};
 assert.equal(requestInput.parse({...base,leadSource:'Nextdoor'}).leadSource,'Nextdoor');
 assert.equal(requestInput.parse(base).leadSource,undefined);
 assert.equal(requestInput.safeParse({...base,leadSource:'Billboard'}).success,false);
});
test('owner request email shows where the customer found us only when given',()=>{
 const data={name:'Synthetic',phone:'5550000000',email:'synthetic@example.invalid',street:'100 Test Street',city:'DeKalb',communityRate:'No',services:[{service:'Lawn care',task:'Mowing'}]};
 const withSource=ownerRequestEmail({...data,leadSource:'Facebook'},data.services,'00000000-0000-4000-8000-000000000001');
 assert.match(JSON.stringify(withSource),/Found us through: Facebook/);
 assert.doesNotMatch(JSON.stringify(ownerRequestEmail(data,data.services,'00000000-0000-4000-8000-000000000001')),/Found us through/);
});
test('public intake rejects an unknown lead source but accepts a listed one or none',async()=>{
 const {default:handler}=await import('../api/requests.js');
 const body={services:[{service:'Lawn care',task:'Mowing'}],name:'Synthetic',phone:'5550100000',email:'a@example.invalid',street:'100 Test Street',city:'DeKalb',postalCode:'60115',communityRate:'No'};
 const run=async extra=>{let status;const res={setHeader(){},status(v){status=v;return this;},json(v){return v;}};await handler({method:'POST',headers:{host:'example.invalid',origin:'https://example.invalid'},body:{...body,...extra}},res);return status;};
 assert.equal(await run({leadSource:'Billboard on Mars'}),400);
 assert.notEqual(await run({leadSource:'Nextdoor'}),400);
 assert.notEqual(await run({leadSource:''}),400);
 assert.notEqual(await run({}),400);
});
