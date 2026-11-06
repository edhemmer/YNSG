import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {welcomeVoice} from '../site/welcome-voice.js';
const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const micro=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const dom=new JSDOM('<button id="browse">Explore services</button><a href="/request/">Request service appointment</a><div data-welcome-voice><audio controls></audio><p data-welcome-voice-status></p></div>',{url:'https://example.test'});
 return dom;
}
test('homepage retains real audio, controls, transcript and original carousel',async()=>{
 const html=await load('site/pages/home.html');const doc=new JSDOM(html).window.document;
 assert.ok(doc.querySelector('section.neighbor-carousel'));
 const panel=doc.querySelector('[data-welcome-voice]');assert.ok(panel);
 assert.ok(panel.querySelector('audio[controls] source[src="/assets/ynsg-welcome-intro.mp3"][type="audio/mpeg"]'));
 assert.match(panel.querySelector('details summary').textContent,/Read the welcome message/);
 assert.ok(doc.querySelector('.hero-buttons a[href="/request/"]'));
 assert.ok((await stat(new URL('../site/assets/ynsg-welcome-intro.mp3',import.meta.url))).size>700000);
});
test('welcome audio never starts on its own',async()=>{
 const dom=fixture(),doc=dom.window.document,audio=doc.querySelector('audio');let calls=0;
 audio.play=()=>{calls++;return Promise.resolve();};
 welcomeVoice(doc);await micro();assert.equal(calls,0);
 assert.match(doc.querySelector('[data-welcome-voice-status]').textContent,/Press Play/);dom.window.close();
});
test('unrelated clicks, links and keys never start audio',async()=>{
 const dom=fixture(),doc=dom.window.document,audio=doc.querySelector('audio');let calls=0;
 audio.play=()=>{calls++;return Promise.resolve();};welcomeVoice(doc);await micro();
 doc.querySelector('#browse').click();doc.querySelector('a').click();
 doc.querySelector('#browse').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await micro();
 assert.equal(calls,0);dom.window.close();
});
test('status follows the native player',async()=>{
 const dom=fixture(),doc=dom.window.document,audio=doc.querySelector('audio');welcomeVoice(doc);
 const status=doc.querySelector('[data-welcome-voice-status]');
 audio.dispatchEvent(new dom.window.Event('ended'));assert.match(status.textContent,/Thanks for listening/);dom.window.close();
});
