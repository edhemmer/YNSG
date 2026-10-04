import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,failure} from '../../../lib/session';

export async function GET(request:Request){
 try{
  const org=z.uuid().parse(new URL(request.url).searchParams.get('organization'));
  const {db}=await authenticated();
  const result=await db.rpc('owner_security_recent',{p_org:org});
  if(result.error)throw Error(result.error.code==='42501'?'UNAUTHORIZED':'FAILED');
  return NextResponse.json({events:result.data||[]},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return failure(error)}
}
