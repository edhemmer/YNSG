import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {welcomeVoice} from '../site/welcome-voice.js';
const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('homepage has a real voice-only recording, visible audio controls and written transcript',async()=>{
 const html=await load('site/pages/home.html');
 const doc=new JSDOM(html).window.document;
 assert.ok(doc.querySelector('section.neighbor-carousel'),'Approved carousel is unchanged');
 const panel=doc.querySelector('[data-welcome-voice]');assert.ok(panel);
 assert.ok(panel.querySelector('audio[controls] source[src="/assets/ynsg-welcome-intro.mp3"][type="audio/mpeg"]'));
 assert.ok(panel.querySelector('details summary').textContent.includes('Read the welcome message'));
 assert.ok(panel.textContent.includes('St. Charles')&&panel.textContent.includes('Sycamore'));
 assert.ok(doc.querySelector('.hero-buttons a[href="/request/"]'));
 const file=await stat(new URL('../site/assets/ynsg-welcome-intro.mp3',import.meta.url));assert.ok(file.size>700000,'Original uploaded recording must be included');
});
test('blocked autoplay keeps native controls and never hides the recording',()=>{
 const dom=new JSDOM('<main data-welcome-voice><audio controls></audio><p data-welcome-voice-status></p></main>',{url:'https://example.test'});
 const audio=dom.window.document.querySelector('audio');let called=0;
 audio.play=()=>{called++;return Promise.reject(new Error('Autoplay blocked'));};
 welcomeVoice(dom.window.document);
 assert.ok(audio.controls);assert.ok(called<=1);
 dom.window.close();
});
