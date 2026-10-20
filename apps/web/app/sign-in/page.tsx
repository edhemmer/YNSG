import type {Metadata} from 'next';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import OwnerLogin from '../owner-login';
import {ownerRequestContext,ownerReturnTarget} from '../../lib/email-links';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Owner sign in',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function SignIn({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams,mode=params.mode==='reset'?'reset':params.mode==='sent'?'sent':'password';
 const context=ownerRequestContext(params),jar=await cookies();
 // Existing sessions use the ordinary workspace renewal path. Error pages stay
 // visible so an invalid refresh cookie cannot create a redirect loop.
 if(mode==='password'&&!params.error&&(jar.get('ynsg-access')?.value||jar.get('ynsg-refresh')?.value))redirect(ownerReturnTarget('/owner',context));
 return <main id="main" className="access-shell"><OwnerLogin brand={process.env.NEXT_PUBLIC_LOGIN_BRAND||'Your Neighborhood Service Guy'} mode={mode} error={typeof params.error==='string'?params.error:undefined} context={context}/></main>;
}
