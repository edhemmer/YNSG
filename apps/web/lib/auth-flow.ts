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
 if(error?.status===429||['over_request_rate_limit','over_email_send_rate_limit'].includes(error?.code||''))return {status:429,code:'limited',message:'Too many sign-in attempts. Please wait before trying again.'};
 if(error?.code==='invalid_credentials')return {status:400,code:'invalid',message:'Your email or password wasn’t accepted. Check the email and use Show password to check your entry. If needed, choose Forgot password.'};
 if(error?.code==='email_not_confirmed')return {status:400,code:'unconfirmed',message:'Your email needs verification. Choose Forgot password and open the newest reset email.'};
 return {status:503,code:'unavailable',message:'Password sign-in is temporarily unavailable. Try again shortly; requesting email will not fix a connection problem.'};
}

export function passwordUpdateFailure(error?:{status?:number;code?:string}|null){
 if(error?.status===429)return {status:429,code:'limited',message:'Too many sign-in attempts. Please wait before trying again.'};
 if(error?.code==='same_password')return {status:400,code:'same_password',message:'Choose a password different from your current password.'};
 if(error?.code==='weak_password')return {status:400,code:'weak_password',message:'Choose a stronger password with at least 10 characters.'};
 if(error?.code==='reauthentication_needed')return {status:403,code:'reauthenticate',message:'Open a new password reset email to verify your account before changing the password.'};
 return {status:503,code:'unavailable',message:'Your password could not be saved right now. Your existing sign-in is kept. Please try again shortly.'};
}
