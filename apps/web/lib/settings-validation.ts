import {ZodError} from 'zod';
import {DomainError} from '../../../packages/contracts/index.ts';
export type SettingsIssue={path:string;message:string};
const labels:Record<string,string>={invoiceTerms:'Invoice terms','hourly.partialExtension':'Partial extension billing','brand.navy':'Navy text color','brand.forest':'Green color','brand.gold':'Gold color','brand.cream':'Background color',displayName:'Name shown to customers',sellerLegalName:'Business name',timezone:'Timezone',region:'State or region',cities:'Service cities',sender:'Gmail sender',notificationRecipient:'Owner notification email','brand.logoUrl':'Logo image link','brand.ownerName':'Owner name for email signature','review.url':'Review page link','hourly.standardCents':'Standard hourly rate','hourly.communityCents':'Community hourly rate','scheduling.weekdays':'Working days','scheduling.earliestStart':'First appointment arrival','scheduling.latestStart':'Last appointment arrival','scheduling.endOfDay':'Finish work by','scheduling.bufferMinutes':'Time between appointments','scheduling.horizonMinutes':'Booking window','scheduling.leadMinutes':'Minimum advance notice','scheduling.selectionMinutes':'Customer time hold','scheduling.proposalMinutes':'Time to approve','scheduling.pendingLimit':'Pending alternatives'};
export function settingsFieldLabel(path:string){
 const catalog=/^catalog\.(\d+)\.(name|scope|exclusions|compliance|pricingMode)$/.exec(path);
 if(catalog)return `Service ${Number(catalog[1])+1}: ${{name:'service name',scope:'included work',exclusions:'exclusions and conditions',compliance:'scope approval',pricingMode:'pricing approach'}[catalog[2]!]}`;
 return labels[path]||'Company settings';
}
export function settingsIssue(error:unknown):SettingsIssue|null{
 if(error instanceof ZodError){
  const first=error.issues[0];if(!first)return null;
  let parts=first.path.map(String);if(parts[0]==='settings')parts=parts.slice(1);
  if(parts[0]==='cities')parts=['cities'];
  let path=parts.join('.');
  if(path==='scheduling')path='scheduling.horizonMinutes';
  const help=path==='scheduling.horizonMinutes'?'Choose a booking window longer than the minimum advance notice.':path==='brand.logoUrl'?'Enter a public HTTPS image link, or leave it blank.':path==='timezone'?'Use a timezone such as America/Chicago.':path==='review.url'?'Enter an HTTPS review link, or turn off review requests.':'Complete or correct this field.';
  return {path,message:settingsFieldLabel(path)+': '+help};
 }
 if(error instanceof DomainError&&error.code==='VALIDATION'){
  if(error.message==='Green/background colors need at least 4.5:1 contrast')return {path:'brand.forest',message:'Green color: choose a darker green so text is easy to read against the background.'};
  if(['Brand text/background pairs need at least 4.5:1 contrast','Navy/background colors need at least 4.5:1 contrast','Navy/gold colors need at least 4.5:1 contrast'].includes(error.message))return {path:'brand.navy',message:'Colors: use darker text or a lighter background so the text is easy to read.'};
  if(error.message==='First start must be before last start')return {path:'scheduling.latestStart',message:'Last appointment arrival: choose a time at or after the first appointment arrival.'};
  if(error.message==='Last start must allow the minimum reservation')return {path:'scheduling.endOfDay',message:'Appointment hours: the last appointment must have at least two hours before work finishes.'};
 }
 return null;
}
