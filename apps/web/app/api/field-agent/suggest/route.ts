import {NextResponse} from 'next/server';
import {z} from 'zod';
import {GET as readIntelligence} from '../../field-intelligence/route';
import {suggestFieldPreparation} from '../../../../lib/field-agent-ai';
import {authenticated,failure} from '../../../../lib/session';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const input=z.object({organization:z.uuid(),request:z.uuid()});
/** Explicit owner-only advisory. Never executes a job, sends email or writes state. */
export async function POST(request:Request){
 try{
  const args=input.parse(await request.json());
  const {db,user}=await authenticated();
  const access=await db.from('memberships').select('role').eq('organization_id',args.organization).eq('user_id',user.id).is('revoked_at',null).in('role',['owner','admin']).maybeSingle();
  if(access.error)throw Error('ACCESS_UNVERIFIED');
  if(!access.data)return NextResponse.json({error:'Owner access is required.'},{status:403,headers});
  const url=new URL('https://ynsg.invalid/api/field-intelligence');
  url.searchParams.set('organization',args.organization);
  url.searchParams.set('request',args.request);
  const prepared=await readIntelligence(new Request(url));
  if(!prepared.ok)return NextResponse.json(await prepared.json(),{status:prepared.status,headers});
  const result=await prepared.json() as {requestRevision:number;tasks:{kind:string;title:string;detail:string}[]};
  const task=result.tasks[0];
  if(!task)return NextResponse.json({status:'no_action',suggestion:null,requestRevision:result.requestRevision},{headers});
  const suggestion=await suggestFieldPreparation(task);
  // Never present model output after the authoritative request revision changes.
  const latest=await db.from('service_requests').select('revision').eq('organization_id',args.organization).eq('id',args.request).maybeSingle();
  if(latest.error||!latest.data||latest.data.revision!==result.requestRevision)return NextResponse.json({status:'stale',suggestion:null,execution:'none'},{status:409,headers});
  return NextResponse.json({status:suggestion?'suggested':'unavailable',suggestion,requestRevision:result.requestRevision,kind:task.kind,execution:'none',requiresOwnerApproval:true},{headers});
 }catch(e){return failure(e);}
}
