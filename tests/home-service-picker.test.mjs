import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {homeServicePicker} from '../site/home-service-picker.js';
const html=readFileSync(new URL('../site/pages/home.html',import.meta.url),'utf8');
function setup(){const dom=new JSDOM(html,{url:'https://example.invalid/'});dom.window.HTMLElement.prototype.scrollIntoView=()=>{};homeServicePicker(dom.window.document);return {dom,doc:dom.window.document};}
test('service gallery builds a single exact-job GET handoff and supports removal',()=>{
 const {dom,doc}=setup();const card=doc.querySelector('.home-service-book');card.click();assert.equal(card.getAttribute('aria-pressed'),'true');const group=[...doc.querySelectorAll('.service-request-panel details')].find(e=>e.textContent.includes('Furniture assembly'));const input=group.querySelector('input');input.click();const form=doc.querySelector('.service-request-panel form'),data=new dom.window.FormData(form);assert.deepEqual(data.getAll('job').map(x=>JSON.parse(x)).sort((a,b)=>a.service.localeCompare(b.service)),[{service:'Help around the home',task:'Furniture assembly'},{service:'Lawn care',task:'Mowing'}].sort((a,b)=>a.service.localeCompare(b.service)));assert.match(form.querySelector('[type=submit]').textContent,/2 jobs/);doc.querySelector('[aria-label="Remove Mowing"]').click();assert.equal(card.getAttribute('aria-pressed'),'false');assert.equal(new dom.window.FormData(form).getAll('job').length,1);dom.window.close();
});
test('category cards expose actual jobs without assuming a task; selection is bounded',()=>{
 const {dom,doc}=setup();doc.querySelectorAll('.home-service-book')[2].click();assert.equal(doc.querySelectorAll('.service-request-panel input:checked').length,0);assert.equal(doc.querySelectorAll('.service-request-panel details[open]').length,1);for(const input of doc.querySelectorAll('.service-request-panel input'))input.click();assert.equal(doc.querySelectorAll('.service-request-panel input:checked').length,15);assert.match(doc.querySelector('[role=status]').textContent,/15 jobs/);dom.window.close();
});

test('all ten service cards have consistent action text while preserving specific job selection',()=>{
 const staticDoc=new JSDOM(html).window.document;
 const staticCards=[...staticDoc.querySelectorAll('.home-service-card')];
 assert.equal(staticCards.length,10);
 assert.ok(staticCards.every(card=>card.querySelector('.home-service-book').textContent.trim()==='Choose service →'));
 const {dom,doc}=setup();const buttons=[...doc.querySelectorAll('.home-service-card .home-service-book')];
 assert.equal(buttons.length,10);
 assert.ok(buttons.every(button=>button.tagName==='BUTTON'&&button.textContent==='Choose service →'));
 assert.ok(buttons.every(button=>button.getAttribute('aria-label')?.startsWith('Choose service: ')));
 buttons[0].click();assert.equal(buttons[0].textContent,'Selected ✓');
 assert.ok(buttons.slice(1).every(button=>button.textContent==='Choose service →'));
 buttons[0].click();assert.equal(buttons[0].textContent,'Choose service →');
 buttons[2].click();assert.equal(buttons[2].textContent,'Choose service →');
 assert.equal(doc.querySelectorAll('.service-request-panel input:checked').length,0);
 assert.equal(doc.querySelectorAll('.home-service-card .service-arrow').length,10);
 assert.ok(doc.querySelector('.hero-buttons a[href="/request/"]').textContent.includes('Request service appointment'));
 dom.window.close();
});

test('request panel stays out of the mobile flow until a service card is used',()=>{
 const {dom,doc}=setup();const panel=doc.querySelector('.service-request-panel');assert.equal(panel.dataset.engaged,'false');
 doc.querySelectorAll('.home-service-book')[0].click();assert.equal(panel.dataset.engaged,'true');
 const css=readFileSync(new URL('../site/premium.css',import.meta.url),'utf8');assert.match(css,/\[data-engaged=false\]\{display:none\}/);dom.window.close();
});

test('phone rail carries chosen jobs forward instead of restarting the request',()=>{
 const dom=new JSDOM(html+'<nav class="mobile-rail" data-sticky-cta><a class="rail-call" href="tel:+18156801775">Call</a><a class="rail-request" href="/request/">Request service <span aria-hidden="true">→</span></a></nav>',{url:'https://example.invalid/'});dom.window.HTMLElement.prototype.scrollIntoView=()=>{};const doc=dom.window.document;homeServicePicker(doc);
 const rail=doc.querySelector('.rail-request'),card=doc.querySelector('.home-service-book');
 card.click();assert.equal(rail.textContent,'Continue with 1 job →');
 card.click();assert.equal(rail.textContent.trim(),'Request service →');assert.ok(rail.querySelector('span'));dom.window.close();
});
