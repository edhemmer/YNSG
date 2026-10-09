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
