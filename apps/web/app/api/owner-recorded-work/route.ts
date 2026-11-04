import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,failure} from '../../../lib/session';
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams,org=z.uuid().parse(q.get('organization')),id=z.uuid().parse(q.get('request'));
 const {db}=await authenticated();const r=await db.rpc('owner_work_record',{p_org:org,p_request:id});if(r.error)throw r.error;
 return NextResponse.json({record:r.data},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return failure(e);}}
