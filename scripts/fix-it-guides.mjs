// Public fix-it guides: homeowner versions of selected CRM field guides (site/data/fix-it-guides.json).
// Each guide renders as a crawlable page with the steps visible, a clear "when to call a pro" note
// and a way to hand the job to us. Content is plain text from the JSON, escaped here.
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const HUB='fix-it-guides';

export async function loadFixItGuides(root){
 const {guides}=JSON.parse(await readFile(join(root,'site','data','fix-it-guides.json'),'utf8'));
 const slugs=new Set(guides.map(g=>g.slug));
 if(slugs.size!==guides.length)throw Error('Duplicate fix-it guide slug');
 for(const g of guides){
  for(const key of ['slug','title','description','intro','symptoms','level','time','callPro'])if(!g[key])throw Error('Fix-it guide '+g.slug+' missing '+key);
  if(!g.steps?.length)throw Error('Fix-it guide '+g.slug+' has no steps');
 }
 return guides;
}

// Cross-links one guide's text to another published guide ("see the stripped-screw-hole guide").
const linkGuides=(text,guides)=>{
 let html=esc(text);
 for(const g of guides)html=html.replace(new RegExp('\\(?see the '+g.slug.replace(/-/g,'[- ]')+' guide\\)?','gi'),`(see <a href="/${HUB}/${g.slug}">${esc(g.title.replace(/^How to /,''))}</a>)`);
 return html;
};

export function guidePages(guides,phone){
 const pages={},bodies={},howTo={};
 const callBox=()=>`<aside class="pricing-card pricing-special fix-it-cta" aria-label="Get help with this job"><h2>Rather have it done?</h2><p>Your Neighborhood Service Guy is a locally owned home and yard service in DeKalb. Ed can take care of this for you, along with anything else on your list.</p><p class="hero-buttons"><a class="button button-dark" href="/request/">Request service appointment <span aria-hidden="true">→</span></a> <a class="button" href="tel:${phone.e164}">Call ${phone.display}</a></p></aside>`;
 pages[HUB]=['Home Fix-It Guides for DeKalb Homeowners','Free step-by-step guides for the small fixes around the house: sticking doors, stripped screws, cabinet hinges, drawer slides, drywall patches and grab bars.',HUB];
 bodies[HUB]=`<section class="page-hero compact"><div class="shell"><p class="overline">Fix-it guides</p><h1>Small fixes you can handle yourself</h1><p>Plain-English guides for the little things that go wrong around the house. Each one tells you what to check first, the steps, the tools, and when it is time to call for help.</p></div></section><div class="shell policy"><ul class="fix-it-list">${guides.map(g=>`<li><a href="/${HUB}/${g.slug}"><strong>${esc(g.title)}</strong></a><br><span>${esc(g.level)} · ${esc(g.time)}. ${esc(g.intro)}</span></li>`).join('')}</ul>${callBox()}<p class="fix-it-note">These guides are general information for common household fixes. Follow the instructions that came with your product, and stop if anything looks unsafe. We don't do work that needs a licensed trade, such as plumbing, electrical, gas or structural repairs.</p></div>`;
 for(const g of guides){
  const slug=HUB+'/'+g.slug;
  pages[slug]=[g.title+' | DeKalb, IL',g.description,slug];
  howTo[slug]={title:g.title,description:g.description,steps:g.steps,tools:g.tools||[],parts:g.parts||[]};
  const list=(items,tag='ul')=>items?.length?`<${tag}>${items.map(i=>`<li>${linkGuides(i,guides)}</li>`).join('')}</${tag}>`:'';
  const service=g.service?`<p>Need it done instead? See our <a href="/${g.service.slug}">${esc(g.service.label)}</a>.</p>`:'';
  const reading=g.furtherReading?.url?`<h2>Further reading</h2><p><a href="${esc(g.furtherReading.url)}" rel="noopener">${esc(g.furtherReading.name)}</a></p>`:'';
  const others=guides.filter(o=>o.slug!==g.slug).slice(0,4).map(o=>`<li><a href="/${HUB}/${o.slug}">${esc(o.title)}</a></li>`).join('');
  bodies[slug]=`<section class="page-hero compact"><div class="shell"><nav class="service-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/${HUB}">Fix-it guides</a></nav><h1>${esc(g.title)}</h1><p>${esc(g.intro)}</p><p class="fix-it-meta"><strong>Skill:</strong> ${esc(g.level)} · <strong>Time:</strong> ${esc(g.time)}</p></div></section><div class="shell policy"><p><strong>Sound familiar?</strong> ${esc(g.symptoms)}</p><h2>Check this first</h2>${list(g.quickCheck)}<h2>Step by step</h2><ol>${g.steps.map((s,i)=>`<li id="step-${i+1}"><strong>${esc(s.title)}.</strong> ${linkGuides(s.detail,guides)}</li>`).join('')}</ol>${g.tips?.length?'<h2>Tips that save time</h2>'+list(g.tips):''}${g.tools?.length?'<h2>Tools</h2>'+list(g.tools):''}${g.parts?.length?'<h2>Parts and supplies</h2>'+list(g.parts):''}<h2>When to call a pro</h2><p>${esc(g.callPro)}</p>${callBox()}${service}${reading}<h2>More fix-it guides</h2><ul>${others}</ul><p><a href="/${HUB}">See all fix-it guides</a></p></div>`;
 }
 return {pages,bodies,howTo};
}
