import { randomUUID } from 'node:crypto';
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
  const data={service:clean(raw.service,80),task:clean(raw.task,120),description:clean(raw.description,3000),name:clean(raw.name,120),phone:clean(raw.phone,35),email:clean(raw.email,254),street:clean(raw.street,200),city:clean(raw.city,80),preferredTime:clean(raw.preferredTime,180),communityRate:clean(raw.communityRate,10),website:clean(raw.website,200)};
  const hasServices=Object.hasOwn(raw,'services');
  const selections=hasServices ? raw.services : [{service:data.service,task:data.task}];
  if(!Array.isArray(selections))return fail(res,400,'Please choose at least one job.');
  const validSelections=selections.length>=1 && selections.length<=15 && selections.every(item=>item && typeof item==='object' && !Array.isArray(item) && typeof item.service==='string' && typeof item.task==='string' && services.has(item.service) && (tasks[item.service].includes(item.task) || (item.task==='Not sure yet' && item.service!=='Something else') || (!Array.isArray(raw.services) && item.task==='')) && item.service.length<=80 && item.task.length<=120);
  if(!validSelections)return fail(res,400,'Please check the required fields and try again.');
  const normalized=selections.map(item=>({service:item.service,task:item.task || 'Not sure yet'}));
  if(!validSelections || new Set(normalized.map(item=>`${item.service}::${item.task}`)).size!==normalized.length || ((normalized.some(item=>item.service==='Something else') || !hasServices) && data.description.length<10) || !cities.has(data.city)||data.description.length>3000||data.name.length<2||data.name.length>120||data.phone.length<7||data.phone.length>35||data.street.length<5||data.street.length>200||data.email.length>254||data.preferredTime.length>180||!['Yes','No'].includes(data.communityRate)||data.website.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))return fail(res,400,'Please check the required fields and try again.');
  if(data.website)return res.status(200).json({ok:true});
  const apiKey=process.env.RESEND_API_KEY||process.env.RESEND_API_Key;
  if(!apiKey){
    console.error('Missing Resend API key configuration');
    return fail(res,503,'The form is temporarily unavailable. Please call or text 770-630-2094.');
  }
  const id=randomUUID();
  const fields=[['Request ID',id],['Received',new Date().toISOString()],['Jobs requested',normalized.map(item=>`${item.service}: ${item.task}`).join('\n')],['Job details',data.description||'Not specified'],['Name',data.name],['Phone',data.phone],['Email',data.email],['Address',`${data.street}, ${data.city}, IL`],['Preferred time',data.preferredTime||'Not specified'],['Community Rate inquiry',data.communityRate]];
  try{
    const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:'Your Neighborhood Service Guy <onboarding@resend.dev>',to:['edhemmer@gmail.com'],reply_to:data.email,subject:'Your Neighborhood Service Guy New Request',text:fields.map(([label,value])=>`${label}: ${value}`).join('\n\n')})});
    if(!sent.ok){
      const detail=await sent.json().catch(()=>({}));
      console.error('Request email provider rejected request',{status:sent.status,code:String(detail.name||'unknown').slice(0,80),message:String(detail.message||'').slice(0,300)});
      return fail(res,502,'The form could not send your request. Please call or text 770-630-2094.');
    }
    return res.status(200).json({ok:true,id});
  }catch{
    console.error('Resend request email unavailable');
    return fail(res,502,'The form could not send your request. Please call or text 770-630-2094.');
  }
}
