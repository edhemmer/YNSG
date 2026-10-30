import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {servicePages,serviceMedia,servicePicker} from '../scripts/service-experience.mjs';
import {homeServicePicker} from '../site/home-service-picker.js';
import {saveServiceSelection,clearServiceSelection} from '../site/service-selection.js';
import {seo} from '../scripts/seo.mjs';
const manifest=JSON.parse(readFileSync(new URL('../site/assets/services/image-manifest.json',import.meta.url)));
test('every service uses its supplied image and descriptive image/search metadata',()=>{
 for(const slug of Object.keys(servicePages)){const m=serviceMedia(slug,manifest),graph=JSON.parse(seo(slug,'Service','A useful local service description',m).schema)['@graph'];assert.ok(m.src.endsWith('-960.webp'));assert.ok(readFileSync(new URL('../site/pages/home.html',import.meta.url),'utf8').includes('src="'+m.src+'"'),'Service page must reuse the actual homepage-panel image');assert.ok(graph.some(x=>x['@type']==='ImageObject'&&x.contentUrl.endsWith(m.src)));assert.ok(graph.find(x=>x['@type']==='Service').image);}
 const text=JSON.stringify(seo('leaf-cleanup-dekalb-il','Leaf','Seasonal leaf management in DeKalb.'));assert.doesNotMatch(text,/bagging|Leaf Cleanup|Leaf cleanup/);
});
test('service-page picker prioritizes relevant choices and restores a mixed request without assuming consent',()=>{
 const dom=new JSDOM(servicePicker('leaf-cleanup-dekalb-il'),{url:'https://example.invalid/leaf-cleanup-dekalb-il'}),doc=dom.window.document;saveServiceSelection(dom.window.sessionStorage,[{service:'Help around the home',task:'Furniture assembly'}]);homeServicePicker(doc);const first=doc.querySelector('fieldset details');assert.equal(first.open,true);assert.equal(JSON.parse(first.querySelector('input').value).task,'Leaf management');assert.equal(doc.querySelectorAll('input:checked').length,1);first.querySelector('input').click();assert.equal(doc.querySelectorAll('input:checked').length,2);clearServiceSelection(dom.window.sessionStorage);doc.defaultView.dispatchEvent(new dom.window.PageTransitionEvent('pageshow',{persisted:true}));assert.equal(doc.querySelectorAll('input:checked').length,0);dom.window.close();
});
