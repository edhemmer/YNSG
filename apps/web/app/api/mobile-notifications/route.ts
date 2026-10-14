import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,failure} from '../../../lib/session';
import {mobileDeviceSchema,disableMobileDeviceSchema} from '../../../lib/mobile-push-contract';
import {pushConfigured} from '../../../lib/apple-push';
import {seal} from '../../../lib/google-core';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){try{
 const org=z.uuid().parse(new URL(request.url).searchParams.get('organization'));const {db,user}=await authenticated();
 const r=await db.rpc('owner_mobile_settings',{p_org:org});if(r.error)return NextResponse.json({error:'Owner access is required.'},{status:403,headers});
 return NextResponse.json({...r.data,identity:user.id,configured:pushConfigured(),environment:pushConfigured()?process.env.APNS_ENVIRONMENT:null},{headers});
}catch(e){return failure(e);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{
  const raw=await request.text();if(Buffer.byteLength(raw)>4096)return NextResponse.json({error:'Request too large.'},{status:413,headers});
  const v=mobileDeviceSchema.parse(JSON.parse(raw));const {db}=await authenticated();
  if(!pushConfigured()||v.environment!==process.env.APNS_ENVIRONMENT)return NextResponse.json({error:'Phone notifications need Apple connection setup before activation.',uncertain:false},{status:503,headers});
  const token=v.token.toLowerCase(),cipher=seal(token,process.env.PUSH_TOKEN_ENCRYPTION_KEY!,v.organization+':'+v.device);
  const r=await db.rpc('save_owner_mobile_device',{p_org:v.organization,p_id:v.device,p_revision:v.revision,p_hash:createHash('sha256').update(token).digest('hex'),p_cipher:cipher,p_environment:v.environment,p_requests:v.newRequests,p_appointments:v.appointments,p_sound:v.sound,p_quiet_start:v.quietStart,p_quiet_end:v.quietEnd,p_key:v.key});
  if(r.error){const known=['FORBIDDEN','VALIDATION','STALE_REVISION','IDEMPOTENCY_CONFLICT','DEVICE_LIMIT'].includes(r.error.message);return NextResponse.json({error:'The device settings could not be confirmed. Check the saved result before changing them.',uncertain:!known},{status:known?(r.error.code==='42501'?403:409):503,headers});}
  return NextResponse.json({result:r.data},{headers});
 }catch(e){if(e instanceof Error&&e.message==='UNAUTHORIZED')return failure(e);if(e instanceof z.ZodError||e instanceof SyntaxError)return NextResponse.json({error:'Review the device and notification choices.'},{status:400,headers});return NextResponse.json({error:'The saved device setting could not be confirmed.',uncertain:true},{status:503,headers});}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{const raw=await request.text();if(Buffer.byteLength(raw)>1024)return NextResponse.json({error:'Request too large.'},{status:413,headers});const v=disableMobileDeviceSchema.parse(JSON.parse(raw));const {db}=await authenticated();const r=await db.rpc('disable_owner_mobile_device',{p_org:v.organization,p_id:v.device,p_revision:v.revision});if(r.error)return NextResponse.json({error:'Refresh the device list before changing this setting.'},{status:r.error.code==='42501'?403:409,headers});return NextResponse.json({result:r.data},{headers});}catch(e){return failure(e);}
}
