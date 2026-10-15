import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin} from '../../../lib/session';
import {MAX_CALENDAR_BLOCK_BYTES,calendarBlockCommand,calendarBlockList,validateCalendarBlockReceipt,calendarBlockFailure} from '../../../lib/calendar-block-contract';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){try{
 const org=z.uuid().safeParse(new URL(request.url).searchParams.get('organization'));if(!org.success)return NextResponse.json({error:'Choose a valid company.'},{status:400,headers});
 const {db}=await authenticated(),r=await db.rpc('owner_calendar_blocks',{p_org:org.data});if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':r.error.message);
 return NextResponse.json(calendarBlockList.parse({blocks:r.data}),{headers});
}catch(e){const result=calendarBlockFailure(e);return NextResponse.json({error:result.status===503?'Saved time blocks could not be loaded. Try refreshing.':result.error},{status:result.status,headers});}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 let raw:unknown;try{const text=await request.text();if(Buffer.byteLength(text)>MAX_CALENDAR_BLOCK_BYTES)return NextResponse.json({error:'Request too large.'},{status:413,headers});raw=JSON.parse(text);}catch{return NextResponse.json({error:'Check the block dates.'},{status:400,headers});}
 const parsed=calendarBlockCommand.safeParse(raw);if(!parsed.success)return NextResponse.json({error:'Check the block dates and selected record.'},{status:400,headers});
 try{const v=parsed.data,{db}=await authenticated(),r=await db.rpc('manage_calendar_block',{p_org:v.organization,p_id:v.id,p_revision:v.revision,p_start:v.start,p_end:v.end,p_remove:v.remove,p_key:v.key});if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':r.error.message);return NextResponse.json({result:validateCalendarBlockReceipt(v,r.data)},{headers});}
 catch(e){const result=calendarBlockFailure(e);return NextResponse.json({error:result.error},{status:result.status,headers});}
}
