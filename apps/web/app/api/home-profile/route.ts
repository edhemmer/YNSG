import {NextResponse} from 'next/server';
import {authenticated,sameOrigin} from '../../../lib/session';
import {homeProfileTarget,homeProfileCommand,homeProfileRead,homeProfileSaved} from '../../../lib/home-profile-contract';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function rejected(error:unknown){
 const code=error instanceof Error?error.message:'',messages:Record<string,string>={UNAUTHORIZED:'Sign in to continue.',FORBIDDEN:'Your account cannot open or save this home profile.',VALIDATION:'Check the home profile details.',NOT_FOUND:'This customer is no longer available to your account.',SETUP_REQUIRED:'Customer records are not enabled for this company.',STALE_REVISION:'This home profile changed on another screen. Reload it, then make your change again.',IDEMPOTENCY_CONFLICT:'This retry has different details. Reload the home profile before saving again.'};
 return NextResponse.json({error:messages[code]||'The home profile result could not be verified. Reload before making another change.'},{status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:messages[code]?409:503,headers});
}
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams,input=homeProfileTarget.safeParse({organization:q.get('organization'),customer:q.get('customer')});
 if(!input.success)return NextResponse.json({error:'Check the selected customer.'},{status:400,headers});
 const {db}=await authenticated(),{data,error}=await db.rpc('read_home_profile',{p_org:input.data.organization,p_customer:input.data.customer});
 if(error)throw Error(error.code==='42501'?'FORBIDDEN':error.message);
 return NextResponse.json({profile:homeProfileRead.parse(data)},{headers});
}catch(error){return rejected(error);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 let raw:unknown;try{const text=await request.text();if(Buffer.byteLength(text)>8192)return NextResponse.json({error:'Home profile is too long.'},{status:413,headers});raw=JSON.parse(text);}catch{return NextResponse.json({error:'Check the home profile details.'},{status:400,headers});}
 const parsed=homeProfileCommand.safeParse(raw);if(!parsed.success)return NextResponse.json({error:'Check the home profile details and their lengths.'},{status:400,headers});
 try{const i=parsed.data,{db}=await authenticated(),{data,error}=await db.rpc('save_home_profile',{p_org:i.organization,p_customer:i.customer,p_revision:i.revision,p_access:i.fields.accessNotes,p_pets:i.fields.pets,p_parking:i.fields.parking,p_preferences:i.fields.preferences,p_key:i.key});
  if(error)throw Error(error.code==='42501'?'FORBIDDEN':error.message);return NextResponse.json({ok:true,result:homeProfileSaved.parse(data)},{headers});
 }catch(error){return rejected(error);}
}
