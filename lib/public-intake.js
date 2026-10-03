import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export class IntakeFailure extends Error {
  constructor(code, status, message) { super(message); this.code=code; this.status=status; }
}
const unavailable = () => new IntakeFailure('SETUP_REQUIRED',503,'The form is temporarily unavailable. Please call or text 770-630-2094.');
export async function saveCrmRequest(req, data, key, env=process.env, transport=fetch) {
  const organization=env.CRM_ORGANIZATION_ID;
  const secret=env.CRM_INTAKE_HASH_KEY;
  const serviceKey=env.SUPABASE_SERVICE_ROLE_KEY;
  let url;
  try { url=new URL(env.SUPABASE_URL); } catch { throw unavailable(); }
  if(url.protocol!=='https:' || !url.hostname.endsWith('.supabase.co') || url.username || url.password || url.search || url.hash || url.pathname!=='/' || !serviceKey || !secret || secret.length<32 || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(organization||'')) throw unavailable();
  // Trust platform-overwritten headers only when running on Vercel. Local tests use the socket address.
  const address=env.VERCEL==='1' ? req.headers['x-vercel-forwarded-for'] : req.socket?.remoteAddress;
  if(typeof address!=='string' || !isIP(address.trim())) throw unavailable();
  const clientHash=createHmac('sha256',secret).update(`ynsg:intake:v1:${organization}:${address.trim()}`).digest('hex');
  let response;
  try {
    response=await transport(new URL('/rest/v1/rpc/submit_service_request',url),{
      method:'POST',headers:{'Content-Type':'application/json',apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},
      body:JSON.stringify({p_org:organization,p_key:key,p_client_hash:clientHash,p_data:data}),
      signal:AbortSignal.timeout(10000),
    });
  } catch { throw new IntakeFailure('UNAVAILABLE',503,'We could not verify that your request was saved. Try again with the same details, or call or text 770-630-2094.'); }
  const result=await response.json().catch(()=>null);
  if(!response.ok){
    const code=typeof result?.message==='string'?result.message:'';
    if(code==='RATE_LIMITED') throw new IntakeFailure(code,429,'Please wait before sending another request, or call or text 770-630-2094.');
    if(code==='IDEMPOTENCY_CONFLICT') throw new IntakeFailure(code,409,'This request changed while it was sending. Refresh the page before sending the updated details.');
    if(code==='VALIDATION') throw new IntakeFailure(code,400,'Please check your selected services and required fields.');
    throw unavailable();
  }
  if(result?.ok!==true || typeof result.id!=='string' || !/^[a-f0-9-]{36}$/i.test(result.id)) throw new IntakeFailure('UNAVAILABLE',503,'We could not verify that your request was saved. Try again with the same details, or call or text 770-630-2094.');
  return {ok:true,id:result.id,notification:'pending',saved:true};
}
