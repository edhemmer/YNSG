import {WebsiteGuardFailure} from './website-guard.js';
// Only known, customer-safe failures reach a customer-facing response. Anything else
// (a bug, a provider error, a library message) becomes one generic 503, so internals
// never leak and an unexpected status can never be passed to res.status().
export const unavailableMessage='We couldn’t save your request. Please try again, or call 815-680-1775.';
const allowedStatuses=new Set([409,429,503]);
export function publicFailure(error){
 return error instanceof WebsiteGuardFailure&&allowedStatuses.has(error.status)
  ?{status:error.status,message:error.message}
  :{status:503,message:unavailableMessage};
}
