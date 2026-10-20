import type {Metadata} from 'next';
import {cookies} from 'next/headers';
import {authenticated} from '../../../lib/session';
import {nativeAuthMessages,nativeAuthError} from '../../../lib/native-auth-contract';
import NativeAuthForm from '../../native-auth-form';
import PasswordInput from '../../password-input';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Set your password',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function PasswordPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams,jar=await cookies();
 let userId='',userEmail='',target='/account',unavailable=false;
 try{
  const {db,user}=await authenticated();
  if(user.email_confirmed_at){userId=user.id;userEmail=user.email||'';const memberships=await db.from('memberships').select('role').eq('user_id',user.id).is('revoked_at',null);if(!memberships.error&&memberships.data?.length)target='/owner';}
 }catch(error){unavailable=error instanceof Error&&error.message==='AUTH_UNAVAILABLE';}
 const saved=params.status==='saved'&&!!userId&&jar.get('ynsg-password-saved')?.value===userId;
 return <main id="main" className="access-shell"><section className="auth card access-card">
  <p className="eyebrow">Your secure account</p><h1>{saved?'Password saved':userId?'Set your password':unavailable?'Try your saved sign-in again':'Continue to your password'}</h1>
  {typeof params.error==='string'&&<p className="error note" role="alert">{nativeAuthMessages[nativeAuthError(params.error)]}</p>}
  {saved?<><p role="status">Your password was saved. Your sign-in is ready on this device.</p><a className="button access-submit" href={target}>{target==='/owner'?'Open your workspace':'Open your account'}</a></>:userId?<>
   <p>Choose a new password with at least 10 characters.</p><p className="tiny">Account: {userEmail}</p>
   <NativeAuthForm label="Set password">
    <input type="hidden" name="action" value="set-password"/><input type="hidden" name="expectedUser" value={userId}/>
    <PasswordInput id="access-new-password" name="password" label="New password" newPassword/>
    <PasswordInput id="access-confirm-password" name="confirmation" label="Confirm new password" newPassword confirm/>
    <button type="submit" className="access-submit">Save password</button>
   </NativeAuthForm><a href={target}>Back without changing your password</a>
  </>:unavailable?<><p>Your saved sign-in could not be checked. No new email is needed.</p><a className="button" href="/auth/password">Try again</a></>:jar.get('ynsg-refresh')?.value?<>
   <p>Renew your saved sign-in to continue. No email is needed.</p><NativeAuthForm label="Renew saved sign-in"><input type="hidden" name="action" value="refresh"/><input type="hidden" name="destination" value="password"/><button type="submit">Continue saved sign-in</button></NativeAuthForm><a href="/sign-in?mode=reset">Request a new password reset</a>
  </>:<><p>Sign in or open your newest password reset email in this browser.</p><a className="button access-submit" href="/sign-in">Sign in</a><p><a href="/sign-in?mode=reset">Request a password reset</a></p></>}
 </section></main>;
}
