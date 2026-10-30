/** Settled, painted text only. Disabled controls and image/gradient text require separate visual review. */
export async function auditReadability(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>{const end=a.effect?.getComputedTiming().endTime;return typeof end==='number'&&Number.isFinite(end)&&end<=1500;}).map(a=>a.finished.catch(()=>{})));});return page.evaluate(()=>{
 const rgb=s=>{const v=s.match(/[\d.]+/g)?.map(Number);return v?.length>=3?[v[0],v[1],v[2],v[3]??1]:null;};
 const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
 const lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const failures=[],manual=[];let checked=0;
 for(const e of document.querySelectorAll('body *')){
  if(['SCRIPT','STYLE','NOSCRIPT','OPTION','SVG','PATH'].includes(e.tagName)||!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})||e.closest('[disabled],[aria-disabled="true"]'))continue;
  const text=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim();
  if(text.length<2&&!e.matches('input:not([type=checkbox]):not([type=radio]),textarea,select'))continue;
  const c=getComputedStyle(e),size=parseFloat(c.fontSize),weight=parseInt(c.fontWeight)||400,label=(text||e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.tagName).slice(0,90),path=e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(typeof e.className==='string'?'.'+e.className.trim().replaceAll(' ','.'):'');
  let chain=[],p=e,photo=false,opacity=1,clipped=false;while(p){chain.push(p);const style=getComputedStyle(p);opacity*=Number(style.opacity);if(style.backgroundImage!=='none')photo=true;if(style.clipPath!=='none'){const r=p.getBoundingClientRect();if(r.width<=2&&r.height<=2)clipped=true;}p=p.parentElement;}
  if(clipped)continue;
  if(size<13.9)failures.push({kind:'small-text',label,path,size});
  if(e.matches('input:not([type=checkbox]):not([type=radio]),textarea,select')&&size<16)failures.push({kind:'small-input',label,path,size});
  if(photo){manual.push({label,path});continue;}
  let bg=[255,255,255];for(const el of chain.reverse()){const color=rgb(getComputedStyle(el).backgroundColor);if(color)bg=blend(color,bg);}
  const fg=rgb(c.color);if(!fg)continue;fg[3]*=opacity;const effective=blend(fg,bg),a=lum(effective),b=lum(bg),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),minimum=size>=24||(size>=18.66&&weight>=700)?3:4.5;
  if(contrast+.02<minimum)failures.push({kind:'contrast',label,path,size,contrast:Math.round(contrast*100)/100,minimum,foreground:c.color,background:bg.map(Math.round)});
  if(e.matches('input[placeholder],textarea[placeholder]')&&!e.value){const style=getComputedStyle(e,'::placeholder'),color=rgb(style.color);if(color){color[3]*=opacity*Number(style.opacity);const a=lum(blend(color,bg)),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);if(ratio+.02<4.5)failures.push({kind:'placeholder-contrast',label,path,size,contrast:Math.round(ratio*100)/100,minimum:4.5,foreground:style.color,background:bg.map(Math.round)});}}
  checked++;
 }
 return {checked,failures,manual};
 });}
