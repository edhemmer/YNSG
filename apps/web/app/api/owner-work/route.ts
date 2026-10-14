import {NextResponse} from 'next/server';
import {authenticated,failure} from '../../../lib/session';
import {ownerWorkQuery} from '../../../lib/owner-work';
import {readOwnerWork} from '../../../lib/owner-work-read';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 try{
  const {organization:org,page}=ownerWorkQuery.parse(Object.fromEntries(new URL(request.url).searchParams)),{db,user}=await authenticated();
  return NextResponse.json(await readOwnerWork(db,org,user.id,page),{headers});
 }catch(e){if(e instanceof Error&&e.message==='OWNER_ACCESS_REQUIRED')return NextResponse.json({error:'Owner access is required.'},{status:403,headers});return failure(e);}
}
