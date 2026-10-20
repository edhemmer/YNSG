import {z} from 'zod';
const email=z.string().trim().toLowerCase().pipe(z.email().max(254));
const context={request:z.uuid().optional(),organization:z.uuid().optional()};
export const nativeAuthInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('password'),email,password:z.string().min(1).max(128),...context}).strict(),
 z.object({action:z.literal('recover'),email}).strict(),
 z.object({action:z.literal('set-password'),password:z.string().min(10).max(128),confirmation:z.string().min(10).max(128),expectedUser:z.uuid()}).strict(),
 z.object({action:z.literal('refresh'),destination:z.enum(['owner','password']).optional()}).strict(),
]);
export const nativeAuthMessages={
 invalid:'Your email or password was not accepted. Check your entry or choose Forgot password.',
 limited:'The provider has limited requests. Wait before trying again. Your saved sign-in is kept.',
 unavailable:'Sign-in is temporarily unavailable. Try again shortly. Your saved sign-in is kept.',
 unconfirmed:'Your email needs verification. Request a password reset and open its newest email.',
 expired:'Your saved sign-in has expired. Sign in or request a password reset.',
 mismatch:'The passwords do not match. Enter the same new password in both fields.',
 invalid_form:'Check the sign-in fields and try again.',
 same_password:'Choose a password different from your current password.',
 weak_password:'Choose a stronger password with at least 10 characters.',
 reauthenticate:'Request a new password reset email to verify your account before changing the password.',
 password_uncertain:'The password change could not be confirmed. Try signing in with your new password before requesting another reset.',
} as const;
export type NativeAuthError=keyof typeof nativeAuthMessages;
export function nativeAuthError(value:unknown):NativeAuthError{return typeof value==='string'&&Object.hasOwn(nativeAuthMessages,value)?value as NativeAuthError:'unavailable';}
