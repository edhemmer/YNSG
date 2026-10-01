import {NextResponse} from 'next/server';import {z} from 'zod';import {authenticated,failure} from '../../../lib/session';
export async function GET(request:Request){try{
 const {db}=await authenticated();const org=z.uuid().parse(new URL(request.url).searchParams.get('organization'));
 const results=await Promise.all([
  db.from('organizations').select('id,display_name,timezone,status').eq('id',org).maybeSingle(),
  db.from('service_requests').select('id,status,revision,created_at,original_submission').eq('organization_id',org).order('created_at',{ascending:false}).limit(50),
  db.from('customers').select('id,display_name').eq('organization_id',org).order('display_name').limit(50),
  db.from('quotes').select('id,customer_id,current_version,revision,status,quote_versions(version,scope,labor_cents,duration_minutes)').eq('organization_id',org).limit(50),
  db.from('jobs').select('id,customer_id,quote_id,status,revision').eq('organization_id',org).limit(50),
  db.from('invoices').select('id,number,total_cents,issued_at,payments(cents)').eq('organization_id',org).limit(50),
  db.from('outbox').select('id,kind,status,created_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(50),
 ]);
 if(results.some(r=>r.error))throw new Error('FAILED');
 if(!results[0]!.data)return NextResponse.json({error:'Complete staff verification or select an authorized company.',code:'MFA_OR_ACCESS_REQUIRED'},{status:403});
 return NextResponse.json({company:results[0]!.data,requests:results[1]!.data,customers:results[2]!.data,quotes:results[3]!.data,jobs:results[4]!.data,invoices:results[5]!.data,outbox:results[6]!.data},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return failure(error);}}
