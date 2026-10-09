import {seo} from './seo.mjs';
import {icon} from '../site/icons.js';
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
await cp(join(source,'main.js'), join(output,'main.js'));
await cp(join(source,'neighbor-carousel.js'),join(output,'neighbor-carousel.js'));
await cp(join(source,'public-ui.js'),join(output,'public-ui.js'));
await cp(join(source,'request-delivery.js'),join(output,'request-delivery.js'));
await cp(join(source,'request-recovery.js'),join(output,'request-recovery.js'));
await cp(join(source,'appointment-picker.js'),join(output,'appointment-picker.js'));
await cp(join(source,'appointment-hold.js'),join(output,'appointment-hold.js'));
await cp(join(root,'lib','appointment-window.js'),join(output,'appointment-window.js'));
const form = await readFile(join(source,'pages','form.html'),'utf8');
const pages = {
  '': ['Home & Yard Help in DeKalb, Sycamore & Cortland', 'Small home and yard jobs in DeKalb, Sycamore and Cortland. Especially serving seniors 70+, veterans, single moms and people with disabilities.', 'home'],
  services: ['Home & Yard Services', 'Lawn care, yard and garden help, concrete pressure washing, residential snow clearing and small jobs around the home in DeKalb, Sycamore and Cortland.', 'services'],
  pricing: ['Pricing & Community Rate', 'Clear hourly home and yard labor rates and a Community Rate for seniors, veterans, single moms and people with disabilities.', 'pricing'],
  about: ['About Your Neighborhood Service Guy', 'Why we started a local service for the small home and yard jobs that keep getting pushed back.', 'about'],
  request: ['Request a Service Appointment', 'Request a home or yard service appointment in DeKalb, Sycamore or Cortland. We will confirm scope, cost and timing.', 'request'],
  privacy: ['Privacy Notice', 'How Your Neighborhood Service Guy handles information submitted through the website.', 'privacy'],
  terms: ['Website Terms', 'Terms for using the Your Neighborhood Service Guy website and request form.', 'terms'],
  accessibility: ['Accessibility', 'Accessible ways to use and contact Your Neighborhood Service Guy.', 'accessibility'],
  'service-agreement': ['Service Agreement', 'How we document the scope, timing and cost of an accepted service job.', 'service-agreement']
};
const nav = [['services','Services'],['pricing','Pricing'],['about','About']];
function layout(slug, title, description, body){
  const meta=seo(slug,title,description);
  const scripts=slug==='request'?'<script src="/main.js" type="module"></script><script src="/appointment-picker.js" type="module"></script>':slug===''?'<script src="/neighbor-carousel.js" type="module"></script>':'<script src="/public-ui.js" type="module"></script>';
  const preload=slug===''?'<link rel="preload" as="image" type="image/webp" href="/assets/neighbors-seniors-1280.webp" imagesrcset="/assets/neighbors-seniors-640.webp 640w, /assets/neighbors-seniors-1280.webp 1280w" imagesizes="(max-width:850px) calc(100vw - 36px), 740px" fetchpriority="high">':'';
  const canonical = 'https://www.yourneighborhoodserviceguy.com/' + (slug ? slug+'/' : '');
  const links = nav.map(([path,label])=>`<a href="/${path}/"${slug===path?' aria-current="page"':''}>${icon(path)}${label}</a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#10283c"><title>${meta.title}</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/main.css"><link rel="stylesheet" href="/premium.css">${preload}${scripts}<script type="application/ld+json">${meta.schema}</script><meta property="og:type" content="website"><meta property="og:title" content="${meta.title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="https://www.yourneighborhoodserviceguy.com/assets/neighbors-social.jpg"><meta property="og:image:alt" content="We’re Here to Help. Your Neighborhood Service Guy"><meta property="og:image:width" content="1280"><meta property="og:image:height" content="853"><meta name="twitter:title" content="${meta.title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="https://www.yourneighborhoodserviceguy.com/assets/neighbors-social.jpg"><meta name="twitter:card" content="summary_large_image"></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><div class="shell header-row"><a class="brand" href="/" aria-label="Your Neighborhood Service Guy home"><img src="/assets/logo.jpg" alt="Your Neighborhood Service Guy — Home and Yard. We're Here to Help." width="180" height="120"></a><nav class="nav-desktop" aria-label="Main">${links}</nav><div class="header-actions"><a class="call-link" href="tel:+17706302094">${icon('phone')}Press to call <span>770-630-2094</span></a><a class="button button-dark nav-request" href="/request/">Request service appt <span aria-hidden="true">↗</span></a></div><details class="nav-mobile"><summary>Menu <span aria-hidden="true">☰</span></summary><nav aria-label="Mobile">${links}<a href="/request/">${icon('request')}Request service appt</a><a href="tel:+17706302094">${icon('phone')}Call 770-630-2094</a></nav></details></div></header><main id="main">${body}</main><footer class="site-footer"><div class="shell footer-top"><div><p class="footer-name">Your Neighborhood Service Guy</p><p>Home &amp; yard help in DeKalb, Sycamore and Cortland, Illinois.</p><p class="footer-motto">We’re Here to Help.</p></div><div class="footer-contact"><a href="tel:+17706302094">${icon('phone')}Call 770-630-2094</a><a href="sms:+17706302094">Text 770-630-2094</a><a href="/request/">${icon('request')}Request service appt</a></div></div><div class="shell footer-bottom"><nav aria-label="Footer"><a href="/services/">Services</a><a href="/pricing/">Pricing</a><a href="/about/">About</a><a href="/service-agreement/">Service Agreement</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/accessibility/">Accessibility</a></nav><small>© ${new Date().getFullYear()} Your Neighborhood Service Guy</small></div></footer><div class="mobile-rail"><a href="tel:+17706302094">${icon('phone')}<span>Press to call</span></a><a href="/request/">${icon('request')}<span>Request service appt</span></a></div></body></html>`;
}
for(const [slug,[title,description]] of Object.entries(pages)){
  let body = await readFile(join(source,'pages',slug||'home')+'.html','utf8');
  body=body.replaceAll('{{FORM}}',form);
  const path=slug?join(output,slug):output;
  await mkdir(path,{recursive:true});
  await writeFile(join(path,'index.html'),layout(slug,title,description,body));
}
await writeFile(join(output,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: https://www.yourneighborhoodserviceguy.com/sitemap.xml\n');
await writeFile(join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(pages).map(slug=>`<url><loc>https://www.yourneighborhoodserviceguy.com/${slug?slug+'/':''}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${Object.keys(pages).length} HTML pages.`);
