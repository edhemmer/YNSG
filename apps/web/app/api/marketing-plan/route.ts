import {NextResponse} from 'next/server';
import {z} from 'zod';
import {sameOrigin} from '../../../lib/session';
import {authorizeGoogle,accessToken} from '../../../lib/google-server';
import {localInstant} from '../../../../../packages/domain/timezone';
import {saveMarketingEvent} from '../../../lib/marketing-calendar';
import {localDate,daySearchBounds} from '../../../lib/day-plan';
export const runtime='nodejs';export const maxDuration=30;
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{
  const raw=await request.text();if(Buffer.byteLength(raw)>20000)return NextResponse.json({error:'Draft is too large.'},{status:413,headers});
  const input=z.object({organization:z.uuid(),key:z.uuid(),title:z.string().trim().min(2).max(200),draft:z.string().trim().min(10).max(8000),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict().parse(JSON.parse(raw));
  const {db}=await authorizeGoogle(input.organization);
  const company=await db.from('organizations').select('timezone').eq('id',input.organization).single();if(company.error)throw Error();
  daySearchBounds(input.date);if(input.date<localDate(new Date(),company.data.timezone)||localInstant(input.date+'T09:00',company.data.timezone)<=Date.now())return NextResponse.json({error:'Choose a future posting date. The reminder is at 9 AM in your company timezone.'},{status:400,headers});
  const {token,account}=await accessToken(input.organization);if(!account.calendar_id)return NextResponse.json({error:'Choose your Google business calendar in Settings first.'},{status:409,headers});
  const result=await saveMarketingEvent(token,account.calendar_id,{...input,timezone:company.data.timezone});
  return NextResponse.json({ok:true,...result},{headers});
 }catch(e){return NextResponse.json({error:e instanceof z.ZodError?'Choose a date and keep the draft under 8,000 characters.':e instanceof Error&&e.message==='MARKETING_RETRY_CHANGED'?'This retry contains a different draft. Prepare it as a new marketing plan.':'Google Calendar could not confirm the marketing plan. Retry the same draft to check its saved status.'},{status:409,headers});}
}
