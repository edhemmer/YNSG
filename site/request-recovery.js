// Tab-scoped recovery only. Nothing is sent until the customer presses Send.
const key='ynsg-request-recovery-v1', lifetime=24*60*60*1000;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fields={description:3000,name:120,phone:35,email:254,street:200,city:80,communityRate:10};
function validData(data,kind){
 if(!data||typeof data!=='object'||Array.isArray(data)||!Array.isArray(data.services)||data.services.length>15||data.services.some(item=>!item||typeof item.service!=='string'||typeof item.task!=='string'||item.service.length>80||item.task.length>120))return false;
 for(const [name,max] of Object.entries(fields))if(typeof data[name]!=='string'||data[name].length>max)return false;
 return kind!=='pending'||uuid.test(data.requestKey||'');
}
export function requestRecovery(storage,clock=Date.now){
 function clear(){try{storage?.removeItem(key);}catch{}}
 function read(){
  try{
   const raw=storage?.getItem(key);if(!raw)return null;
   if(raw.length>20000){clear();return null;}
   const value=JSON.parse(raw);
   if(value.version!==1||!Number.isFinite(value.savedAt)||value.savedAt>clock()||clock()-value.savedAt>=lifetime||!['draft','pending'].includes(value.kind)||!validData(value.data,value.kind)){clear();return null;}
   return value;
  }catch{clear();return null;}
 }
 function save(kind,data){
  try{const raw=JSON.stringify({version:1,kind,savedAt:clock(),data});if(raw.length>20000)return false;storage?.setItem(key,raw);return Boolean(storage);}catch{return false;}
 }
 return {read,clear,saveDraft:data=>save('draft',data),savePending:data=>save('pending',data)};
}
