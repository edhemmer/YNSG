import {websiteHold} from '../lib/website-guard.js';
import {appointmentSelection} from '../lib/appointment-window.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Request not accepted.'});}
 try{
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Request not accepted.'});
  if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Request not accepted.'});
  const d=req.body;
  if(Number(req.headers['content-length']||0)>2000||!d||typeof d!=='object'||Array.isArray(d)||Buffer.byteLength(JSON.stringify(d))>2000)return res.status(400).json({error:'Please check your appointment selection.'});
  if(typeof d.website==='string'&&d.website.trim())return res.status(400).json({error:'Please check your appointment selection.'});
  if(!['select','release'].includes(d.action)||!uuid.test(d.key||'')||!uuid.test(d.clientKey||'')||(d.token!==null&&!/^[a-f0-9]{64}$/.test(d.token||'')))return res.status(400).json({error:'Please check your appointment selection.'});
  const start=d.action==='select'?appointmentSelection({mode:'once',start:d.start}).start:null;
  if(d.action==='select'&&!start)return res.status(400).json({error:'Please choose a date and time.'});
  return res.status(200).json(await websiteHold(req,{action:d.action,key:d.key,clientKey:d.clientKey,token:d.token,start}));
 }catch(error){
  const status=[409,429].includes(error.status)?error.status:503;
  return res.status(status).json({error:status===409?'That time is no longer available. Please choose another time.':status===429?'Please wait a moment before checking another time, or call 770-630-2094.':'We couldn’t hold that time. Please try again, or send your request without a time.'});
 }
}
