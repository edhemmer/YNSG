import {businessIdentity} from '../lib/business-identity.js';
import {priorityServiceCities} from '../packages/domain/service-geography.mjs';
import {sortServiceArticles} from '../site/seasonal-services.js';
import {servicePages,serviceMedia,serviceImage,servicePicker,relatedServices} from './service-experience.mjs';
import {seo,canonicalUrl} from './seo.mjs';
import {verifyLocalSeo} from './check-local-seo.mjs';
import {icon} from '../site/icons.js';
import {standardizeRequestButtons} from '../site/request-button.js';
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
const root = process.cwd();
const source = join(root, 'site');
const output = join(root, 'dist');
await rm(output, {recursive:true, force:true});
await mkdir(output, {recursive:true});
await cp(join(source,'assets'), join(output,'assets'), {recursive:true});
await cp(join(source,'main.css'), join(output,'main.css'));
await cp(join(source,'premium.css'), join(output,'premium.css'));
await cp(join(source,'ultra.css'), join(output,'ultra.css'));
await cp(join(source,'service-experience.css'),join(output,'service-experience.css'));
await cp(join(source,'booking.css'),join(output,'booking.css'));
await cp(join(source,'request-button.css'),join(output,'request-button.css'));
await cp(join(source,'franchise.css'), join(output,'franchise.css'));
await cp(join(source,'main.js'), join(output,'main.js'));
await cp(join(source,'welcome-voice.js'),join(output,'welcome-voice.js'));
await cp(join(source,'service-catalog.js'),join(output,'service-catalog.js'));
await cp(join(source,'service-selection.js'),join(output,'service-selection.js'));
await cp(join(source,'home-service-picker.js'),join(output,'home-service-picker.js'));
await cp(join(source,'booking-journey.js'),join(output,'booking-journey.js'));
await cp(join(source,'address-check.js'),join(output,'address-check.js'));
await cp(join(source,'city-postal-codes.js'),join(output,'city-postal-codes.js'));
await mkdir(join(output,'packages','domain'),{recursive:true});
await cp(join(root,'packages','domain','service-geography.mjs'),join(output,'packages','domain','service-geography.mjs'));
await cp(join(source,'neighbor-carousel.js'),join(output,'neighbor-carousel.js'));
await cp(join(source,'seasonal-services.js'),join(output,'seasonal-services.js'));
await cp(join(source,'public-ui.js'),join(output,'public-ui.js'));
await cp(join(source,'request-delivery.js'),join(output,'request-delivery.js'));
await cp(join(source,'request-recovery.js'),join(output,'request-recovery.js'));
await cp(join(source,'appointment-picker.js'),join(output,'appointment-picker.js'));
await cp(join(source,'appointment-hold.js'),join(output,'appointment-hold.js'));
await cp(join(root,'lib','appointment-window.js'),join(output,'appointment-window.js'));
const formTemplate = await readFile(join(source,'pages','form.html'),'utf8');
// Rendering the city hints from the shared policy eliminates drift. Free-text intake remains open.
const targetDatalist='<datalist id="nearby-cities">'+priorityServiceCities.map(city=>'<option value="'+city+'">').join('')+'</datalist>';
if(!/<datalist id="nearby-cities">[\s\S]*?<\/datalist>/.test(formTemplate))throw Error('Missing customer city suggestions');
const form=formTemplate.replace(/<datalist id="nearby-cities">[\s\S]*?<\/datalist>/,targetDatalist);
const serviceManifest=JSON.parse(await readFile(join(source,'assets','services','image-manifest.json'),'utf8'));
const pages = {
  '': ['Lawn & Home Services | DeKalb to St. Charles, IL', 'Lawn care, yard cleanup, mulch spreading and small home jobs in DeKalb, Elburn, Campton Hills, Geneva and St. Charles, IL. Request service online.', 'home'],
  services: ['Home & Yard Services', 'Lawn mowing, leaf cleanup, mulch, furniture assembly and small cleanouts near St. Charles, Campton Hills, Geneva, Elburn and DeKalb, IL.', 'services'],
  'service-area': ['Service Area: DeKalb to St. Charles', 'Home and yard services for DeKalb, Sycamore, Elburn, Lily Lake, Campton Hills, Geneva and St. Charles, IL. See services and request an appointment.', 'service-area'],
  pricing: ['Pricing & Community Rate', 'Home and yard labor is $60 per person per hour, or $45 Community Rate. A two-hour minimum applies to the first person. See rates and examples.', 'pricing'],
  'careers/small-home-jobs': ['Handyman & Small Home Job Opportunities in DeKalb, IL', 'Bring furniture assembly and practical home-job skills to YNSG in DeKalb, Elburn, St. Charles and nearby communities. Explore the role and apply online.', 'careers-home-support'],
  'careers/yard-work': ['Yard Work Opportunities in DeKalb, IL', 'Explore lawn, garden and seasonal yard-work opportunities with YNSG in DeKalb, Elburn, St. Charles and nearby communities. Share your experience online.', 'careers-yard-support'],
  careers: ['Home & Yard Careers in DeKalb, IL', 'Bring your home and yard skills to YNSG in DeKalb, Elburn, St. Charles and nearby communities. Veterans encouraged; all qualified applicants welcome.', 'careers'],
  about: ['About Your Neighborhood Service Guy', 'Meet Your Neighborhood Service Guy: small home jobs, lawn care and seasonal yard services in DeKalb, Elburn, St. Charles and nearby Illinois communities.', 'about'],
  request: ['Request a Service Appointment', 'Request home or yard service in DeKalb, Elburn, Campton Hills, St. Charles and nearby communities. No account needed. We confirm appointments after approval.', 'request'],
  'cleanout-dekalb-il': ['Home Cleanouts | DeKalb to St. Charles', 'Request manageable garage, basement and storage cleanouts in DeKalb, Elburn, St. Charles and nearby communities. Disposal fees may apply.', 'cleanout-dekalb-il'],
  'handyman-dekalb-il': ['Small Handyman Jobs | DeKalb to St. Charles', 'Bring your small home jobs together: furniture assembly, shelving, household setup and minor repairs in DeKalb, Elburn, St. Charles or nearby communities.', 'handyman-dekalb-il'],
  'lawn-mowing-dekalb-il': ['Lawn Mowing in DeKalb, IL', 'One less job on your weekend list. Request lawn mowing, trimming and edging in DeKalb, Elburn, St. Charles or nearby communities. One-time and recurring care.', 'lawn-mowing-dekalb-il'],
  'leaf-cleanup-dekalb-il': ['Leaf Management in DeKalb, IL', 'Seasonal leaf management with a plan that fits your yard. Tell us what you need in DeKalb, Elburn, St. Charles or nearby communities and request a visit.', 'leaf-cleanup-dekalb-il'],
  'snow-removal-dekalb-il': ['Residential Snow Removal in DeKalb, IL', 'Request residential snow clearing in DeKalb, Elburn, St. Charles or nearby communities. Tell us which driveway, walkway or home entry needs attention.', 'snow-removal-dekalb-il'],
  'mulch-delivery-spreading-dekalb-il': ['Mulch Pickup, Delivery & Spreading in DeKalb, IL', 'Arrange mulch pickup, delivery and spreading in DeKalb, Elburn, St. Charles and nearby communities. Already have mulch? Request spreading help.', 'mulch-delivery-spreading-dekalb-il'],
  'mulch-yard-cleanup-dekalb-il': ['Mulch & Yard Cleanup in DeKalb, IL', 'A little help for your outdoor list: mulch, hand weeding, small planting and garden-bed cleanup in DeKalb, Elburn, St. Charles and nearby communities.', 'mulch-yard-cleanup-dekalb-il'],
  'concrete-pressure-washing-dekalb-il': ['Concrete Pressure Washing in DeKalb, IL', 'Refresh your driveway, walks or patio. Request ground-level concrete washing in DeKalb, Elburn, St. Charles and nearby communities. Surface review required.', 'concrete-pressure-washing-dekalb-il'],
  'farm-hand-dekalb-il': ['Farm Hand Services | DeKalb to St. Charles', 'Farm hand services for spring planting, fall harvest support and general farm work from DeKalb toward St. Charles and surrounding Illinois communities.', 'farm-hand-dekalb-il'],
  franchise: ['Franchise Opportunity', 'Explore a neighborhood service franchise with cloud technology, AI-supported administration, local marketing support and a proposed protected territory.', 'franchise'],
  privacy: ['Privacy Notice', 'How Your Neighborhood Service Guy handles information submitted through the website.', 'privacy'],
  terms: ['Website Terms', 'Terms for using the Your Neighborhood Service Guy website and request form.', 'terms'],
  accessibility: ['Accessibility', 'Accessible ways to use and contact Your Neighborhood Service Guy.', 'accessibility'],
  'service-agreement': ['Service Agreement', 'How we document the scope, timing and cost of an accepted service job.', 'service-agreement']
};
const nav = [['services','Services'],['pricing','Pricing'],['about','About']];
function layout(slug, title, description, body){
  const media=serviceMedia(slug,serviceManifest);
  const farmMedia=slug==='farm-hand-dekalb-il'?{src:'/assets/services/ynsg-farm-hand-midwest.webp',alt:'A Midwestern corn harvest with a combine and farm buildings.',width:480,height:192}:null;
  const socialMedia=media||farmMedia,meta=seo(slug,title,description,socialMedia);
  const social=socialMedia?{src:'https://www.yourneighborhoodserviceguy.com'+socialMedia.src,alt:socialMedia.alt,width:socialMedia.width,height:socialMedia.height}:{src:'https://www.yourneighborhoodserviceguy.com/assets/neighbors-social.jpg',alt:'We’re Here to Help. Your Neighborhood Service Guy',width:1280,height:853};
  const seasonalScript='<script src="/seasonal-services.js" type="module"></script>';
  const scripts=seasonalScript+(servicePages[slug]?'<script src="/home-service-picker.js" type="module"></script><script src="/public-ui.js" type="module"></script>':slug==='request'?'<script src="/main.js" type="module"></script><script src="/appointment-picker.js" type="module"></script>':slug===''?'<script src="/neighbor-carousel.js" type="module"></script><script type="module">import {welcomeVoice} from "/welcome-voice.js";welcomeVoice(document);</script><script src="/home-service-picker.js" type="module"></script>':'<script src="/public-ui.js" type="module"></script>');
  const preload=media?`<link rel="preload" as="image" type="image/webp" href="${media.src}" imagesrcset="${media.small} 640w, ${media.src} 960w" imagesizes="${media.sizes}" fetchpriority="high">`:slug===''?'<link rel="preload" as="image" type="image/webp" href="/assets/neighbors-seniors-brand-v3-1280.webp" imagesrcset="/assets/neighbors-seniors-brand-v3-640.webp 640w, /assets/neighbors-seniors-brand-v3-1280.webp 1280w" imagesizes="(max-width:850px) calc(100vw - 36px), 740px" fetchpriority="high">':'';
  const socialAlt=social.alt.replaceAll('&','&amp;').replaceAll('\"','&quot;').replaceAll('<','&lt;');
  const canonical = canonicalUrl(slug);
  const links = nav.map(([path,label])=>`<a href="/${path}/"${slug===path?' aria-current="page"':''}>${icon(path)}${label}</a>`).join('')+'<a href="https://yourneighborhoodserviceguy.app/account">Customer sign in</a>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#10283c"><title>${meta.title}</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/main.css"><link rel="stylesheet" href="/premium.css"><link rel="stylesheet" href="/ultra.css"><link rel="stylesheet" href="/booking.css"><link rel="stylesheet" href="/request-button.css">${slug===''||slug==='services'||servicePages[slug]||slug==='farm-hand-dekalb-il'?'<link rel="stylesheet" href="/service-experience.css">':''}${slug==='franchise'?'<link rel="stylesheet" href="/franchise.css">':''}${preload}${scripts}<script type="application/ld+json">${meta.schema}</script><meta property="og:site_name" content="Your Neighborhood Service Guy"><meta property="og:locale" content="en_US"><meta property="og:type" content="website"><meta property="og:title" content="${meta.title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${social.src}"><meta property="og:image:alt" content="${socialAlt}"><meta property="og:image:width" content="${social.width}"><meta property="og:image:height" content="${social.height}"><meta name="twitter:title" content="${meta.title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${social.src}"><meta name="twitter:image:alt" content="${socialAlt}"><meta name="twitter:card" content="summary_large_image"></head><body class="${slug==='request'?'booking-page':servicePages[slug]||slug==='farm-hand-dekalb-il'?'service-detail-page':''}"><a class="skip" href="#main">Skip to content</a><header class="site-header"><div class="shell header-row"><a class="brand" href="/" aria-label="Your Neighborhood Service Guy home"><img src="/assets/logo.jpg" alt="Your Neighborhood Service Guy — Home &amp; Yard. We’re Here to Help." width="280" height="187"></a><nav class="nav-desktop" aria-label="Main">${links}</nav><div class="header-actions"><a class="call-link" href="tel:${businessIdentity.phoneE164}">${icon('phone')}<span class="call-label">Call</span><span class="call-number">${businessIdentity.phoneDisplay}</span></a><a class="button button-dark nav-request" href="/request/"><span class="nav-request-full">Request service appointment</span><span class="nav-request-short">Request service appointment</span><span aria-hidden="true">↗</span></a></div><nav class="nav-mobile" aria-label="Main mobile navigation">${links}</nav></div></header><main id="main">${body}</main><footer class="site-footer"><div class="shell footer-top"><div><p class="footer-name">${businessIdentity.legalName}</p><p>Servicing your neighborhood. Home &amp; yard services from the DeKalb area toward St. Charles.</p><p class="footer-motto">We’re Here to Help.</p></div><div class="footer-contact"><a href="tel:${businessIdentity.phoneE164}">${icon('phone')}Call ${businessIdentity.phoneDisplay}</a><a href="sms:${businessIdentity.phoneE164}">Text ${businessIdentity.phoneDisplay}</a><a href="/request/">${icon('request')}Request service appointment</a></div></div><div class="shell footer-bottom"><nav aria-label="Footer"><a href="/services/">Services</a><a href="/service-area/">Service area</a><a href="/pricing/">Pricing</a><a href="/about/">About</a><a href="/careers/">Careers</a><a href="/service-agreement/">Service Agreement</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/accessibility/">Accessibility</a><a href="/franchise/">Franchise opportunity</a><a href="https://yourneighborhoodserviceguy.app/account">Customer sign in</a><a href="https://yourneighborhoodserviceguy.app/account?mode=signup">Create customer account</a><a href="https://yourneighborhoodserviceguy.app/sign-in">Owner sign in</a></nav><small>© ${new Date().getFullYear()} ${businessIdentity.legalName}</small></div></footer><div class="mobile-rail"><a href="tel:${businessIdentity.phoneE164}">${icon('phone')}<span>Press to call</span></a><a href="/request/">${icon('request')}<span>Request service appointment</span></a></div></body></html>`;
}
for(const [slug,[title,description]] of Object.entries(pages)){
  let body = await readFile(join(source,'pages',slug||'home')+'.html','utf8');
  body=sortServiceArticles(body);
  body=body.replaceAll('{{FORM}}',form);
  if(servicePages[slug])body=body.replace('{{SERVICE_IMAGE}}',serviceImage(slug,serviceManifest)).replace('{{SERVICE_PICKER}}',servicePicker(slug)).replace('{{RELATED_SERVICES}}',relatedServices(slug,serviceManifest));
  const path=slug?join(output,slug):output;
  await mkdir(path,{recursive:true});
  await writeFile(join(path,'index.html'),standardizeRequestButtons(layout(slug,title,description,body)).replace(/href="\/([a-z-]+(?:\/[a-z-]+)*)\/(?=[?#"])/g,'href="/$1'));
}
await writeFile(join(output,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://www.yourneighborhoodserviceguy.com/sitemap.xml\n');
await writeFile(join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(pages).map(slug=>`<url><loc>${canonicalUrl(slug)}</loc><lastmod>${new Date().toISOString().slice(0,10)}</lastmod></url>`).join('')}</urlset>`);
await verifyLocalSeo(output);
console.log(`Built ${Object.keys(pages).length} HTML pages.`);


const {verifyBrowserModules}=await import('./check-browser-modules.mjs');
await verifyBrowserModules(output);
