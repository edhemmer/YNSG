import {NextResponse} from 'next/server';
import {authenticated,failure} from '../../../lib/session';
import {ownerDayQuery} from '../../../lib/owner-day';
import {readOwnerDay} from '../../../lib/owner-day-read';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 try{
  const {organization:org}=ownerDayQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
  const {db,user}=await authenticated();
  return NextResponse.json(await readOwnerDay(db,org,user.id),{headers});
 }catch(e){if(e instanceof Error&&e.message==='OWNER_ACCESS_REQUIRED')return NextResponse.json({error:'Owner access is required.'},{status:403,headers});return failure(e);}
}
