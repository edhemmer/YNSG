import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {homeServicePicker} from '../site/home-service-picker.js';
const html=readFileSync(new URL('../site/pages/home.html',import.meta.url),'utf8');
function setup(htmlSource=html){const dom=new JSDOM(htmlSource,{url:'https://example.invalid/'});dom.window.HTMLElement.prototype.scrollIntoView=()=>{};homeServicePicker(dom.window.document);return {dom,doc:dom.window.document};}
test('service gallery builds a single exact-job GET handoff and supports removal',()=>{
 const {dom,doc}=setup();const card=doc.querySelector('.home-service-book');card.click();assert.equal(card.getAttribute('aria-pressed'),'true');const group=[...doc.querySelectorAll('.service-request-panel details')].find(e=>e.textContent.includes('Furniture assembly'));const input=group.querySelector('input');input.click();const form=doc.querySelector('.service-request-panel form'),data=new dom.window.FormData(form);assert.deepEqual(data.getAll('job').map(x=>JSON.parse(x)),[{service:'Help around the home',task:'Furniture assembly'},{service:'Lawn care',task:'Mowing'}]);assert.match(form.querySelector('[type=submit]').textContent,/2 jobs/);doc.querySelector('[aria-label="Remove Mowing"]').click();assert.equal(card.getAttribute('aria-pressed'),'false');assert.equal(new dom.window.FormData(form).getAll('job').length,1);dom.window.close();
});
test('category cards expose actual jobs without assuming a task; selection is bounded',()=>{
 const {dom,doc}=setup();doc.querySelectorAll('.home-service-book')[2].click();assert.equal(doc.querySelectorAll('.service-request-panel input:checked').length,0);assert.equal(doc.querySelectorAll('.service-request-panel details[open]').length,1);for(const input of doc.querySelectorAll('.service-request-panel input'))input.click();assert.equal(doc.querySelectorAll('.service-request-panel input:checked').length,15);assert.match(doc.querySelector('[role=status]').textContent,/15 jobs/);dom.window.close();
});

test('service detail cards reveal nested other-service group and keep job labels distinct',()=>{
 const detail=html.replace('class="service-request-panel"','class="service-request-panel" data-preferred-service="Lawn care"');
 const {dom,doc}=setup(detail);
 const card=[...doc.querySelectorAll('.home-service-book')].find(link=>link.href.includes('service=Yard'));
 assert.ok(card,'The yard card must exist');
 card.click();
 const other=doc.querySelector('.picker-other-services');
 assert.equal(other.open,true,'Parent disclosure must open when a different service is selected');
 const yard=[...other.querySelectorAll('details')].find(group=>group.querySelector('summary')?.textContent==='Yard & garden');
 assert.equal(yard.open,true,'Requested service group must be visible');
 const job=yard.querySelector('input');
 job.click();
 assert.match(doc.querySelector('.service-picker-selection li').textContent,/Yard & garden: /);
 assert.match(doc.querySelector('.service-picker-selection li button').getAttribute('aria-label'),/from Yard & garden/);
 dom.window.close();
});
