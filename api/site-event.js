import {siteCountsEnabled,recordSiteEvent} from '../lib/marketing-db.js';
// First-party, anonymous site counts: a page view, a call tap, a request started or sent, a call-back sent.
// No cookies, IP addresses, user agents or visitor ids are stored; the database keeps per-day totals only.
// Always answers 204 so a counting problem can never affect a visitor.
export const KINDS=new Set(['view','call_tap','request_start','request_sent','callback_sent']);
export const SOURCES=new Set(['direct','google','bing','facebook','nextdoor','other_search','other_site','email']);
export function siteEvent(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const kind=typeof input.kind==='string'?input.kind:'',source=typeof input.source==='string'?input.source:'';
 let page=typeof input.page==='string'?input.page.toLowerCase().replace(/\/+$/,'')||'/':'';
 if(!KINDS.has(kind)||!SOURCES.has(source)||!/^\/[a-z0-9/-]{0,80}$/.test(page)||page.includes('//'))return null;
 return {kind,page,source};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).end();}
 const origin=req.headers.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host)return res.status(204).end();}catch{return res.status(204).end();}}
 if(req.headers['sec-fetch-site']==='cross-site'||Number(req.headers['content-length']||0)>400)return res.status(204).end();
 let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body);}catch{return res.status(204).end();}}
 const event=siteEvent(body);
 // Skip obvious automated traffic.
 if(!event||/bot|crawl|spider|slurp|preview|headless/i.test(String(req.headers['user-agent']||'')))return res.status(204).end();
 if(siteCountsEnabled())try{await recordSiteEvent(req,event);}catch{}
 return res.status(204).end();
}
