import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated} from '../../../lib/session';
import {authorizeRecordExport} from '../../../lib/export-reauthentication';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){const p=z.object({organization:z.uuid()}).strict().safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!p.success)return NextResponse.json({error:'Choose a valid company.'},{status:400,headers});try{const {db}=await authenticated();return NextResponse.json(await authorizeRecordExport(db,p.data.organization),{headers});}catch(e){const c=e instanceof Error?e.message:'';return NextResponse.json({error:c==='REAUTHENTICATION_REQUIRED'?'Confirm your sign-in before downloading records.':'Export authorization unavailable.'},{status:c==='REAUTHENTICATION_REQUIRED'?428:c==='UNAUTHORIZED'?401:c==='FORBIDDEN'?403:503,headers});}}
