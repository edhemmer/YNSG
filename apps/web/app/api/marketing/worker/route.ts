import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {runMarketing} from '../../../../lib/marketing-worker';
import {serverDatabase} from '../../../../lib/google-server';
import {mailTransport} from '../../../../lib/transactional-mail';
import {sendCentralEmail} from '../../../../lib/central-mail';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
function authorized(request:Request){
 const secret=request.method==='GET'?process.env.CRON_SECRET:process.env.GOOGLE_WORKER_SECRET||process.env.CRON_SECRET;
 const provided=request.headers.get('authorization')?.replace(/^Bearer /,'');
 return !!secret&&secret.length>=32&&!!provided&&Buffer.byteLength(secret)===Buffer.byteLength(provided)&&timingSafeEqual(Buffer.from(secret),Buffer.from(provided));
}
async function run(request:Request){
 if(!authorized(request))return NextResponse.json({error:'Access is required.'},{status:401,headers});
 const org=process.env.GOOGLE_WORKER_ORGANIZATION_ID;
 if(!org||!/^[0-9a-f-]{36}$/i.test(org))return NextResponse.json({error:'Marketing automation needs setup.'},{status:503,headers});
 try{return NextResponse.json(await runMarketing(org,serverDatabase(),sendCentralEmail,mailTransport),{headers});}
 catch{return NextResponse.json({error:'Marketing automation needs attention.'},{status:503,headers});}
}
export const GET=run;
export const POST=run;
