import NativeAuthForm from './native-auth-form';
import ThemeToggle from './theme-toggle';
import PasswordInput from './password-input';
import {nativeAuthMessages,nativeAuthError} from '../lib/native-auth-contract';
import {ownerRequestContext} from '../lib/email-links';
type Props={initialEmail?:string;brand:string;mode?:'password'|'reset'|'sent';error?:string;context?:unknown};
export default function OwnerLogin({initialEmail='',brand,mode='password',error,context}:Props){
 const target=ownerRequestContext(context);
 return <section className="auth card access-card" aria-label="Owner sign in">
  <ThemeToggle/><p className="eyebrow">{brand}</p>
  <h1>{mode==='password'?'Owner sign in':mode==='sent'?'Check your email':'Reset your password'}</h1>
  <p>{mode==='password'?'Manage your requests and customer work. Your saved sign-in renews automatically on this device.':mode==='sent'?'If an account matches that email, a password reset was requested. Open the newest reset email in the browser you are using now. Check spam if it does not arrive.':'Enter your account email to request a password reset. Open the newest reset email in this browser.'}</p>
  {error&&<p role="alert" className="error note">{nativeAuthMessages[nativeAuthError(error)]}</p>}
  {mode!=='sent'&&<NativeAuthForm label={mode==='password'?'Password sign in':'Password reset request'}>
   <input type="hidden" name="action" value={mode==='password'?'password':'recover'}/>
   {mode==='password'&&target&&<><input type="hidden" name="request" value={target.request}/><input type="hidden" name="organization" value={target.organization}/></>}
   <label htmlFor="owner-access-email">Email address</label>
   <input id="owner-access-email" name="email" type="email" required maxLength={254} defaultValue={initialEmail} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" enterKeyHint="next"/>
   {mode==='password'&&<PasswordInput id="owner-access-password" name="password" label="Password"/>}
   <button type="submit" className="access-submit">{mode==='password'?'Sign in':'Send password reset'}</button>
  </NativeAuthForm>}
  <nav className="actions" aria-label="Sign-in options">{mode==='password'?<a href="/sign-in?mode=reset">Forgot password</a>:<a href="/sign-in">Back to sign in</a>}</nav>
  {mode==='password'&&<p className="tiny">Use your own device for saved access. Sign out on a shared device.</p>}
  <a className="tiny" href="/account">Customer account</a>
 </section>;
}
