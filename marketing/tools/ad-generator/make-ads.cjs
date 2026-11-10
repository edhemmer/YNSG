// YNSG ad generator v2: hook-first stills + motion Reels from real job photos.
// usage: node make-ads-v2.cjs <photosDir> <outDir> [stills|motion|all] [onlyId]
const {chromium} = require(process.env.PW || 'playwright');
const path = require('path'), fs = require('fs'), {execFileSync} = require('child_process');
const [photos, out, mode = 'all', only] = process.argv.slice(2);
const here = __dirname;
const font = w => 'file://' + path.join(here, 'node_modules/@fontsource/outfit/files', `outfit-latin-${w}-normal.woff2`);
const logo = 'file://' + path.join(here, 'logo-trim.png');
const ph = n => 'file://' + path.join(photos, fs.readdirSync(photos).find(f => f.endsWith('-' + n + '.jpg')));
const SIZES = {square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920]};
const URL_TEXT = 'YourNeighborhoodServiceGuy.com';

// Headline: [words] = highlighted in brand sun gold.
const ADS = [
 {id:'accessibility', photo:'05', badge:'right', focal:{square:'40% 30%', portrait:'40% 32%', story:'40% 36%'},
  en:{h:'Help Mom & Dad stay [safe at home.]', ticks:['Grab bars installed','Wheelchair & walker tune-ups','Closets you can reach'], sticker:['$90','2-hour visit','Community Rate'], cta:'Book a safety visit'},
  es:{h:'Ayude a mamá y papá a vivir [seguros en casa.]', ticks:['Instalamos barras de apoyo','Ajuste de sillas de ruedas y andaderas','Repisas y clósets a su alcance'], sticker:['$90','Visita de 2 horas','Tarifa Comunitaria'], cta:'Escríbanos en español', url:'Por Messenger · YourNeighborhoodServiceGuy.com'}},
 {id:'leaf-before-after', split:['17','10'], focal:{square:'50% 70%', portrait:'50% 70%', story:'50% 72%'},
  en:{h:'Leaves gone. [Weekend back.]', ticks:['Walks & drives cleared','Garden beds cleaned out','No trip charges'], sticker:null, cta:'Book leaf cleanup', before:'Before', after:'After'},
  es:{h:'Adiós a las hojas. [Hola, fin de semana.]', ticks:['Banquetas y entradas limpias','Jardineras sin hojas','Sin cargo por traslado'], sticker:null, cta:'Escríbanos en español', url:'Por Messenger · YourNeighborhoodServiceGuy.com', before:'Antes', after:'Después'}},
 {id:'holiday-ready', photo:'27', badge:'right', focal:{square:'30% 55%', portrait:'30% 55%', story:'26% 55%'},
  en:{chip:'Through December 24', h:'Guests coming? [We’ve got your list.]', ticks:['Shelves & pictures hung','Curtain rods & furniture','Small fixes, done'], sticker:['$140','2-hour visit','$90 Community'], cta:'Book before the 24th'},
  es:{chip:'Hasta el 24 de diciembre', h:'¿Vienen visitas? [Nosotros nos encargamos.]', ticks:['Repisas y cuadros instalados','Cortineros y armado de muebles','Arreglos pequeños'], sticker:['$140','Visita de 2 horas','$90 Tarifa Comunitaria'], cta:'Escríbanos en español', url:'Por Messenger · YourNeighborhoodServiceGuy.com'}},
 {id:'trusted-neighbor', photo:'26', badge:'left', focal:{square:'60% 62%', portrait:'60% 60%', story:'62% 58%'},
  en:{h:'The service guy who [actually shows up.]', ticks:['Prices published up front','No trip charges','You approve the cap first'], sticker:null, cta:'Request service'},
  es:{h:'Su vecino de confianza [que sí cumple.]', ticks:['Precios publicados','Sin cargo por traslado','Usted aprueba el costo máximo'], sticker:null, cta:'Escríbanos en español', url:'Por Messenger · YourNeighborhoodServiceGuy.com'}},
 {id:'winter-list', photo:'14', badge:'right', focal:{square:'50% 44%', portrait:'50% 44%', story:'50% 46%'},
  en:{h:'First snow? [Not your problem.]', ticks:['Driveways & walks','Accessible entries cleared','Priced per visit'], sticker:['Snow list','now open',''], cta:'Join the snow list'},
  es:{h:'¿Primera nevada? [Nosotros la quitamos.]', ticks:['Entradas de auto y banquetas','Accesos despejados','Precio por visita'], sticker:['Nieve','Lista abierta',''], cta:'Escríbanos en español', url:'Por Messenger · YourNeighborhoodServiceGuy.com'}},
];

