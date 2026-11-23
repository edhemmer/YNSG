import {businessIdentity} from '../lib/business-identity.js';
import {priorityServiceCities} from '../packages/domain/service-geography.mjs';
import {sortServiceArticles} from '../site/seasonal-services.js';
import {servicePages,serviceMedia,serviceImage,servicePicker,relatedServices} from './service-experience.mjs';
import {seo,canonicalUrl} from './seo.mjs';
import {loadFixItGuides,guidePages} from './fix-it-guides.mjs';
import {verifyLocalSeo} from './check-local-seo.mjs';
import {icon} from '../site/icons.js';
import {standardizeRequestButtons} from '../site/request-button.js';
import {reviewsSection,ratingBadge} from '../site/reviews.js';
import {meetEdVideo} from '../site/meet-ed.js';
import {serviceSaturday} from '../site/data/service-saturday.js';
import {checkConfig,HELP_OPTIONS,longDate,shortDate} from '../lib/service-saturday.js';
import {existsSync} from 'node:fs';
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
await cp(join(source,'polish.css'), join(output,'polish.css'));
await cp(join(source,'main.js'), join(output,'main.js'));
await cp(join(source,'welcome-voice.js'),join(output,'welcome-voice.js'));
await cp(join(source,'service-catalog.js'),join(output,'service-catalog.js'));
await cp(join(source,'service-selection.js'),join(output,'service-selection.js'));
await cp(join(source,'home-service-picker.js'),join(output,'home-service-picker.js'));
await cp(join(source,'partner-inquiry.js'),join(output,'partner-inquiry.js'));
await cp(join(source,'service-saturday.js'),join(output,'service-saturday.js'));
await cp(join(source,'unsubscribe.js'),join(output,'unsubscribe.js'));
// Service Saturday on/off switch lives in site/data/service-saturday.js.
const ss=checkConfig(serviceSaturday),ssOpen=ss.open===true;
const ssEscape=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ssTokens={SS_HOURS:String(ss.hours),SS_VALUE:String(ss.approximateValue),SS_DEADLINE_ISO:ss.entryDeadline,SS_START_LONG:longDate(ss.startDate),SS_DEADLINE_SHORT:shortDate(ss.entryDeadline),SS_DEADLINE_LONG:longDate(ss.entryDeadline),SS_DRAWING_SHORT:shortDate(ss.drawingDate),SS_DRAWING_LONG:longDate(ss.drawingDate),SS_SERVICE_SHORT:shortDate(ss.serviceDate),SS_SERVICE_LONG:longDate(ss.serviceDate),SS_MIN_ENTRIES:String(ss.minimumEntries),SS_FINAL_LONG:longDate(ss.finalEntryDate),SS_HELP_OPTIONS:HELP_OPTIONS.map(o=>'<option>'+ssEscape(o)+'</option>').join(''),SS_CITY_OPTIONS:priorityServiceCities.map(c=>'<option value="'+ssEscape(c)+'">').join('')};
const ssFill=html=>html.replace(/\{\{(SS_[A-Z_]+)\}\}/g,(m,k)=>{if(!(k in ssTokens))throw Error('Unknown Service Saturday token '+k);return ssTokens[k];});
const ssBanner=ssOpen?ssFill('<section class="seasonal-offer section" data-show-until="{{SS_DEADLINE_ISO}}" aria-labelledby="ss-banner-title"><div class="shell seasonal-offer-inner"><div><p class="overline">Service Saturday · Drawing {{SS_DRAWING_SHORT}}</p><h2 id="ss-banner-title">Enter to Win! {{SS_HOURS}} hours of service, worth up to ${{SS_VALUE}}</h2><p>Nominate a neighbor who could use a hand around the house or yard, or enter for your own home. Free to enter. Entries close {{SS_DEADLINE_SHORT}}.</p><p class="ss-fine-print">No purchase necessary. No cash value. Drawing held once we have {{SS_MIN_ENTRIES}} eligible entries. <a href="/service-saturday-rules/">Official Rules</a>.</p></div><a class="button button-dark" href="/service-saturday/">Enter now <span aria-hidden="true">→</span></a></div></section>'):'';
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
const tokenOk=v=>/^[A-Za-z0-9_-]{20,100}$/.test(v);
const {google:googleVerification,bing:bingVerification}=businessIdentity.searchVerification;
for(const v of [googleVerification,bingVerification])if(v&&!tokenOk(v))throw Error('Invalid search verification token');
const verificationTags=(googleVerification?`<meta name="google-site-verification" content="${googleVerification}">`:'')+(bingVerification?`<meta name="msvalidate.01" content="${bingVerification}">`:'');
const reviewsHtml=reviewsSection(JSON.parse(await readFile(join(source,'data','reviews.json'),'utf8')),businessIdentity.googleReviewUrl)||ratingBadge(JSON.parse(await readFile(join(source,'data','google-rating.json'),'utf8')),businessIdentity.googleReviewUrl.replace(/\/review$/,''));
const meetEdHtml=meetEdVideo({hasVideo:existsSync(join(source,'assets','meet-ed.mp4')),hasPoster:existsSync(join(source,'assets','meet-ed.jpg')),hasCaptions:existsSync(join(source,'assets','meet-ed.vtt'))});
const serviceManifest=JSON.parse(await readFile(join(source,'assets','services','image-manifest.json'),'utf8'));
const fixIt=guidePages(await loadFixItGuides(root),{e164:businessIdentity.phoneE164,display:businessIdentity.phoneDisplay});
const pages = {
  '': ['Small Home Repairs & Yard Help in DeKalb, IL', 'Locally owned home and yard help from DeKalb and Sycamore to St. Charles, IL: small home repairs, grab bars, cleanouts, yard work and snow clearing.', 'home'],
  services: ['Home & Yard Services', 'Lawn mowing, leaf cleanup, mulch, furniture assembly and small cleanouts near St. Charles, Campton Hills, Geneva, Elburn and DeKalb, IL.', 'services'],
  'service-area': ['Service Area: DeKalb to St. Charles', 'Home and yard services for DeKalb, Sycamore, Elburn, Lily Lake, Campton Hills, Geneva and St. Charles, IL. See services and request an appointment.', 'service-area'],
  pricing: ['Estimates & Community Rate', 'Fair hourly rates and individual estimates for home and yard services, with a Community Rate for eligible neighbors.', 'pricing'],
  'careers/small-home-jobs': ['Small Home Job Opportunities in DeKalb, IL', 'Bring furniture assembly and practical home-job skills to YNSG in DeKalb, Elburn, St. Charles and nearby communities. Explore the role and apply online.', 'careers-home-support'],
  'careers/yard-work': ['Yard Work Opportunities in DeKalb, IL', 'Explore lawn, garden and seasonal yard-work opportunities with YNSG in DeKalb, Elburn, St. Charles and nearby communities. Share your experience online.', 'careers-yard-support'],
  careers: ['Home & Yard Careers in DeKalb, IL', 'Bring your home and yard skills to YNSG in DeKalb, Elburn, St. Charles and nearby communities. Veterans encouraged; all qualified applicants welcome.', 'careers'],
  about: ['About Your Neighborhood Service Guy', 'Meet Your Neighborhood Service Guy: small home jobs, lawn care and seasonal yard services in DeKalb, Elburn, St. Charles and nearby Illinois communities.', 'about'],
  request: ['Request a Service Appointment', 'Request home or yard service in DeKalb, Elburn, Campton Hills, St. Charles and nearby communities. No account needed. We confirm appointments after approval.', 'request'],
  'cleanout-dekalb-il': ['Home Cleanouts | DeKalb to St. Charles', 'Request manageable garage, basement and storage cleanouts in DeKalb, Elburn, St. Charles and nearby communities. Disposal fees may apply.', 'cleanout-dekalb-il'],
  'handyman-dekalb-il': ['Small Home Jobs | DeKalb to St. Charles', 'Bring your small home jobs together: furniture assembly, shelving, household setup and minor repairs in DeKalb, Elburn, St. Charles or nearby communities.', 'handyman-dekalb-il'],
  'accessibility-home-safety-dekalb-il': ['Accessibility Help | DeKalb, IL', 'Practical accessibility help: grab bars, wheelchair and walker adjustments, and safer home setups near DeKalb and St. Charles. Community Rate available.', 'accessibility-home-safety-dekalb-il'],
  'lawn-mowing-dekalb-il': ['Lawn Mowing in DeKalb, IL', 'One less job on your weekend list. Request lawn mowing, trimming and edging in DeKalb, Elburn, St. Charles or nearby communities. One-time and recurring care.', 'lawn-mowing-dekalb-il'],
  'leaf-cleanup-dekalb-il': ['Leaf Management in DeKalb, IL', 'Seasonal leaf management in DeKalb, Sycamore, Elburn and St. Charles, IL. You approve an estimate and cap first.', 'leaf-cleanup-dekalb-il'],
  'snow-removal-dekalb-il': ['Residential Snow Removal in DeKalb, IL', 'Get on our winter snow-clearing list in DeKalb, Sycamore, Elburn and St. Charles, IL: driveways, walks and entries, priced per visit.', 'snow-removal-dekalb-il'],
  'mulch-delivery-spreading-dekalb-il': ['Mulch Pickup, Delivery & Spreading in DeKalb, IL', 'Arrange mulch pickup, delivery and spreading in DeKalb, Elburn, St. Charles and nearby communities. Already have mulch? Request spreading help.', 'mulch-delivery-spreading-dekalb-il'],
  'mulch-yard-cleanup-dekalb-il': ['Mulch & Yard Cleanup in DeKalb, IL', 'Mulch, weed pulling, small planting and garden-bed cleanup in DeKalb, Elburn, St. Charles and nearby communities.', 'mulch-yard-cleanup-dekalb-il'],
  'concrete-pressure-washing-dekalb-il': ['Concrete Pressure Washing in DeKalb, IL', 'Refresh your driveway, walks or patio. Request ground-level concrete washing in DeKalb, Elburn, St. Charles and nearby communities. Surface review required.', 'concrete-pressure-washing-dekalb-il'],
  'farm-hand-dekalb-il': ['Farm Hand Services | DeKalb to St. Charles', 'Farm hand services for spring planting, fall harvest support and general farm work from DeKalb toward St. Charles and surrounding Illinois communities.', 'farm-hand-dekalb-il'],
  privacy: ['Privacy Notice', 'How Your Neighborhood Service Guy handles information submitted through the website.', 'privacy'],
  terms: ['Website Terms', 'Terms for using the Your Neighborhood Service Guy website and request form.', 'terms'],
  accessibility: ['Accessibility', 'Accessible ways to use and contact Your Neighborhood Service Guy.', 'accessibility'],
  'business-community-partners': ['Commercial Handyman for Landlords & Churches | DeKalb IL', 'Punch lists, rental turnovers, cleanouts and small repairs for landlords, property managers, offices and churches in DeKalb, Sycamore and St. Charles. Free walkthrough.', 'business-community-partners'],
  'realtors-property-managers': ['For Realtors & Property Managers | DeKalb, IL', 'Punch lists, inspection report fixes, cleanouts, turnovers and yard upkeep for listings and rentals in DeKalb, Sycamore and St. Charles.', 'realtors-property-managers'],
  // Built only when the owner sets PUBLISH_HOME_CARE_PLAN=true (pricing awaiting owner decision).
  ...(process.env.PUBLISH_HOME_CARE_PLAN==='true'?{'home-care-plan':['Home Care Plan | Year-Round Home & Yard Help','Four seasonal home and yard visits a year, priority booking and 10% off extra hours in DeKalb, Sycamore and St. Charles, IL.','home-care-plan']}:{}),
  unsubscribe: ['Unsubscribe from Emails', 'Stop marketing emails from Your Neighborhood Service Guy. Enter your email address; no account needed.', 'unsubscribe'],
  ...(ssOpen?{'service-saturday':['Enter to Win '+ss.hours+' Hours of Service, Worth $'+ss.approximateValue,'Nominate a neighbor or enter your own home for '+ss.hours+' free hours of home and yard help in DeKalb, Sycamore, Elburn, Geneva and St. Charles, IL.','service-saturday'],'service-saturday-rules':['Service Saturday Official Rules','Official rules for the free Service Saturday giveaway from Your Neighborhood Service Guy LLC in DeKalb, Illinois.','service-saturday-rules']}:{}),
  ...fixIt.pages,
  'service-agreement': ['Service Agreement', 'How we set the scope, estimate, not-to-exceed cap and timing for every job, with no surprise charges.', 'service-agreement']
};
const nav = [['services','Services'],['business-community-partners','For Business'],['pricing','Estimates'],['about','About']];
function layout(slug, title, description, body){
  const media=serviceMedia(slug,serviceManifest);
  const farmMedia=slug==='farm-hand-dekalb-il'?{src:'/assets/services/ynsg-farm-hand-midwest.webp',alt:'A Midwestern corn harvest with a combine and farm buildings.',width:480,height:192}:null;
  const socialMedia=media||farmMedia,meta=seo(slug,title,description,socialMedia,fixIt.howTo[slug]||null);
  const ssShare=(slug==='service-saturday'||slug==='service-saturday-rules')?{src:'https://www.yourneighborhoodserviceguy.com/assets/service-saturday-share.jpg',alt:'Enter to Win! 4 hours of service from Your Neighborhood Service Guy, worth up to $280. No purchase necessary. No cash value.',width:1200,height:630}:null;
  const social=ssShare?ssShare:socialMedia?{src:'https://www.yourneighborhoodserviceguy.com'+socialMedia.src,alt:socialMedia.alt,width:socialMedia.width,height:socialMedia.height}:{src:'https://www.yourneighborhoodserviceguy.com/assets/neighbors-social.jpg',alt:'We’re Here to Help. Your Neighborhood Service Guy',width:1280,height:853};
  const seasonalScript='<script src="/seasonal-services.js" type="module"></script>';
  const scripts=seasonalScript+(slug==='business-community-partners'?'<script src="/partner-inquiry.js" type="module"></script>':slug==='service-saturday'?'<script src="/service-saturday.js" type="module"></script>':slug==='unsubscribe'?'<script src="/unsubscribe.js" type="module"></script>':servicePages[slug]?'<script src="/home-service-picker.js" type="module"></script><script src="/public-ui.js" type="module"></script>':slug==='request'?'<script src="/main.js" type="module"></script><script src="/appointment-picker.js" type="module"></script>':slug===''?'<script src="/neighbor-carousel.js" type="module"></script><script type="module">import {welcomeVoice} from "/welcome-voice.js";welcomeVoice(document);</script><script src="/home-service-picker.js" type="module"></script>':'<script src="/public-ui.js" type="module"></script>');
  const preload=media?`<link rel="preload" as="image" type="image/webp" href="${media.src}" imagesrcset="${media.small} 640w, ${media.src} 960w" imagesizes="${media.sizes}" fetchpriority="high">`:slug===''?'<link rel="preload" as="image" type="image/webp" href="/assets/neighbors-seniors-brand-v3-1280.webp" imagesrcset="/assets/neighbors-seniors-brand-v3-640.webp 640w, /assets/neighbors-seniors-brand-v3-1280.webp 1280w" imagesizes="(max-width:850px) calc(100vw - 36px), 740px" fetchpriority="high">':'';
  const socialAlt=social.alt.replaceAll('&','&amp;').replaceAll('\"','&quot;').replaceAll('<','&lt;');
  const canonical = canonicalUrl(slug);
  const primaryLinks = nav.map(([path,label])=>`<a href="/${path}/"${slug===path?' aria-current="page"':''}>${icon(path)}${label}</a>`).join('');
  const links = primaryLinks+'<a href="https://yourneighborhoodserviceguy.app/account">Customer sign in</a>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#10283c">${verificationTags}<title>${meta.title}</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/main.css"><link rel="stylesheet" href="/premium.css"><link rel="stylesheet" href="/ultra.css"><link rel="stylesheet" href="/booking.css"><link rel="stylesheet" href="/request-button.css">${slug===''||slug==='services'||servicePages[slug]||slug==='farm-hand-dekalb-il'?'<link rel="stylesheet" href="/service-experience.css">':''}<link rel="stylesheet" href="/polish.css"><link rel="preload" as="font" type="font/woff2" href="/assets/fonts/outfit-latin-wght-normal.woff2" crossorigin>${preload}${scripts}<script type="application/ld+json">${meta.schema}</script><meta property="og:site_name" content="Your Neighborhood Service Guy"><meta property="og:locale" content="en_US"><meta property="og:type" content="website"><meta property="og:title" content="${meta.title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${social.src}"><meta property="og:image:alt" content="${socialAlt}"><meta property="og:image:width" content="${social.width}"><meta property="og:image:height" content="${social.height}"><meta name="twitter:title" content="${meta.title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${social.src}"><meta name="twitter:image:alt" content="${socialAlt}"><meta name="twitter:card" content="summary_large_image"></head><body class="${slug==='request'?'booking-page':servicePages[slug]||slug==='farm-hand-dekalb-il'?'service-detail-page':''}"><a class="skip" href="#main">Skip to content</a><header class="site-header"><div class="shell header-row"><a class="brand" href="/" aria-label="Your Neighborhood Service Guy home"><img src="/assets/logo.webp" alt="Your Neighborhood Service Guy — Home &amp; Yard. We’re Here to Help." width="280" height="187"></a><nav class="nav-desktop" aria-label="Main">${links}</nav><div class="header-actions"><a class="button button-dark nav-request" href="/request/"><span class="nav-request-full">Request service appointment</span><span class="nav-request-short">Request service appointment</span><span aria-hidden="true">→</span></a></div><nav class="nav-mobile" aria-label="Main mobile navigation">${primaryLinks}</nav></div></header><main id="main">${body}</main><footer class="site-footer"><div class="shell footer-top"><div><p class="footer-name">${businessIdentity.legalName}</p><p>Home &amp; yard services from DeKalb to St. Charles.</p><p class="footer-motto">We’re Here to Help.</p><p class="footer-hours">Hours: ${businessIdentity.hours.label}</p></div><div class="footer-contact"><a href="mailto:${businessIdentity.email}" aria-label="Email ${businessIdentity.email}">${icon('mail')}<span class="footer-email">${businessIdentity.email}</span></a><a href="tel:${businessIdentity.phoneE164}">${icon('phone')}Call ${businessIdentity.phoneDisplay}</a><a href="/request/">${icon('request')}Request service appointment</a><div class="footer-social"><a href="${businessIdentity.googleReviewUrl}" rel="noopener" aria-label="Leave us a Google review">★ Review us</a>${businessIdentity.social.facebook?`<a href="${businessIdentity.social.facebook}" rel="noopener me" aria-label="Follow us on Facebook">Facebook</a>`:''}${businessIdentity.social.instagram?`<a href="${businessIdentity.social.instagram}" rel="noopener me" aria-label="Follow us on Instagram">Instagram</a>`:''}</div></div></div><div class="shell footer-bottom"><nav class="footer-groups" aria-label="Footer"><div><p class="footer-label">Explore</p><a href="/services/">Services</a><a href="/service-area/">Service area</a><a href="/pricing/">Estimates</a><a href="/about/">About</a><a href="/fix-it-guides/">Fix-it guides</a>${process.env.PUBLISH_HOME_CARE_PLAN==='true'?'<a href="/home-care-plan/">Home Care Plan</a>':''}${ssOpen?'<a href="/service-saturday/">Service Saturday</a>':''}</div><div><p class="footer-label">Work with us</p><a href="/business-community-partners/">Businesses, churches &amp; landlords</a><a href="/realtors-property-managers/">Realtors &amp; property managers</a><a href="/careers/">Careers</a></div><div><p class="footer-label">Accounts</p><a href="https://yourneighborhoodserviceguy.app/account">Customer sign in</a><a href="https://yourneighborhoodserviceguy.app/account?mode=signup">Create customer account</a><a href="https://yourneighborhoodserviceguy.app/sign-in">Owner sign in</a></div></nav><div class="footer-legal"><nav aria-label="Legal"><a href="/service-agreement/">Service Agreement</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/accessibility/">Accessibility</a><a href="/unsubscribe/">Email preferences</a></nav><small>© ${new Date().getFullYear()} ${businessIdentity.legalName}</small></div></div></footer><div class="mobile-rail"><a href="/request/">${icon('request')}<span>Request service appointment</span></a></div></body></html>`;
}
for(const [slug,[title,description]] of Object.entries(pages)){
  let body = fixIt.bodies[slug] ?? await readFile(join(source,'pages',slug||'home')+'.html','utf8');
  body=sortServiceArticles(body);
  body=ssFill(body.replaceAll('{{SERVICE_SATURDAY_BANNER}}',ssBanner)).replaceAll('{{FORM}}',form).replaceAll('{{REVIEWS}}',reviewsHtml).replaceAll('{{MEET_ED_VIDEO}}',meetEdHtml);
  if(servicePages[slug])body=body.replace('{{SERVICE_IMAGE}}',serviceImage(slug,serviceManifest)).replace('{{SERVICE_PICKER}}',servicePicker(slug)).replace('{{RELATED_SERVICES}}',relatedServices(slug,serviceManifest));
  const path=slug?join(output,slug):output;
  await mkdir(path,{recursive:true});
  await writeFile(join(path,'index.html'),standardizeRequestButtons(layout(slug,title,description,body)).replace(/href="\/([a-z-]+(?:\/[a-z-]+)*)\/(?=[?#"])/g,'href="/$1'));
}
// Unknown URLs get a helpful, non-indexed page instead of a dead end.
const notFoundBody='<section class="section"><div class="shell"><p class="overline">Page not found</p><h1>We could not find that page.</h1><p>The link may be old or mistyped. These will get you back on track.</p><p class="hero-buttons"><a class="button button-dark" href="/request/">Request service appointment</a> <a class="button" href="/services/">See our services</a> <a class="button" href="tel:'+businessIdentity.phoneE164+'">Call '+businessIdentity.phoneDisplay+'</a></p></div></section>';
await writeFile(join(output,'404.html'),standardizeRequestButtons(layout('not-found','Page not found','This page could not be found. Request home and yard service, browse our services or call us.',notFoundBody)).replace(/<link rel="canonical"[^>]*>/,'<meta name="robots" content="noindex">').replace(/<script type="application\/ld\+json">[^<]*<\/script>/,''));
// While Service Saturday is switched off, old links land on a friendly, non-indexed page.
if(!ssOpen){const closedBody='<section class="section"><div class="shell"><p class="overline">Service Saturday</p><h1>Service Saturday isn\u2019t running right now.</h1><p>Thanks for your interest! Follow us on Facebook to hear about the next one. Need help now?</p><p class="hero-buttons"><a class="button button-dark" href="/request/">Request service appointment <span aria-hidden="true">→</span></a></p></div></section>';for(const dir of ['service-saturday','service-saturday-rules']){await mkdir(join(output,dir),{recursive:true});await writeFile(join(output,dir,'index.html'),standardizeRequestButtons(layout('not-found','Service Saturday','Service Saturday isn\u2019t running right now.',closedBody)).replace(/<link rel="canonical"[^>]*>/,'<meta name="robots" content="noindex">'));}}
await writeFile(join(output,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://www.yourneighborhoodserviceguy.com/sitemap.xml\n');
await writeFile(join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(pages).map(slug=>`<url><loc>${canonicalUrl(slug)}</loc></url>`).join('')}</urlset>`);
await verifyLocalSeo(output);
console.log(`Built ${Object.keys(pages).length} HTML pages.`);


const {verifyBrowserModules}=await import('./check-browser-modules.mjs');
await verifyBrowserModules(output);
