// Service Saturday creatives: link-preview image for the website plus square, portrait and Story ads.
// usage: node make-service-saturday.cjs <photosDir> <outDir> [sharePngPath]
// Same brand system as make-ads.cjs (Outfit, navy/forest/sun, real job photos, white logo badge).
const {chromium} = require('playwright');
const path = require('path'), fs = require('fs');
const [photos, out, shareOut] = process.argv.slice(2);
const here = __dirname;
const font = w => 'file://' + path.join(here, 'node_modules/@fontsource/outfit/files', `outfit-latin-${w}-normal.woff2`);
const logo = 'file://' + path.join(here, 'logo-trim.png');
const ph = n => 'file://' + path.join(photos, fs.readdirSync(photos).find(f => f.endsWith('-' + n + '.jpg')));

const COPY = {
  chip: 'Service Saturday · Drawing Dec 8',
  h: 'Enter to Win! 4 hours of service, worth up to $280',
  sub: 'Nominate a neighbor who could use a hand, or enter for your own home. Free to enter. Enter by Dec 6.',
  cta: 'Enter now',
  url: 'YourNeighborhoodServiceGuy.com',
  phone: '815-680-1775',
  fine: 'No purchase necessary. No cash value. One visit, labor only; non-transferable. IL residents 18+ in our service area. Enter Nov 17–Dec 6, 2026. Official Rules: YourNeighborhoodServiceGuy.com/service-saturday-rules. Not sponsored by Facebook, Instagram, Meta or Nextdoor.',
};

// photo: job photo number; focal: CSS object-position.
const SIZES = {
  share: {W: 1200, H: 630, photo: '23', focal: '62% 40%'},
  square: {W: 1080, H: 1080, photo: '23', focal: '64% 4%'},
  portrait: {W: 1080, H: 1350, photo: '28', focal: '50% 34%'},
  story: {W: 1080, H: 1920, photo: '28', focal: '50% 30%'},
};

const css = `
 @font-face{font-family:Outfit;font-weight:400;src:url(${font(400)})}
 @font-face{font-family:Outfit;font-weight:600;src:url(${font(600)})}
 @font-face{font-family:Outfit;font-weight:800;src:url(${font(800)})}
 :root{--navy:#10283c;--forest:#2f5b3f;--sun:#edbd6b;--paper:#fbfaf6}
 *{box-sizing:border-box;margin:0}
 body{font-family:Outfit,sans-serif;background:var(--navy);position:relative;overflow:hidden;color:#fff}
 .photo{position:absolute;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;display:block}
 .logo{position:absolute;background:#fff;border-radius:20px;padding:10px 16px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
 .logo img{display:block}
 .chip{display:inline-block;background:var(--sun);color:var(--navy);font-weight:800;letter-spacing:.1em;text-transform:uppercase;border-radius:999px}
 h1{font-weight:800;line-height:1.02;letter-spacing:-.02em;text-wrap:balance}
 h1 em{font-style:normal;color:var(--sun)}
 .sub{font-weight:400;line-height:1.3;color:#e9efe9}
 .row{display:flex;align-items:center;flex-wrap:wrap}
 .cta{background:var(--sun);color:var(--navy);font-weight:800;border-radius:16px}
 .url{font-weight:800;color:#fff}.phone{font-weight:600;color:#dfe8e2}
 .fine{font-weight:400;line-height:1.35;color:#c9d6d0}
 .rule{position:absolute;left:0;right:0;bottom:0;height:10px;background:linear-gradient(90deg,var(--forest),var(--sun))}`;

const headline = COPY.h.replace('worth up to $280', '<em>worth up to $280</em>');

