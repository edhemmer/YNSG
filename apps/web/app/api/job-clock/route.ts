import {NextResponse} from 'next/server';
import {authenticated,failure} from '../../../lib/session';
import {jobClockQuery,jobClock} from '../../../lib/job-clock-contract';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const input=jobClockQuery.parse(Object.fromEntries(new URL(request.url).searchParams)),{db,user}=await authenticated();const result=await db.rpc('field_job_clock',{p_org:input.organization,p_job:input.job});if(result.error)throw result.error;const data=jobClock.parse(result.data);if(data.organization!==input.organization||data.job!==input.job||data.actor!==user.id)throw Error('UNVERIFIED');return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});}catch(error){return failure(error);}}
