// YNSG ad generator: renders branded ad creatives from real job photos with Playwright.
// usage: node make-ads.cjs <photosDir> <outDir> [onlyId]
const {chromium} = require('playwright');
const path = require('path'), fs = require('fs');
const [photos, out, only] = process.argv.slice(2);
const here = __dirname;
const font = w => 'file://' + path.join(here, 'node_modules/@fontsource/outfit/files', `outfit-latin-${w}-normal.woff2`);
const logo = 'file://' + path.join(here, 'logo-trim.png');
const ph = n => 'file://' + path.join(photos, fs.readdirSync(photos).find(f => f.endsWith('-' + n + '.jpg')));

const SIZES = {square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920]};
const URL_TEXT = 'YourNeighborhoodServiceGuy.com';

// focal: CSS object-position per size. split: before/after pair.
const ADS = [
 {id:'accessibility', photo:'05', badge:'right', focal:{square:'40% 30%', portrait:'40% 32%', story:'40% 36%'},
  en:{chip:'New · Accessibility & home safety', h:'Grab bars. Wheelchair tune-ups. A home that works for you.', sub:'$45/hr Community Rate for seniors 70+, veterans, single parents and neighbors with disabilities.', cta:'Request a visit'},
  es:{chip:'Nuevo · Accesibilidad y seguridad en casa', h:'Barras de apoyo. Ajuste de sillas de ruedas. Un hogar más fácil.', sub:'Tarifa Comunitaria de $45/hora para mayores de 70, veteranos, padres solteros y personas con discapacidad.', cta:'Solicite una visita'}},
 {id:'leaf-before-after', split:['17','10'], focal:{square:'50% 60%', portrait:'50% 60%', story:'50% 60%'},
  en:{chip:'Leaf season', h:'Leaf season, handled.', sub:'Walks, drives and beds cleared. You approve the estimate and cap before we start.', cta:'Book leaf cleanup', before:'Before', after:'After'},
  es:{chip:'Temporada de hojas', h:'Temporada de hojas, resuelta.', sub:'Banquetas, entradas y jardineras limpias. Usted aprueba el presupuesto antes de empezar.', cta:'Reserve la limpieza', before:'Antes', after:'Después'}},
 {id:'holiday-ready', photo:'27', badge:'right', focal:{square:'30% 55%', portrait:'30% 55%', story:'26% 55%'},
  en:{chip:'Through December 24', h:'Holiday-ready in one visit.', sub:'Shelves, pictures, curtain rods and small fixes. Two hours: $140, or $90 at the Community Rate.', cta:'Book your visit'},
  es:{chip:'Hasta el 24 de diciembre', h:'Su casa lista para las fiestas en una visita.', sub:'Repisas, cuadros, cortineros y arreglos pequeños. Dos horas: $140, o $90 con la Tarifa Comunitaria.', cta:'Reserve su visita'}},
 {id:'trusted-neighbor', photo:'22', focal:{square:'50% 62%', portrait:'50% 60%', story:'50% 58%'},
  en:{chip:'Home & yard · DeKalb to St. Charles', h:'Your neighbor. Your service guy.', sub:'Published rates. No trip charges. You approve a not-to-exceed cap before any work begins.', cta:'Request service'},
  es:{chip:'Hogar y jardín · DeKalb a St. Charles', h:'Su vecino de confianza para el hogar.', sub:'Precios publicados. Sin cargo por traslado. Usted aprueba un límite de costo antes de empezar.', cta:'Solicite servicio'}},
 {id:'winter-list', photo:'14', badge:'right', focal:{square:'50% 44%', portrait:'50% 44%', story:'50% 46%'},
  en:{chip:'Winter is coming', h:'Snow season? Get on our list now.', sub:'Driveways, walks and accessible entries, priced per visit. No trip charges.', cta:'Join the winter list'},
  es:{chip:'Ya viene el invierno', h:'¿Nieve? Apúntese en nuestra lista.', sub:'Entradas, banquetas y accesos, con precio por visita. Sin cargo por traslado.', cta:'Únase a la lista'}},
];

