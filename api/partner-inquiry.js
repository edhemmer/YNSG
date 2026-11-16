import {websiteGuard} from '../lib/website-guard.js';
import {providerEmail} from '../lib/transactional-email.js';
import {businessIdentity} from '../lib/business-identity.js';
const types=new Set(['Homebuilder or developer','Property manager or landlord','Realtor or real estate office','Farm manager or farm operation','Community or senior-service organization','Veterans or disability organization','Other local business or organization']);
const clean=(v,max)=>typeof v==='string'&&v.trim().length<=max?v.trim():'';
const fail=(res,status)=>res.status(status).json({error:'We could not confirm delivery. Please call or email us instead.'});
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(res,405);}
 const origin=req.headers.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host)return fail(res,403);}catch{return fail(res,403);}}
 if(req.headers['sec-fetch-site']==='cross-site'||Number(req.headers['content-length']||0)>6500||!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Buffer.byteLength(JSON.stringify(req.body))>6500)return fail(res,400);
 const input=req.body;if(typeof input.website==='string'&&input.website.trim())return res.status(200).json({ok:true});
 const type=clean(input.type,80),company=clean(input.company,120),name=clean(input.name,120),email=clean(input.email,254),phone=clean(input.phone,35),location=clean(input.location,150),message=clean(input.message,2000),key=clean(input.requestKey,36);
 if(!types.has(type)||company.length<2||name.length<2||phone.length<7||message.length<10||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^[a-f0-9-]{36}$/i.test(key))return fail(res,400);
 try{
  await websiteGuard(req,'request',{key,email});
  const body=['New business / community partner inquiry','Organization: '+company,'Type: '+type,'Contact: '+name,'Email: '+email,'Phone: '+phone,'Area: '+(location||'Not provided'),'','Request:',message,'','Inquiry ID: '+key].join('\n');
  await providerEmail({action:'send',organization:process.env.CRM_ORGANIZATION_ID,id:key,to:businessIdentity.email,replyTo:email,subject:'YNSG partner inquiry: '+company,body,html:'<pre style="white-space:pre-wrap;font-family:Arial,sans-serif">'+body.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</pre>'});
  return res.status(200).json({ok:true,id:key});
 }catch{console.warn('Partner inquiry could not be confirmed',{code:'DELIVERY_UNAVAILABLE'});return fail(res,503);}
}