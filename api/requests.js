import { randomUUID } from 'node:crypto';
const services = new Set(['Lawn care','Yard & garden','Snow clearing','Help around the home','Something else']);
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
  const data={service:clean(raw.service,80),task:clean(raw.task,120),description:clean(raw.description,3000),name:clean(raw.name,120),phone:clean(raw.phone,35),email:clean(raw.email,254),street:clean(raw.street,200),city:clean(raw.city,80),preferredTime:clean(raw.preferredTime,180),communityRate:clean(raw.communityRate,10),website:clean(raw.website,200)};
  if(!services.has(data.service)||!cities.has(data.city)||data.description.length<10||data.description.length>3000||data.name.length<2||data.name.length>120||data.phone.length<7||data.phone.length>35||data.street.length<5||data.street.length>200||data.email.length>254||data.task.length>120||data.preferredTime.length>180||!['Yes','No'].includes(data.communityRate)||data.website.length>200||(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)))return fail(res,400,'Please check the required fields and try again.');
  if(data.website)return res.status(200).json({ok:true});
  const apiKey=process.env.RESEND_API_KEY;
  const from=process.env.REQUEST_FROM_EMAIL;
  if(!apiKey||!from)return fail(res,503,'The form is temporarily unavailable. Please call or text 770-630-2094.');
  const id=randomUUID();
  const fields=[['Request ID',id],['Received',new Date().toISOString()],['Service',data.service],['Selected job',data.task||'Not selected'],['Job details',data.description],['Name',data.name],['Phone',data.phone],['Email',data.email||'Not provided'],['Address',`${data.street}, ${data.city}, IL`],['Preferred time',data.preferredTime||'Not specified'],['Community Rate inquiry',data.communityRate]];
  try{
    const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:['edhemmer@gmail.com'],...(data.email?{reply_to:data.email}:{}),subject:'Your Neighborhood Service Guy New Request',text:fields.map(([label,value])=>`${label}: ${value}`).join('\n\n')})});
    if(!sent.ok){console.error('Request email provider status',sent.status);return fail(res,502,'The form could not send your request. Please call or text 770-630-2094.');}
    return res.status(200).json({ok:true,id});
  }catch{console.error('Request email provider unavailable');return fail(res,502,'The form could not send your request. Please call or text 770-630-2094.');}
}
