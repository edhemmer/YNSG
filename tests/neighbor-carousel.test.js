import test from 'node:test';
import assert from 'node:assert/strict';
import {initNeighborCarousel} from '../site/neighbor-carousel.js';
class Element {
 constructor(){this.events={};this.attributes={};this.hidden=false;this.textContent='';}
 addEventListener(name,fn){this.events[name]=fn;}
 setAttribute(name,value){this.attributes[name]=value;}
 emit(name,event={}){this.events[name]?.(event);}
}
function fixture(reduced=false){
 const doc=new Element();doc.hidden=false;globalThis.document=doc;
 const images=Array.from({length:4},()=>({complete:true,loading:'lazy',decode:()=>Promise.resolve()}));
 const slides=images.map(img=>{const el=new Element();el.querySelector=()=>img;return el;});
 const root=new Element(),controls=new Element(),pause=new Element(),live=new Element(),symbol=new Element();pause.querySelector=()=>symbol;
 root.querySelectorAll=s=>s==='.neighbor-slide'?slides:[];
 root.querySelector=s=>s==='.carousel-controls'?controls:s==='[data-carousel="pause"]'?pause:s==='.neighbor-slides'?live:null;
 const motion=new Element();motion.matches=reduced;
 let timer,delay;
 const env={matchMedia:()=>motion,setInterval:(fn,ms)=>{timer=fn;delay=ms;return 1;},clearInterval:()=>{timer=undefined;}};
 initNeighborCarousel(root,env);
 return {root,slides,images,pause,doc,motion,controls,delay:()=>delay,tick:()=>timer?.(),running:()=>!!timer};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('rotates all four photos every four seconds and wraps; pause holds the selected photo',async()=>{
 const f=fixture();await settle();assert.equal(f.delay(),4000);
 for(const selected of [1,2,3,0]){f.tick();assert.equal(f.slides.findIndex(s=>!s.hidden),selected);}
 f.pause.emit('click');assert.equal(f.running(),false);assert.equal(f.pause.attributes['aria-label'],'Play slideshow');f.tick();assert.equal(f.slides[0].hidden,false);
 f.pause.emit('click');assert.equal(f.running(),true);
});
test('reduced motion and background tabs stop rotation; swipe works without visible arrows',async()=>{
 const f=fixture(true);await settle();assert.equal(f.running(),false);assert.equal(f.controls.hidden,false);
 f.root.emit('touchstart',{touches:[{clientX:220}]});f.root.emit('touchend',{changedTouches:[{clientX:100}]});assert.equal(f.slides[1].hidden,false);
 f.pause.emit('click');assert.equal(f.running(),true);f.doc.hidden=true;f.doc.emit('visibilitychange');assert.equal(f.running(),false);
 f.doc.hidden=false;f.doc.emit('visibilitychange');assert.equal(f.running(),true);
});
test('slow-loading next photo never replaces a visible image with an empty frame',async()=>{
 const f=fixture();await settle();f.images[1].complete=false;f.tick();assert.equal(f.slides[0].hidden,false);assert.equal(f.images[1].loading,'eager');f.images[1].complete=true;f.tick();assert.equal(f.slides[1].hidden,false);
});