function html(size) {
  const s = SIZES[size], {W, H} = s;
  if (size === 'share') {
    // Landscape link preview: copy left, photo right.
    return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
    body{width:${W}px;height:${H}px}
    .photo{right:0;top:0;bottom:0;width:520px}.photo:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,var(--navy) 0,rgba(16,40,60,0) 38%)}
    .logo{left:52px;top:40px}.logo img{height:92px}
    .copy{position:absolute;left:56px;top:172px;width:660px}
    .chip{font-size:18px;padding:8px 16px;margin-bottom:16px}
    h1{font-size:54px;margin-bottom:14px}
    .sub{font-size:22px;margin-bottom:18px;max-width:620px}
    .row{gap:20px}.cta{font-size:24px;padding:13px 24px}.url{font-size:22px}
    .fine{position:absolute;left:56px;right:560px;bottom:22px;font-size:12.5px}
    </style></head><body><div class="photo"><img src="${ph(s.photo)}" style="object-position:${s.focal}"></div>
    <div class="logo"><img src="${logo}"></div>
    <div class="copy"><span class="chip">${COPY.chip}</span><h1>${headline}</h1><p class="sub">${COPY.sub}</p>
    <div class="row"><span class="cta">${COPY.cta} →</span><span class="url">${COPY.url}</span></div></div>
    <p class="fine">${COPY.fine}</p><div class="rule"></div></body></html>`;
  }
  const story = size === 'story', square = size === 'square';
  const photoH = square ? 520 : size === 'portrait' ? 700 : 1080;
  // Story: keep copy clear of the top (≈270px) and bottom (≈330px) app UI.
  const logoTop = story ? 280 : 44, copyTop = photoH - (story ? 210 : 90);
  const hSize = square ? 66 : story ? 84 : 74;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
  body{width:${W}px;height:${H}px}
  .photo{left:0;right:0;top:0;height:${photoH}px}.photo:after{content:"";position:absolute;left:0;right:0;bottom:0;height:220px;background:linear-gradient(180deg,rgba(16,40,60,0),var(--navy))}
  .logo{right:48px;top:${logoTop}px}.logo img{height:${square ? 130 : 150}px}
  .copy{position:absolute;left:64px;right:64px;top:${copyTop}px}
  .chip{font-size:24px;padding:10px 20px;margin-bottom:22px}
  h1{font-size:${hSize}px;margin-bottom:20px}
  .sub{font-size:${story ? 38 : 32}px;margin-bottom:${square ? 26 : 34}px}
  .row{gap:24px}.cta{font-size:32px;padding:18px 32px}.url{font-size:30px}.phone{font-size:24px;width:100%;margin-top:${square ? 6 : 12}px}
  .fine{position:absolute;left:64px;right:64px;bottom:${story ? 340 : 30}px;font-size:${square ? 17 : 19}px}
  </style></head><body><div class="photo"><img src="${ph(s.photo)}" style="object-position:${s.focal}"></div>
  <div class="logo"><img src="${logo}"></div>
  <div class="copy"><span class="chip">${COPY.chip}</span><h1>${headline}</h1><p class="sub">${COPY.sub}</p>
  <div class="row"><span class="cta">${COPY.cta} →</span><span class="url">${COPY.url}</span><span class="phone">or call ${COPY.phone}</span></div></div>
  <p class="fine">${COPY.fine}</p><div class="rule"></div></body></html>`;
}

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {});
  const dir = path.join(out, 'service-saturday'); fs.mkdirSync(dir, {recursive: true});
  for (const size of Object.keys(SIZES)) {
    const {W, H} = SIZES[size];
    const page = await browser.newPage({viewport: {width: W, height: H}, deviceScaleFactor: 1});
    const tmp = path.join(here, '_render.html'); fs.writeFileSync(tmp, html(size));
    await page.goto('file://' + tmp, {waitUntil: 'load'});
    await page.evaluate(() => document.fonts.ready);
    // Fail loudly if any text block overflows its canvas.
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.copy,.fine')].some(e => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.bottom > innerHeight + 1; }));
    if (overflow) throw Error('Text overflows the ' + size + ' canvas');
    const file = path.join(dir, `ynsg-service-saturday-en-${size}-${W}x${H}.jpg`);
    await page.screenshot({path: file, type: 'jpeg', quality: 92});
    if (size === 'share' && shareOut) await page.screenshot({path: shareOut, type: 'jpeg', quality: 88});
    await page.close(); console.log('rendered', path.basename(file));
  }
  fs.rmSync(path.join(here, '_render.html'), {force: true});
  await browser.close();
})();
