import type {CompanySettings} from '../../../packages/contracts/index.ts';

export const FRANCHISE_NAME='Your Neighborhood Service Guy';
export const FRANCHISE_LOGO='https://www.yourneighborhoodserviceguy.com/assets/logo.jpg';
const protectedKeys=['navy','forest','gold','cream','logoUrl'] as const;

// Owner personalization changes the local operator and service catalog.
// A platform operator must provision any change to the licensed identity.
export function preservesLicensedBrand(previous:CompanySettings|null,next:CompanySettings):boolean {
 if(!previous)return next.displayName===FRANCHISE_NAME&&next.brand.logoUrl===FRANCHISE_LOGO;
 return previous.displayName===next.displayName&&protectedKeys.every(key=>(previous.brand[key]??null)===(next.brand[key]??null));
}