function html(ad, lang, size){
 const [W,H] = SIZES[size], t = ad[lang], story = size==='story';
 const pad = 72, hSize = size==='square'?70:story?(ad.split?92:80):80, subSize = story?38:34;
 const photoH = size==='square'?560:size==='portrait'?780:1920;
 const heroH = size==='square'?560:size==='portrait'?800:860, fadeTop=(ad.split?photoH:heroH)-170;
 const imgs = ad.split
  ? `<div class="split"><figure><img src="${ph(ad.split[0])}" style="object-position:${ad.focal[size]}"><b>${t.before}</b></figure><figure><img src="${ph(ad.split[1])}" style="object-position:${ad.focal[size]}"><b class="after">${t.after}</b></figure></div>${story?'<div class="band"></div>':'<div class="fade"></div>'}`
  : `<div class="hero"><img src="${ph(ad.photo)}" style="object-position:${ad.focal[size]}"></div><div class="fade"></div>${story?`<div class="under"><img src="${ph(ad.photo)}" style="object-position:50% 88%"></div><div class="underfade"></div>`:''}`;
 // Story: keep copy between 269px (top UI) and H-672px (bottom UI).
 const blockBottom = story ? 672+40 : pad;
 const logoTop = story ? 290 : 56;
 return `<!doctype html><html><head><meta charset="utf-8"><style>
 @font-face{font-family:Outfit;font-weight:400;src:url(${font(400)})}
 @font-face{font-family:Outfit;font-weight:600;src:url(${font(600)})}
 @font-face{font-family:Outfit;font-weight:800;src:url(${font(800)})}
 :root{--navy:#10283c;--forest:#2f5b3f;--sun:#edbd6b;--paper:#fbfaf6}
 *{box-sizing:border-box;margin:0}
 body{width:${W}px;height:${H}px;overflow:hidden;font-family:Outfit,sans-serif;background:var(--navy);position:relative}
 .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
 .split{position:absolute;left:0;right:0;top:0;height:${photoH}px;display:grid;grid-template-columns:1fr 1fr;gap:8px;background:var(--sun)}
 .band{position:absolute;left:0;right:0;top:640px;height:${1920-640}px;background:linear-gradient(180deg,rgba(16,40,60,0) 0,rgba(16,40,60,.93) 90px,rgba(16,40,60,.93) 640px,rgba(16,40,60,.35) 820px,rgba(16,40,60,0) 1000px)}
 .hero{position:absolute;left:0;right:0;top:0;height:${heroH}px;overflow:hidden}.hero img{width:100%;height:100%;object-fit:cover;display:block}
 .under{position:absolute;left:0;right:0;top:1248px;bottom:0;overflow:hidden}.under img{width:100%;height:100%;object-fit:cover;filter:brightness(.5) saturate(.85)}
 .underfade{position:absolute;left:0;right:0;top:1246px;height:180px;background:linear-gradient(180deg,var(--navy),rgba(16,40,60,0))}
 .fade{position:absolute;left:0;right:0;top:${fadeTop}px;height:172px;background:linear-gradient(180deg,rgba(16,40,60,0),var(--navy))}
 .split figure{position:relative;overflow:hidden}
 .split img{width:100%;height:100%;object-fit:cover;display:block}
 .split b{position:absolute;left:28px;${story?'top:560px':'bottom:190px'};font-weight:800;font-size:30px;letter-spacing:.14em;text-transform:uppercase;color:var(--navy);background:var(--paper);padding:10px 22px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.3)}
 .split b.after{background:var(--sun)}
 .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,40,60,0) ${story?'28%':'34%'},rgba(16,40,60,.82) ${story?'50%':'62%'},rgba(16,40,60,.96) 100%)}
 .logo{position:absolute;${ad.badge==='right'?'right':'left'}:${pad-16}px;top:${logoTop}px;background:#fff;border-radius:22px;padding:12px 18px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
 .logo img{display:block;height:${size==='square'?150:170}px}
 .copy{position:absolute;left:${pad}px;right:${pad}px;bottom:${blockBottom}px;color:#fff}
 .chip{display:inline-block;background:var(--sun);color:var(--navy);font-weight:800;font-size:24px;letter-spacing:.12em;text-transform:uppercase;padding:10px 20px;border-radius:999px;margin-bottom:26px}
 h1{font-weight:800;font-size:${hSize}px;line-height:1.02;letter-spacing:-.02em;margin-bottom:22px;text-wrap:balance}
 p{font-weight:400;font-size:${subSize}px;line-height:1.3;color:#e9efe9;max-width:${story?900:880}px;margin-bottom:34px}
 .row{display:flex;align-items:center;gap:26px;flex-wrap:wrap}
 .cta{background:var(--sun);color:var(--navy);font-weight:800;font-size:32px;padding:20px 34px;border-radius:16px}
 .url{font-weight:600;font-size:28px;color:#fff;letter-spacing:.01em}
 .rule{position:absolute;left:0;right:0;bottom:0;height:12px;background:linear-gradient(90deg,var(--forest),var(--sun))}
 </style></head><body>${imgs}
 <div class="logo"><img src="${logo}"></div>
 <div class="copy"><span class="chip">${t.chip}</span><h1>${t.h}</h1><p>${t.sub}</p><div class="row"><span class="cta">${t.cta} →</span><span class="url">${URL_TEXT}</span></div></div>
 <div class="rule"></div></body></html>`;
}

(async()=>{
 const browser = await chromium.launch();
 let n=0;
 for(const ad of ADS){ if(only && ad.id!==only) continue;
  for(const lang of ['en','es']) for(const size of Object.keys(SIZES)){
   const [W,H] = SIZES[size];
   const page = await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
   const tmp = path.join(here,'_render.html'); fs.writeFileSync(tmp, html(ad,lang,size));
   await page.goto('file://'+tmp,{waitUntil:'load'});
   await page.evaluate(()=>document.fonts.ready);
   const dir = path.join(out, ad.id); fs.mkdirSync(dir,{recursive:true});
   await page.screenshot({path:path.join(dir,`ynsg-${ad.id}-${lang}-${size}-${W}x${H}.jpg`),type:'jpeg',quality:92});
   await page.close(); n++;
  }
 }
 await browser.close(); console.log('rendered',n);
})();
