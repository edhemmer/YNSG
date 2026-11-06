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
test('blocked automatic playback can retry synchronously on first in-page click; no repeated starts',async()=>{
 const dom=fixture(),doc=dom.window.document,audio=doc.querySelector('audio');let calls=0;
 audio.play=()=>{calls++;return calls===1?Promise.reject(new Error('blocked')):Promise.resolve();};
 welcomeVoice(doc);await micro();const afterInitial=calls;
 doc.querySelector('#browse').click();await micro();
 assert.equal(calls,afterInitial+1);
 // A resolved play counts as listened to this visit; later clicks do not replay.
 doc.querySelector('#browse').click();assert.equal(calls,afterInitial+1);
 assert.equal(dom.window.sessionStorage.getItem('ynsg-welcome-played-this-visit'),'1');dom.window.close();
});
test('clicking a navigation link never tries to play audio',async()=>{
 const dom=fixture(),doc=dom.window.document,audio=doc.querySelector('audio');let calls=0;
 audio.play=()=>{calls++;return Promise.reject(new Error('blocked'));};welcomeVoice(doc);await micro();
 doc.querySelector('a').click();await micro();assert.equal(calls,1);dom.window.close();
});
test('manual pause prevents replay from later clicks',async()=>{
 const dom=fixture(),doc=dom.window.document,audio=doc.querySelector('audio');let calls=0;
 audio.play=()=>{calls++;return Promise.reject(new Error('blocked'));};welcomeVoice(doc);await micro();
 audio.dispatchEvent(new dom.window.Event('pause'));
 doc.querySelector('#browse').click();assert.equal(calls,1);dom.window.close();
});
test('keyboard activation can trigger a blocked autoplay retry',async()=>{
 const dom=fixture(),doc=dom.window.document,audio=doc.querySelector('audio');let calls=0;
 audio.play=()=>{calls++;return Promise.reject(new Error('blocked'));};welcomeVoice(doc);await micro();
 doc.querySelector('#browse').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await micro();
 assert.equal(calls,2);dom.window.close();
});
test('Tab, arrow and page keys can start a blocked welcome; Escape and modifiers cannot',async()=>{
 for(const [key,expected] of [['Tab',2],['ArrowDown',2],['PageDown',2],['Escape',1],['Shift',1]]){
  const dom=fixture(),doc=dom.window.document,audio=doc.querySelector('audio');let calls=0;
  audio.play=()=>{calls++;return Promise.reject(new Error('blocked'));};welcomeVoice(doc);await micro();
  doc.querySelector('#browse').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true}));await micro();
  assert.equal(calls,expected,key);dom.window.close();
 }
});
test('a finished phone touch or swipe can start a blocked welcome, but not on a link',async()=>{
 const dom=fixture(),doc=dom.window.document,audio=doc.querySelector('audio');let calls=0;
 audio.play=()=>{calls++;return calls===1?Promise.reject(new Error('blocked')):Promise.resolve();};welcomeVoice(doc);await micro();
 doc.querySelector('a').dispatchEvent(new dom.window.Event('touchend',{bubbles:true}));await micro();assert.equal(calls,1);
 doc.querySelector('#browse').dispatchEvent(new dom.window.Event('touchend',{bubbles:true}));await micro();assert.equal(calls,2);
 doc.querySelector('#browse').dispatchEvent(new dom.window.Event('touchend',{bubbles:true}));await micro();assert.equal(calls,2);
 dom.window.close();
});
test('the big welcome button plays and pauses directly, without double-triggering the page listener',async()=>{
 const dom=new JSDOM('<div data-welcome-voice><button type="button" data-welcome-play><span class="welcome-play-icon">▶</span><span data-welcome-play-label>Hear our 44-second welcome</span></button><audio controls></audio><p data-welcome-voice-status></p></div>',{url:'https://example.test'});
 const doc=dom.window.document,audio=doc.querySelector('audio');let calls=0,pauses=0,paused=true;
 Object.defineProperty(audio,'paused',{get:()=>paused});
 audio.play=()=>{calls++;paused=false;audio.dispatchEvent(new dom.window.Event('play'));return Promise.resolve();};
 audio.pause=()=>{pauses++;paused=true;audio.dispatchEvent(new dom.window.Event('pause'));};
 welcomeVoice(doc);await micro();const initial=calls;
 // Simulate a browser that blocked the initial attempt.
 paused=true;
 const button=doc.querySelector('[data-welcome-play]');
 button.click();await micro();
 assert.equal(calls,initial+1,'one play per tap');
 assert.match(button.textContent,/Pause welcome/);assert.equal(button.getAttribute('aria-pressed'),'true');
 button.click();await micro();assert.equal(pauses,1);assert.match(button.textContent,/Hear our 44-second welcome/);
 dom.window.close();
});
test('homepage shows the big welcome button inside the welcome panel',async()=>{
 const html=await load('site/pages/home.html');const doc=new JSDOM(html).window.document;
 const button=doc.querySelector('[data-welcome-voice] button[data-welcome-play][aria-controls="ynsg-welcome-audio"]');
 assert.ok(button);assert.match(button.textContent,/Hear our 44-second welcome/);
});
