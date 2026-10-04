import {appointmentSelection} from '../lib/appointment-window.js';
import {websiteAvailability} from '../lib/website-availability.js';
import {ownerRequestEmail} from '../lib/owner-request-email.js';
import { randomUUID } from 'node:crypto';
import { saveCrmRequest, IntakeFailure } from '../lib/public-intake.js';
const services = new Set(['Lawn care','Yard & garden','Snow clearing','Help around the home','Concrete pressure washing','Something else']);
const tasks = {
  'Help around the home':['Furniture assembly','Shelving and organizing','Household product setup','Lightweight hanging','Small drywall patch','Moving manageable items','Several small jobs'],
  'Lawn care':['Mowing','Trimming and edging','Mow, trim and blow-off','Leaf management','Recurring lawn care'],
  'Yard & garden':['Pulling weeds by hand','Bulk or bagged mulch pickup, delivery & spreading','Spreading mulch','Planting small bushes','Planting flowers','Small bush trimming','Garden-bed cleanup','Moving yard materials'],
  'Snow clearing':['Residential driveway','Sidewalks and walkways','Accessible entry','Driveway and walks'],
  'Concrete pressure washing':['Concrete driveway','Concrete walks','Concrete patio'],
  'Something else':['Describe below']
};
const cities = new Set(['DeKalb','Sycamore','Cortland']);
const fail = (res,status,error) => res.status(status).json({error});
const clean = (value,max) => typeof value === 'string' ? value.trim().slice(0,max+1) : '';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(res,405,'Method not allowed.');}
  const host=req.headers.host;
  const origin=req.headers.origin;
  if(origin){try{if(new URL(origin).host!==host)return fail(res,403,'Request not accepted.');}catch{return fail(res,403,'Request not accepted.');}}
  if(Number(req.headers['content-length']||0)>12000)return fail(res,413,'Request is too large.');
  const raw=req.body;
  if(!raw || typeof raw!=='object' || Array.isArray(raw))return fail(res,400,'Please check the form and try again.');
  if(Buffer.byteLength(JSON.stringify(raw))>12000)return fail(res,413,'Request is too large.');
  if(Object.hasOwn(raw,'requestKey') && (typeof raw.requestKey!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(raw.requestKey)))return fail(res,400,'Please refresh the page before sending your request.');
  const data={service:clean(raw.service,80),task:clean(raw.task,120),description:clean(raw.description,3000),name:clean(raw.name,120),phone:clean(raw.phone,35),email:clean(raw.email,254),street:clean(raw.street,200),city:clean(raw.city,80),preferredTime:clean(raw.preferredTime,180),communityRate:clean(raw.communityRate,10),website:clean(raw.website,200)};
  if(Object.hasOwn(raw,'appointmentSelection')){
    try {
      const selection=appointmentSelection(raw.appointmentSelection);
      if(selection.start){const current=await websiteAvailability();if(!current.times.some(t=>t.start===selection.start))return fail(res,409,'That time is no longer available. Please choose another time.');}
      data.preferredTime=selection.preferredTime;
    }catch(error){return fail(res,error.message==='OUTSIDE_WINDOW'||error.message==='INVALID_SELECTION'?400:503,'Please check your appointment selection, or send your request without a time.');}
  }
  const hasServices=Object.hasOwn(raw,'services');
  const selections=hasServices ? raw.services : [{service:data.service,task:data.task}];
  if(!Array.isArray(selections))return fail(res,400,'Please choose at least one job.');
  const validSelections=selections.length>=1 && selections.length<=15 && selections.every(item=>item && typeof item==='object' && !Array.isArray(item) && typeof item.service==='string' && typeof item.task==='string' && services.has(item.service) && (tasks[item.service].includes(item.task) || (item.task==='Not sure yet' && item.service!=='Something else') || (!Array.isArray(raw.services) && item.task==='')) && item.service.length<=80 && item.task.length<=120);
  if(!validSelections)return fail(res,400,'Please check the required fields and try again.');
  const normalized=selections.map(item=>({service:item.service,task:item.task || 'Not sure yet'}));
  if(!validSelections || new Set(normalized.map(item=>`${item.service}::${item.task}`)).size!==normalized.length || ((normalized.some(item=>item.service==='Something else') || !hasServices) && data.description.length<10) || !cities.has(data.city)||data.description.length>3000||data.name.length<2||data.name.length>120||data.phone.length<7||data.phone.length>35||data.street.length<5||data.street.length>200||data.email.length>254||data.preferredTime.length>180||!['Yes','No'].includes(data.communityRate)||data.website.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))return fail(res,400,'Please check the required fields and try again.');
  if(data.website)return res.status(200).json({ok:true});
  const id=raw.requestKey || randomUUID();
  if(process.env.CRM_INTAKE_ENABLED==='true'){
    try {
      const result=await saveCrmRequest(req,{...data,services:normalized},id);
      return res.status(200).json(result);
    }catch(error){
      const known=error instanceof IntakeFailure;
      console.error('CRM intake unavailable',{code:known?error.code:'UNAVAILABLE'});
      return fail(res,known?error.status:503,known?error.message:'The form is temporarily unavailable. Please call or text 770-630-2094.');
    }
  }
  const apiKey=process.env.RESEND_API_KEY||process.env.RESEND_API_Key;
  if(!apiKey){
    console.error('Missing Resend API key configuration');
    return fail(res,503,'The form is temporarily unavailable. Please call or text 770-630-2094.');
  }
  const message=ownerRequestEmail(data,normalized,id);
  try{
    const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`ynsg-request-${id}`},body:JSON.stringify({from:'Your Neighborhood Service Guy <onboarding@resend.dev>',to:['edhemmer@gmail.com'],reply_to:data.email,subject:'Your Neighborhood Service Guy New Request',text:message.text,html:message.html}),signal:AbortSignal.timeout(10000)});
    if(!sent.ok){
      const detail=await sent.json().catch(()=>({}));
      console.error('Request email provider rejected request',{status:sent.status,code:String(detail.name||'unknown').slice(0,80)});
      return fail(res,502,'The form could not send your request. Please call or text 770-630-2094.');
    }
    return res.status(200).json({ok:true,id});
  }catch{
    console.error('Resend request email unavailable');
    return fail(res,502,'The form could not send your request. Please call or text 770-630-2094.');
  }
}