const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
function hl(h){ // split into word spans; words inside [...] get the highlight class
 const out=[]; let inHl=false, i=0;
 for(const raw of h.split(' ')){ let w=raw; const start=w.startsWith('['); if(start){inHl=true;w=w.slice(1);} const end=w.endsWith(']')||w.endsWith('].')||w.endsWith(']?'); if(end) w=w.replace(']','');
  out.push(`<span class="w${inHl?' hl':''}" style="--i:${i++}">${esc(w)}</span>`); if(end) inHl=false; }
 return out.join(' ');
}

function html(ad, lang, size, motion){
 const [W,H] = SIZES[size], t = ad[lang], story = size==='story', sq = size==='square';
 const pad = 64;
 const heroH = sq?520:size==='portrait'?740:760;
 const hSize = sq?78:story?96:94, tickSize = sq?30:story?36:34;
 const logoTop = story ? 290 : 48;
 const copyBottom = story ? 712 : 60;
 const nWords = t.h.split(' ').length;
 const hero = ad.split
  ? `<div class="hero split"><figure class="b"><img src="${ph(ad.split[0])}" style="object-position:${ad.focal[size]}"><b>${t.before}</b></figure><figure class="a"><img src="${ph(ad.split[1])}" style="object-position:${ad.focal[size]}"><b class="after">${t.after}</b></figure></div>`
  : `<div class="hero"><img class="kb" src="${ph(ad.photo)}" style="object-position:${ad.focal[size]}"></div>`;
 const under = story ? `<div class="under"><img src="${ph(ad.split?ad.split[1]:ad.photo)}" style="object-position:50% 90%"></div><div class="underfade"></div>` : '';
 const sticker = t.sticker ? `<div class="sticker"><div class="s-in"><strong>${esc(t.sticker[0])}</strong><span>${esc(t.sticker[1])}</span><span>${esc(t.sticker[2])}</span></div></div>` : '';
 const check = `<svg viewBox="0 0 24 24" width="${tickSize+6}" height="${tickSize+6}"><circle cx="12" cy="12" r="12" fill="#edbd6b"/><path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="#10283c" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
 const T0 = 0.35, perWord = 0.12, tickStart = T0 + nWords*perWord + 0.25;
 return `<!doctype html><html><head><meta charset="utf-8"><style>
 @font-face{font-family:Outfit;font-weight:400;src:url(${font(400)})}
 @font-face{font-family:Outfit;font-weight:600;src:url(${font(600)})}
 @font-face{font-family:Outfit;font-weight:800;src:url(${font(800)})}
 @font-face{font-family:Outfit;font-weight:900;src:url(${font(900)})}
 :root{--navy:#10283c;--forest:#2f5b3f;--sun:#edbd6b;--paper:#fbfaf6}
 *{box-sizing:border-box;margin:0}
 body{width:${W}px;height:${H}px;overflow:hidden;font-family:Outfit,sans-serif;background:var(--navy);position:relative}
 .hero{position:absolute;left:0;right:0;top:0;height:${heroH}px;overflow:hidden}
 .hero img{width:100%;height:100%;object-fit:cover;display:block}
 .hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:${sq?230:300}px;background:linear-gradient(180deg,rgba(16,40,60,0),rgba(16,40,60,.75) 55%,var(--navy))}
 .split{display:grid;grid-template-columns:1fr 1fr;gap:0}
 .split figure{position:relative;overflow:hidden}
 .split .a{border-left:8px solid var(--sun)}
 .split b{position:absolute;left:24px;top:${story?logoTop+210:sq?40:56}px;font-weight:900;font-size:${sq?34:40}px;letter-spacing:.12em;text-transform:uppercase;color:var(--navy);background:var(--paper);padding:10px 24px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
 .split b.after{background:var(--sun)}
 .split .b b{left:auto;right:24px}
 .under{position:absolute;left:0;right:0;top:1248px;bottom:0;overflow:hidden}.under img{width:100%;height:100%;object-fit:cover;filter:brightness(.45) saturate(.85)}
 .underfade{position:absolute;left:0;right:0;top:1246px;height:200px;background:linear-gradient(180deg,var(--navy),rgba(16,40,60,0))}
 .logo{position:absolute;${ad.badge==='right'?'right':'left'}:${pad-14}px;top:${logoTop}px;background:#fff;border-radius:20px;padding:10px 16px;box-shadow:0 10px 30px rgba(0,0,0,.28)}
 .logo img{display:block;height:${sq?118:132}px}
 ${ad.split?`.logo{left:50%;right:auto;transform:translateX(-50%);top:${story?logoTop:sq?150:190}px}`:''}
 .copy{position:absolute;left:${pad}px;right:${pad}px;bottom:${copyBottom}px;color:#fff}
 .chip{display:inline-block;background:#fff;color:var(--navy);font-weight:800;font-size:24px;letter-spacing:.12em;text-transform:uppercase;padding:9px 18px;border-radius:999px;margin-bottom:22px}
 h1{font-weight:900;font-size:${hSize}px;line-height:.98;letter-spacing:-.025em;margin-bottom:${sq?24:30}px;max-width:${t.sticker?(sq?712:680):952}px;text-shadow:0 2px 18px rgba(0,0,0,.25)}
 h1 .w{display:inline-block}
 h1 .hl{color:var(--sun)}
 ul{list-style:none;padding:0;margin:0 0 ${sq?28:36}px}
 li{display:flex;align-items:center;gap:16px;font-weight:600;font-size:${tickSize}px;line-height:1.15;margin-bottom:${sq?10:14}px;color:#f3f6f2}
 li svg{flex:none}
 .row{display:flex;align-items:center;gap:24px}
 .cta{background:var(--sun);color:var(--navy);font-weight:800;font-size:${sq?30:34}px;padding:${sq?18:22}px ${sq?30:36}px;border-radius:18px;box-shadow:0 10px 28px rgba(0,0,0,.3);white-space:nowrap}
 .url{font-weight:600;font-size:${sq?22:25}px;color:#cfd9d3;line-height:1.2}
 .copy .sticker{position:absolute;right:-10px;top:${t.chip?40:-14}px;width:${sq?200:236}px;height:${sq?200:236}px;border-radius:50%;background:var(--sun);color:var(--navy);display:grid;place-items:center;transform:rotate(-9deg);box-shadow:0 14px 36px rgba(0,0,0,.4);border:6px solid #fff}
 .s-in{text-align:center;line-height:1.05}
 .s-in strong{display:block;font-weight:900;font-size:${t.sticker&&t.sticker[0].length>4?(sq?44:52):(sq?72:86)}px;letter-spacing:-.03em}
 .s-in span{display:block;font-weight:700;font-size:${sq?19:22}px}
 .rule{position:absolute;left:0;right:0;bottom:0;height:12px;background:linear-gradient(90deg,var(--forest),var(--sun))}
 ${motion?`
 .kb{animation:kb 9s ease-out both}
 @keyframes kb{from{transform:scale(1.14)}to{transform:scale(1)}}
 .split .a{animation:wipe 1.1s cubic-bezier(.7,0,.2,1) 1.6s both}
 @keyframes wipe{from{clip-path:inset(0 0 0 100%)}to{clip-path:inset(0 0 0 0)}}
 .split img{animation:kb 9s ease-out both}
 .logo{animation:drop .6s cubic-bezier(.2,.9,.3,1.2) .1s both}
 @keyframes drop{from{opacity:0;translate:0 -40px}to{opacity:1;translate:0 0}}
 h1 .w{animation:rise .5s cubic-bezier(.2,.9,.3,1) both;animation-delay:calc(${ad.split?2.5:T0}s + var(--i) * ${perWord}s)}
 @keyframes rise{from{opacity:0;transform:translateY(46px)}to{opacity:1;transform:none}}
 .chip{animation:fade .4s ease-out ${ad.split?2.3:0.15}s both}
 li{animation:slide .45s cubic-bezier(.2,.9,.3,1) both}
 li:nth-child(1){animation-delay:${(ad.split?2.5:0)+tickStart}s}li:nth-child(2){animation-delay:${(ad.split?2.5:0)+tickStart+0.35}s}li:nth-child(3){animation-delay:${(ad.split?2.5:0)+tickStart+0.7}s}
 @keyframes slide{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:none}}
 .sticker{animation:pop .6s cubic-bezier(.2,1.4,.4,1) ${(ad.split?2.5:0)+tickStart+1.2}s both}
 @keyframes pop{from{opacity:0;transform:rotate(-40deg) scale(.3)}to{opacity:1;transform:rotate(-9deg) scale(1)}}
 .row{animation:fade .5s ease-out ${(ad.split?2.5:0)+tickStart+1.6}s both}
 .cta{animation:pulse 1.6s ease-in-out ${(ad.split?2.5:0)+tickStart+2.4}s infinite}
 @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
 @keyframes fade{from{opacity:0}to{opacity:1}}`:''}
 </style></head><body>${hero}${under}
 <div class="logo"><img src="${logo}"></div>
 <div class="copy">${sticker}${t.chip?`<span class="chip">${esc(t.chip)}</span>`:''}<h1>${hl(t.h)}</h1><ul>${t.ticks.map(x=>`<li>${check}<span>${esc(x)}</span></li>`).join('')}</ul><div class="row"><span class="cta">${esc(t.cta)} →</span><span class="url">${esc(t.url||URL_TEXT)}</span></div></div>
 <div class="rule"></div></body></html>`;
}

(async()=>{
 const browser = await chromium.launch();
 let n=0;
 for(const ad of ADS){ if(only && ad.id!==only) continue;
  for(const lang of (process.env.LANGS||'en,es').split(',')){
   if(mode!=='motion') for(const size of Object.keys(SIZES)){
    const [W,H]=SIZES[size]; const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
    const tmp=path.join(here,'_r.html'); fs.writeFileSync(tmp,html(ad,lang,size,false));
    await page.goto('file://'+tmp,{waitUntil:'load'}); await page.evaluate(()=>document.fonts.ready);
    const dir=path.join(out,ad.id); fs.mkdirSync(dir,{recursive:true});
    await page.screenshot({path:path.join(dir,`ynsg-${ad.id}-${lang}-${size}-${W}x${H}.jpg`),type:'jpeg',quality:92}); await page.close(); n++;
   }
   if(mode!=='stills'){
    const [W,H]=SIZES.story, fps=30, secs=ad.split?10:8.5;
    const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
    const tmp=path.join(here,'_m.html'); fs.writeFileSync(tmp,html(ad,lang,'story',true));
    await page.goto('file://'+tmp,{waitUntil:'load'}); await page.evaluate(()=>document.fonts.ready);
    const fdir=path.join(here,'_frames'); fs.rmSync(fdir,{recursive:true,force:true}); fs.mkdirSync(fdir);
    for(let f=0; f<Math.round(fps*secs); f++){
     await page.evaluate(ms=>{for(const a of document.getAnimations()){a.pause();a.currentTime=ms;}}, f*1000/fps);
     await page.screenshot({path:path.join(fdir,`f${String(f).padStart(4,'0')}.jpg`),type:'jpeg',quality:90});
    }
    await page.close();
    const dir=path.join(out,ad.id); fs.mkdirSync(dir,{recursive:true});
    execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(fdir,'f%04d.jpg'),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',path.join(dir,`ynsg-${ad.id}-${lang}-reel-1080x1920.mp4`)]);
    n++;
   }
  }
 }
 await browser.close(); console.log('rendered',n);
})();
