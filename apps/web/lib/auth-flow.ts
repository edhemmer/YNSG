export function recoveryDestination(destination: string | undefined, verifiedType?: string | null) {
  return verifiedType === 'recovery' ? 'password' : destination;
}
export function authProviderFailure(error: {status?: number; code?: string}, recovery: boolean) {
  const limited = error.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error.code || '');
  return {status: limited ? 429 : 503, message: limited
    ? recovery
      ? 'Password reset email was not sent because the email provider has reached its sending limit. You can still sign in with your existing password. Please wait before requesting another reset.'
      : 'Account email was not sent because the email provider has reached its sending limit. Please wait before trying again.'
    : 'Account email could not be sent. Please try again later.'};
}
export function passwordSignInFailure(error?:{status?:number;code?:string}|null){
 if(error?.status===429||['over_request_rate_limit','over_email_send_rate_limit'].includes(error?.code||''))return {status:429,message:'Too many sign-in attempts. Please wait before trying again.'};
 if(error?.code==='invalid_credentials')return {status:400,message:'Your email or password wasn’t accepted. Check the email and use Show password to check your entry. If needed, choose Forgot password.'};
 if(error?.code==='email_not_confirmed')return {status:400,message:'Your email needs verification. Choose Forgot password and open the newest reset email.'};
 return {status:503,message:'Password sign-in is temporarily unavailable. Try again shortly; requesting email will not fix a connection problem.'};
}
