import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin} from '../../../lib/session';
import {MAX_NOTE_BYTES,noteTarget,noteCommand,noteSaved,noteRead} from '../../../lib/relationship-note-contract';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function rejected(error:unknown){
 const code=error instanceof Error?error.message:'',messages:Record<string,string>={UNAUTHORIZED:'Sign in to continue.',FORBIDDEN:'Your account cannot open or save these notes.',VALIDATION:'Check the note and its selected record.',NOT_FOUND:'This record is no longer available to your account.',SETUP_REQUIRED:'Notes are not enabled for this company.',IDEMPOTENCY_CONFLICT:'This retry has different details. Keep your note and review the saved history before trying again.'};
 return NextResponse.json({error:messages[code]||'The saved note result could not be verified. Check the same saved attempt before making another change.'},{status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:messages[code]?409:503,headers});
}
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams,input=noteTarget.safeParse(Object.fromEntries(['organization','type','target'].map(k=>[k,q.get(k)]))),page=z.coerce.number().int().min(0).max(100000).safeParse(q.get('page')||0);
 if(!input.success||!page.success)return NextResponse.json({error:'Check the selected record and notes page.'},{status:400,headers});
 const {db}=await authenticated(),{data,error}=await db.rpc('read_relationship_notes',{p_org:input.data.organization,p_type:input.data.type,p_target:input.data.target,p_page:page.data});
 if(error)throw Error(error.code==='42501'?'FORBIDDEN':error.message);const result=noteRead.parse(data);if(result.page!==page.data)throw Error('UNVERIFIED');return NextResponse.json({notes:result.notes.slice(0,50),page:page.data,hasMore:result.notes.length>50},{headers});
 }catch(error){return rejected(error);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 let raw:unknown;try{const text=await request.text();if(Buffer.byteLength(text)>MAX_NOTE_BYTES)return NextResponse.json({error:'Note is too long.'},{status:413,headers});raw=JSON.parse(text);}catch{return NextResponse.json({error:'Check the note fields.'},{status:400,headers});}
 const parsed=noteCommand.safeParse(raw);if(!parsed.success)return NextResponse.json({error:'Enter a note of 1–4000 characters for the selected record.'},{status:400,headers});
 try{const input=parsed.data,{db}=await authenticated(),{data,error}=await db.rpc('add_relationship_note',{p_org:input.organization,p_type:input.type,p_target:input.target,p_body:input.body,p_key:input.key});if(error)throw Error(error.code==='42501'?'FORBIDDEN':error.message);return NextResponse.json({ok:true,result:noteSaved.parse(data)},{headers});}catch(error){return rejected(error);}
}
