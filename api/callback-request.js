import {websiteGuard} from '../lib/website-guard.js';
import {providerEmail} from '../lib/transactional-email.js';
import {businessIdentity} from '../lib/business-identity.js';
import {callbackLeadsEnabled,saveCallbackLead,MarketingFailure} from '../lib/marketing-db.js';
import {leadSources} from '../site/lead-sources.js';
// Short "call me back" form: name, phone and what they need. The owner is always emailed; the lead
// is also saved to the CRM call list once CALLBACK_LEADS_ENABLED=true. Nothing here texts or calls anyone.
const known=new Set(leadSources);
const clean=(v,max)=>typeof v==='string'&&v.trim().length<=max?v.trim():'';
const markup=/[\u0000-\u001f\u007f<>]/;
const fail=(res,status,error='We could not confirm your request was received. Please call or text 815-680-1775.')=>res.status(status).json({error});
export function callbackInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const name=clean(input.name,120),phone=clean(input.phone,35),need=clean(input.need,500),leadSource=clean(input.leadSource,60),referredBy=clean(input.referredBy,120),key=clean(input.requestKey,36);
 if(name.length<2||phone.length<7||(phone.match(/[0-9]/g)||[]).length<7||need.length<3||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key))return null;
 if([name,phone,need,referredBy].some(v=>markup.test(v))||(leadSource&&!known.has(leadSource))||(referredBy&&referredBy.length<2))return null;
 return {key:key.toLowerCase(),data:{name,phone,need,...(leadSource?{leadSource}:{}),...(referredBy?{referredBy}:{})}};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(res,405);}
 const origin=req.headers.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host)return fail(res,403);}catch{return fail(res,403);}}
 if(req.headers['sec-fetch-site']==='cross-site'||Number(req.headers['content-length']||0)>3000||!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Buffer.byteLength(JSON.stringify(req.body))>3000)return fail(res,400,'Please check the form and try again.');
 if(typeof req.body.website==='string'&&req.body.website.trim())return res.status(200).json({ok:true});
 const parsed=callbackInput(req.body);
 if(!parsed)return fail(res,400,'Please add your name, a phone number and a few words about what you need.');
 const {key,data}=parsed;
 try{await websiteGuard(req,'request',{key});}catch(error){if(error?.status===429){res.setHeader('Retry-After','3600');return fail(res,429,'Please wait a few minutes before trying again, or call 815-680-1775.');}return fail(res,503);}
 let saved=false;
 if(callbackLeadsEnabled()){
  try{await saveCallbackLead(req,key,data);saved=true;}
  catch(error){if(error instanceof MarketingFailure&&error.status===429)return fail(res,429,'Please wait a few minutes before trying again, or call 815-680-1775.');console.warn('Call-back lead not saved',{code:error instanceof MarketingFailure?error.code:'UNAVAILABLE'});}
 }
 let emailed=false;
 try{
  const body=['Call-back request from the website','Name: '+data.name,'Phone: '+data.phone,'Needs: '+data.need,'Heard about us: '+(data.leadSource||'Not given'),...(data.referredBy?['Referred by: '+data.referredBy]:[]),'',saved?'Saved to the call list in the CRM.':'Not saved to the CRM call list yet. Log it after you call.','','Request ID: '+key].join('\n');
  await providerEmail({action:'send',organization:process.env.CRM_ORGANIZATION_ID,id:key,to:businessIdentity.email,subject:'Call back: '+data.name+' ('+data.phone+')',body,html:'<pre style="white-space:pre-wrap;font-family:Arial,sans-serif">'+body.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</pre>'});
  emailed=true;
 }catch{console.warn('Call-back email not sent',{code:'DELIVERY_UNAVAILABLE'});}
 if(!saved&&!emailed)return fail(res,503);
 return res.status(200).json({ok:true,id:key});
}
