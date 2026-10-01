import {cookies} from 'next/headers';import {NextResponse} from 'next/server';import {z} from 'zod';
import {authClient,authenticated,sameOrigin,saveSession,failure} from '../../../lib/session';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403});
 try{
  const {access}=await authenticated();const refresh=(await cookies()).get('ynsg-refresh')?.value;if(!refresh)throw new Error('UNAUTHORIZED');
  const db=authClient();const setup=await db.auth.setSession({access_token:access,refresh_token:refresh});if(setup.error)throw setup.error;
  const value=z.object({action:z.enum(['prepare','verify']),factorId:z.uuid().optional(),code:z.string().regex(/^\d{6}$/).optional()}).parse(await request.json());
  if(value.action==='prepare'){
   const factors=await db.auth.mfa.listFactors();if(factors.error)throw factors.error;
   const verified=factors.data.totp.find(f=>f.status==='verified');
   if(verified)return NextResponse.json({factorId:verified.id,enrolled:true});
   // Reuse pending enrollment only within this response. Remove only this user's unverified stale TOTP factors.
   for(const f of factors.data.all.filter(f=>f.factor_type==='totp'&&f.status==='unverified'))await db.auth.mfa.unenroll({factorId:f.id});
   const factor=await db.auth.mfa.enroll({factorType:'totp',friendlyName:'Service workspace'});if(factor.error)throw factor.error;
   return NextResponse.json({factorId:factor.data.id,qr:factor.data.totp.qr_code,secret:factor.data.totp.secret,enrolled:false},{headers:{'Cache-Control':'no-store'}});
  }
  if(!value.factorId||!value.code)throw new Error('VALIDATION');
  const checked=await db.auth.mfa.challengeAndVerify({factorId:value.factorId,code:value.code});if(checked.error)throw checked.error;
  return saveSession(NextResponse.json({ok:true}),checked.data);
 }catch(error){return failure(error);}
}
