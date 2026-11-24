// Phone quick-action bar (Call + Request): slides up once the visitor has scrolled past the first screen.
const rail=document.querySelector('[data-sticky-cta]');
if(rail){
 let queued=false;
 const update=()=>{queued=false;document.body.classList.toggle('show-rail',window.scrollY>420)};
 window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update)}},{passive:true});
 update();
}
