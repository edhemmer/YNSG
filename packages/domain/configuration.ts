import {companySettings,DomainError,type CompanySettings} from '../contracts/index.ts';
export function contrast(a:string,b:string):number {
 const lum=(hex:string)=>{const c=[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return c[0]!*0.2126+c[1]!*0.7152+c[2]!*0.0722;};
 const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
export function validateConfiguration(value:unknown):CompanySettings {
 const c=companySettings.parse(value);
 if(contrast(c.brand.navy,c.brand.cream)<4.5||contrast(c.brand.navy,c.brand.gold)<4.5||contrast(c.brand.forest,c.brand.cream)<4.5)throw new DomainError('VALIDATION','Brand text/background pairs need at least 4.5:1 contrast');
 if(c.scheduling.earliestStart>c.scheduling.latestStart||c.scheduling.latestStart+120>c.scheduling.endOfDay)throw new DomainError('VALIDATION','Last start must allow the minimum reservation');
 return c;
}
export function releaseGates(c:CompanySettings):string[]{return [!c.sellerVerified&&'Verify seller identity',!c.invoiceTerms&&'Approve invoice terms',!c.taxTreatmentVerified&&'Verify invoice tax treatment',c.hourly.partialExtension===null&&'Choose partial-extension billing policy',c.scheduling.bufferMinutes===null&&'Choose travel buffer'].filter((v):v is string=>typeof v==='string');}
